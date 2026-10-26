"""Walk-forward error bands.

For each delivery day we look back over the errors the desk could already have
observed at its bid cutoff (settlement periods that had finished by then, within a
trailing window) and take empirical quantiles of error = forecast - actual.
Those quantiles turn the point forecast into a planning range:

    p50 (bias-adjusted) = forecast - q50
    p10 (low wind case) = forecast - q90
    p90 (high wind case) = forecast - q10

Using only past errors keeps the backtest honest: no information from the future
leaks into a decision.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime

import numpy as np
import pandas as pd

from winddesk.domain.frames import START_TIME

SETTLEMENT_PERIOD = pd.Timedelta(minutes=30)
MIN_HISTORY_SAMPLES = 48
BAND_QUANTILES = (0.1, 0.5, 0.9)
NOMINAL_COVERAGE = BAND_QUANTILES[2] - BAND_QUANTILES[0]


@dataclass(frozen=True)
class ErrorQuantiles:
    q10: float
    q50: float
    q90: float
    samples: int


def history_mask(errors: pd.DataFrame, cutoff: datetime, window_days: int) -> pd.Series:
    """Errors whose actual outturn was known at ``cutoff`` and lie within the window."""
    cutoff_ts = pd.Timestamp(cutoff)
    known = errors[START_TIME] + SETTLEMENT_PERIOD <= cutoff_ts
    recent = errors[START_TIME] >= cutoff_ts - pd.Timedelta(days=window_days)
    return known & recent


def walk_forward_quantiles(
    errors: pd.DataFrame,
    error_col: str,
    cutoffs: dict[date, datetime],
    window_days: int,
    min_samples: int = MIN_HISTORY_SAMPLES,
) -> dict[date, ErrorQuantiles | None]:
    """Error quantiles available at each delivery day's cutoff (None if too little history)."""
    out: dict[date, ErrorQuantiles | None] = {}
    for delivery_date, cutoff in cutoffs.items():
        history = errors.loc[history_mask(errors, cutoff, window_days), error_col].dropna()
        if len(history) < min_samples:
            out[delivery_date] = None
            continue
        q10, q50, q90 = np.quantile(history.to_numpy(dtype=float), BAND_QUANTILES)
        out[delivery_date] = ErrorQuantiles(float(q10), float(q50), float(q90), len(history))
    return out


@dataclass(frozen=True)
class Coverage:
    nominal: float
    inside: float
    below_low: float
    above_high: float
    samples: int


def band_coverage(actual: pd.Series, low: pd.Series, high: pd.Series) -> Coverage | None:
    a = np.asarray(actual, dtype=float)
    lo = np.asarray(low, dtype=float)
    hi = np.asarray(high, dtype=float)
    keep = np.isfinite(a) & np.isfinite(lo) & np.isfinite(hi)
    if not keep.any():
        return None
    a, lo, hi = a[keep], lo[keep], hi[keep]
    return Coverage(
        nominal=NOMINAL_COVERAGE,
        inside=float(np.mean((a >= lo) & (a <= hi))),
        below_low=float(np.mean(a < lo)),
        above_high=float(np.mean(a > hi)),
        samples=int(a.size),
    )
