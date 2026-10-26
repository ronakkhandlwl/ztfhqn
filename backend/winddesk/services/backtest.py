"""Day-ahead backtest: what the desk would have seen at each bid cutoff, and what happened.

One row per delivery hour with the decision forecast, its walk-forward planning band,
the metered outturn and the error. Everything else (decision view, accuracy report)
is a projection of this table.
"""

from __future__ import annotations

from datetime import date, timedelta

import numpy as np
import pandas as pd

from winddesk.domain.bands import walk_forward_quantiles
from winddesk.domain.frames import GENERATION, HORIZON_H, PUBLISH_TIME, START_TIME
from winddesk.domain.markets import DecisionWindow, Market, decision_window
from winddesk.domain.selection import forecast_at_cutoff

DELIVERY_DATE = "delivery_date"
FORECAST = "forecast"
ACTUAL = "actual"
ERROR = "error"
ADJUSTED = "adjusted"
P10 = "p10"
P90 = "p90"
Q10, Q50, Q90 = "q10", "q50", "q90"
BAND_SAMPLES = "band_samples"

BACKTEST_COLUMNS = (
    DELIVERY_DATE,
    START_TIME,
    PUBLISH_TIME,
    HORIZON_H,
    FORECAST,
    ACTUAL,
    ERROR,
    Q10,
    Q50,
    Q90,
    BAND_SAMPLES,
    ADJUSTED,
    P10,
    P90,
)


def _daterange(first: date, last: date) -> list[date]:
    return [first + timedelta(days=i) for i in range((last - first).days + 1)]


def build_windows(
    first_delivery: date, last_delivery: date, market: Market, bid_lead_minutes: int
) -> dict[date, DecisionWindow]:
    return {
        d: decision_window(d, market, bid_lead_minutes)
        for d in _daterange(first_delivery, last_delivery)
    }


def build_day_ahead_backtest(
    forecasts: pd.DataFrame,
    actuals: pd.DataFrame,
    windows: dict[date, DecisionWindow],
    band_window_days: int,
) -> pd.DataFrame:
    frames = []
    for delivery_date, window in windows.items():
        selected = forecast_at_cutoff(
            forecasts, window.cutoff, window.delivery_start, window.delivery_end
        )
        if not selected.empty:
            frames.append(selected.assign(**{DELIVERY_DATE: delivery_date}))
    if not frames:
        return pd.DataFrame(columns=list(BACKTEST_COLUMNS))

    table = pd.concat(frames, ignore_index=True).rename(columns={GENERATION: FORECAST})
    actual_by_time = actuals.set_index(START_TIME)[GENERATION]
    table[ACTUAL] = table[START_TIME].map(actual_by_time)
    table[ERROR] = table[FORECAST] - table[ACTUAL]

    quantiles = walk_forward_quantiles(
        table,
        ERROR,
        {d: w.cutoff for d, w in windows.items()},
        band_window_days,
    )
    q = pd.DataFrame(
        [
            {
                DELIVERY_DATE: d,
                Q10: v.q10 if v else np.nan,
                Q50: v.q50 if v else np.nan,
                Q90: v.q90 if v else np.nan,
                BAND_SAMPLES: v.samples if v else 0,
            }
            for d, v in quantiles.items()
        ]
    )
    table = table.merge(q, on=DELIVERY_DATE, how="left")
    table[ADJUSTED] = (table[FORECAST] - table[Q50]).clip(lower=0)
    table[P10] = (table[FORECAST] - table[Q90]).clip(lower=0)
    table[P90] = (table[FORECAST] - table[Q10]).clip(lower=0)
    return table[list(BACKTEST_COLUMNS)].sort_values(START_TIME).reset_index(drop=True)
