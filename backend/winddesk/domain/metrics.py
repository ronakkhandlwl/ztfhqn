"""Forecast error statistics.

Sign convention used everywhere: error = forecast - actual.
Positive error = the forecast over-stated wind, i.e. the desk would have under-bought
and must cover the shortfall later (intraday / imbalance).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np
import pandas as pd

ERROR_QUANTILES = (0.1, 0.5, 0.9)


@dataclass(frozen=True)
class ErrorStats:
    n: int
    mae: float
    rmse: float
    bias: float
    wape: float
    p10: float
    p50: float
    p90: float
    max_abs: float
    over_forecast_share: float


def _finite_pairs(forecast: pd.Series, actual: pd.Series) -> tuple[np.ndarray, np.ndarray]:
    f = np.asarray(forecast, dtype=float)
    a = np.asarray(actual, dtype=float)
    if f.shape != a.shape:
        raise ValueError("forecast and actual must have the same length")
    keep = np.isfinite(f) & np.isfinite(a)
    return f[keep], a[keep]


def error_stats(forecast: pd.Series, actual: pd.Series) -> ErrorStats | None:
    f, a = _finite_pairs(forecast, actual)
    if f.size == 0:
        return None
    err = f - a
    abs_err = np.abs(err)
    total_actual = float(np.sum(a))
    p10, p50, p90 = np.quantile(err, ERROR_QUANTILES)
    return ErrorStats(
        n=int(err.size),
        mae=float(abs_err.mean()),
        rmse=float(np.sqrt(np.mean(err**2))),
        bias=float(err.mean()),
        wape=float(abs_err.sum() / total_actual) if total_actual > 0 else float("nan"),
        p10=float(p10),
        p50=float(p50),
        p90=float(p90),
        max_abs=float(abs_err.max()),
        over_forecast_share=float(np.mean(err > 0)),
    )


def grouped_error_stats(
    df: pd.DataFrame, by: str, forecast_col: str, actual_col: str
) -> list[tuple[Any, ErrorStats]]:
    out: list[tuple[Any, ErrorStats]] = []
    for key, group in df.groupby(by, sort=True, observed=True):
        stats = error_stats(group[forecast_col], group[actual_col])
        if stats is not None:
            out.append((key, stats))
    return out


@dataclass(frozen=True)
class HistogramBin:
    lower: float
    upper: float
    count: int


def error_histogram(errors: pd.Series, bin_width: float) -> list[HistogramBin]:
    if bin_width <= 0:
        raise ValueError("bin_width must be positive")
    values = np.asarray(errors, dtype=float)
    values = values[np.isfinite(values)]
    if values.size == 0:
        return []
    lo = np.floor(values.min() / bin_width) * bin_width
    hi = np.ceil(values.max() / bin_width) * bin_width
    if hi == lo:
        hi = lo + bin_width
    edges = np.arange(lo, hi + bin_width / 2, bin_width)
    counts, edges = np.histogram(values, bins=edges)
    return [
        HistogramBin(float(edges[i]), float(edges[i + 1]), int(counts[i]))
        for i in range(len(counts))
    ]
