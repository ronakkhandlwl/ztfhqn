"""Accuracy report over the decision window (all delivery days in scope)."""

from __future__ import annotations

from datetime import datetime

import numpy as np
import pandas as pd

from winddesk.domain.bands import band_coverage
from winddesk.domain.frames import GENERATION, HORIZON_H, START_TIME
from winddesk.domain.markets import UK_TZ
from winddesk.domain.metrics import error_histogram, error_stats, grouped_error_stats
from winddesk.services import backtest as bt
from winddesk.services._convert import energy_mwh
from winddesk.services.views import BucketStats, DailyAccuracy

MAX_HORIZON_H = 48
LEVEL_BIN_MW = 2000
HISTOGRAM_BIN_MW = 500


def all_forecasts_vs_actuals(
    forecasts: pd.DataFrame, actuals: pd.DataFrame, start: datetime, end: datetime
) -> pd.DataFrame:
    """Every forecast (0..48 h ahead) for targets in [start, end), joined to outturn."""
    mask = (
        (forecasts[START_TIME] >= pd.Timestamp(start))
        & (forecasts[START_TIME] < pd.Timestamp(end))
        & (forecasts[HORIZON_H] >= 0)
        & (forecasts[HORIZON_H] <= MAX_HORIZON_H)
    )
    pairs = forecasts.loc[mask, [START_TIME, HORIZON_H, GENERATION]].rename(
        columns={GENERATION: bt.FORECAST}
    )
    pairs[bt.ACTUAL] = pairs[START_TIME].map(actuals.set_index(START_TIME)[GENERATION])
    return pairs.dropna(subset=[bt.ACTUAL])


def by_horizon(pairs: pd.DataFrame) -> list[BucketStats]:
    bucketed = pairs.assign(bucket=np.floor(pairs[HORIZON_H]).astype(int))
    return [
        BucketStats(key=float(k), label=f"{k}-{k + 1} h", stats=s)
        for k, s in grouped_error_stats(bucketed, "bucket", bt.FORECAST, bt.ACTUAL)
    ]


def by_hour_of_day(rows: pd.DataFrame) -> list[BucketStats]:
    hours = rows[START_TIME].dt.tz_convert(UK_TZ).dt.hour
    return [
        BucketStats(key=float(k), label=f"{k:02d}:00", stats=s)
        for k, s in grouped_error_stats(rows.assign(hour=hours), "hour", bt.FORECAST, bt.ACTUAL)
    ]


def by_forecast_level(rows: pd.DataFrame) -> list[BucketStats]:
    lower = (rows[bt.FORECAST] // LEVEL_BIN_MW * LEVEL_BIN_MW).astype(int)
    return [
        BucketStats(
            key=float(k),
            label=f"{k / 1000:.0f}-{(k + LEVEL_BIN_MW) / 1000:.0f} GW",
            stats=s,
        )
        for k, s in grouped_error_stats(rows.assign(level=lower), "level", bt.FORECAST, bt.ACTUAL)
    ]


def daily(rows: pd.DataFrame) -> list[DailyAccuracy]:
    out = []
    for delivery_date, day in rows.groupby(bt.DELIVERY_DATE, sort=True):
        known = day.dropna(subset=[bt.ACTUAL])
        if known.empty:
            continue
        err = known[bt.FORECAST] - known[bt.ACTUAL]
        out.append(
            DailyAccuracy(
                delivery_date=delivery_date,  # type: ignore[arg-type]
                forecast_energy_mwh=float(known[bt.FORECAST].sum()),
                adjusted_energy_mwh=energy_mwh(known[bt.ADJUSTED]),
                actual_energy_mwh=float(known[bt.ACTUAL].sum()),
                mae=float(err.abs().mean()),
                bias=float(err.mean()),
            )
        )
    return out


def summary_parts(rows: pd.DataFrame) -> dict[str, object]:
    with_band = rows.dropna(subset=[bt.ADJUSTED, bt.ACTUAL])
    return {
        "overall": error_stats(rows[bt.FORECAST], rows[bt.ACTUAL]),
        "overall_adjusted": error_stats(with_band[bt.ADJUSTED], with_band[bt.ACTUAL]),
        "mean_actual_mw": float(rows[bt.ACTUAL].mean()) if rows[bt.ACTUAL].notna().any() else 0.0,
        "coverage": band_coverage(rows[bt.ACTUAL], rows[bt.P10], rows[bt.P90]),
        "histogram": error_histogram(rows[bt.ERROR], HISTOGRAM_BIN_MW),
    }
