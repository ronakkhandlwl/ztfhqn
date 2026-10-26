"""Pick which forecast was usable at a point in time.

Two questions the desk asks:
* "What was the latest forecast available when I had to bid?"  -> forecast_at_cutoff
* "How good is a forecast made at least H hours ahead?"        -> forecasts_with_min_horizon
Only forecasts with a non-negative horizon (target in the future at publish time)
are ever considered.
"""

from __future__ import annotations

from datetime import datetime

import pandas as pd

from winddesk.domain.frames import GENERATION, HORIZON_H, PUBLISH_TIME, START_TIME


def latest_publish_time(forecasts: pd.DataFrame, cutoff: datetime) -> pd.Timestamp | None:
    published = forecasts.loc[forecasts[PUBLISH_TIME] <= pd.Timestamp(cutoff), PUBLISH_TIME]
    return None if published.empty else published.max()


def forecast_at_cutoff(
    forecasts: pd.DataFrame,
    cutoff: datetime,
    start: datetime,
    end: datetime,
) -> pd.DataFrame:
    """Rows of the latest forecast published at or before ``cutoff`` for start <= t < end."""
    publish_time = latest_publish_time(forecasts, cutoff)
    if publish_time is None:
        return forecasts.iloc[0:0].copy()
    mask = (
        (forecasts[PUBLISH_TIME] == publish_time)
        & (forecasts[START_TIME] >= pd.Timestamp(start))
        & (forecasts[START_TIME] < pd.Timestamp(end))
        & (forecasts[HORIZON_H] >= 0)
    )
    return forecasts.loc[mask].reset_index(drop=True)


def forecasts_with_min_horizon(
    forecasts: pd.DataFrame,
    min_horizon_h: float,
    start: datetime,
    end: datetime,
) -> pd.DataFrame:
    """For each target time, the most recent forecast published >= ``min_horizon_h`` earlier."""
    mask = (
        (forecasts[HORIZON_H] >= max(min_horizon_h, 0.0))
        & (forecasts[START_TIME] >= pd.Timestamp(start))
        & (forecasts[START_TIME] < pd.Timestamp(end))
    )
    eligible = forecasts.loc[mask].sort_values([START_TIME, PUBLISH_TIME])
    latest = eligible.groupby(START_TIME, as_index=False).tail(1)
    return latest[[START_TIME, PUBLISH_TIME, GENERATION, HORIZON_H]].reset_index(drop=True)


def vintages_for_window(
    forecasts: pd.DataFrame,
    start: datetime,
    end: datetime,
    published_after: datetime,
) -> pd.DataFrame:
    """Every forecast run published after ``published_after`` that covers the window."""
    mask = (
        (forecasts[PUBLISH_TIME] > pd.Timestamp(published_after))
        & (forecasts[START_TIME] >= pd.Timestamp(start))
        & (forecasts[START_TIME] < pd.Timestamp(end))
        & (forecasts[HORIZON_H] >= 0)
    )
    return forecasts.loc[mask].reset_index(drop=True)
