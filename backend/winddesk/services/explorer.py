"""Horizon explorer: outturn vs. the latest forecast made at least H hours ahead."""

from __future__ import annotations

from datetime import datetime

import pandas as pd

from winddesk.domain.frames import GENERATION, HORIZON_H, PUBLISH_TIME, START_TIME
from winddesk.domain.metrics import error_stats
from winddesk.domain.selection import forecasts_with_min_horizon
from winddesk.services._convert import opt_float, to_datetime
from winddesk.services.views import ExplorerForecastPoint, ExplorerView, SeriesPoint


def build_explorer_view(
    forecasts: pd.DataFrame,
    actuals: pd.DataFrame,
    start: datetime,
    end: datetime,
    min_horizon_h: float,
) -> ExplorerView:
    selected = forecasts_with_min_horizon(forecasts, min_horizon_h, start, end)
    actual_by_time = actuals.set_index(START_TIME)[GENERATION]
    selected = selected.assign(actual=selected[START_TIME].map(actual_by_time))
    in_range = (actuals[START_TIME] >= pd.Timestamp(start)) & (
        actuals[START_TIME] < pd.Timestamp(end)
    )
    window_actuals = actuals.loc[in_range]
    return ExplorerView(
        start=start,
        end=end,
        min_horizon_h=min_horizon_h,
        actuals=[
            SeriesPoint(to_datetime(t), float(g))
            for t, g in zip(window_actuals[START_TIME], window_actuals[GENERATION], strict=True)
        ],
        forecasts=[
            ExplorerForecastPoint(
                start_time=to_datetime(r[START_TIME]),
                publish_time=to_datetime(r[PUBLISH_TIME]),
                horizon_h=float(r[HORIZON_H]),
                generation=float(r[GENERATION]),
                actual=opt_float(r["actual"]),
            )
            for r in selected.to_dict("records")
        ],
        stats=error_stats(selected[GENERATION], selected["actual"]),
    )
