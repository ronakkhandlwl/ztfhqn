"""Builds the decision view for a single delivery day."""

from __future__ import annotations

from datetime import timedelta
from typing import cast

import pandas as pd

from winddesk.domain.bands import band_coverage
from winddesk.domain.frames import GENERATION, HORIZON_H, PUBLISH_TIME, START_TIME
from winddesk.domain.markets import DecisionWindow
from winddesk.domain.metrics import error_stats
from winddesk.domain.selection import vintages_for_window
from winddesk.services import backtest as bt
from winddesk.services._convert import energy_mwh, opt_float, to_datetime
from winddesk.services.views import (
    BandView,
    DecisionHour,
    DecisionSummary,
    DecisionView,
    MarketView,
    SeriesPoint,
    Vintage,
)

VINTAGE_LOOKBACK = timedelta(days=3)


def _hours(day: pd.DataFrame) -> list[DecisionHour]:
    return [
        DecisionHour(
            start_time=to_datetime(r[START_TIME]),
            horizon_h=float(r[HORIZON_H]),
            forecast=float(r[bt.FORECAST]),
            adjusted=opt_float(r[bt.ADJUSTED]),
            p10=opt_float(r[bt.P10]),
            p90=opt_float(r[bt.P90]),
            actual=opt_float(r[bt.ACTUAL]),
            error=opt_float(r[bt.ERROR]),
        )
        for r in day.to_dict("records")
    ]


def _band(day: pd.DataFrame, window_days: int) -> BandView | None:
    first = day.iloc[0]
    if pd.isna(first[bt.Q50]):
        return None
    return BandView(
        q10=float(first[bt.Q10]),
        q50=float(first[bt.Q50]),
        q90=float(first[bt.Q90]),
        samples=int(first[bt.BAND_SAMPLES]),
        window_days=window_days,
    )


def _summary(day: pd.DataFrame) -> DecisionSummary:
    with_band = day.dropna(subset=[bt.ADJUSTED])
    # Only compare delivered energy once every hour has been metered; a partial day
    # would understate outturn against a full-day forecast.
    complete = bool(day[bt.ACTUAL].notna().all())
    return DecisionSummary(
        forecast_energy_mwh=float(day[bt.FORECAST].sum()),
        adjusted_energy_mwh=energy_mwh(day[bt.ADJUSTED]),
        low_energy_mwh=energy_mwh(day[bt.P10]),
        high_energy_mwh=energy_mwh(day[bt.P90]),
        actual_energy_mwh=energy_mwh(day[bt.ACTUAL]) if complete else None,
        mean_forecast_mw=float(day[bt.FORECAST].mean()),
        peak_forecast_mw=float(day[bt.FORECAST].max()),
        min_forecast_mw=float(day[bt.FORECAST].min()),
        stats=error_stats(day[bt.FORECAST], day[bt.ACTUAL]),
        adjusted_stats=error_stats(with_band[bt.ADJUSTED], with_band[bt.ACTUAL]),
        coverage=band_coverage(day[bt.ACTUAL], day[bt.P10], day[bt.P90]),
    )


def _vintages(
    forecasts: pd.DataFrame, window: DecisionWindow, decision_publish: pd.Timestamp | None
) -> list[Vintage]:
    runs = vintages_for_window(
        forecasts,
        window.delivery_start,
        window.delivery_end,
        published_after=window.delivery_start - VINTAGE_LOOKBACK,
    )
    cutoff = pd.Timestamp(window.cutoff)
    out = []
    for publish_time, run in runs.groupby(PUBLISH_TIME, sort=True):
        ts = cast(pd.Timestamp, publish_time)
        out.append(
            Vintage(
                publish_time=to_datetime(ts),
                is_decision=decision_publish is not None and ts == decision_publish,
                after_cutoff=ts > cutoff,
                points=[
                    SeriesPoint(to_datetime(t), float(g))
                    for t, g in zip(run[START_TIME], run[GENERATION], strict=True)
                ],
            )
        )
    return out


def build_decision_view(
    *,
    backtest: pd.DataFrame,
    forecasts: pd.DataFrame,
    actuals: pd.DataFrame,
    window: DecisionWindow,
    market: MarketView,
    bid_lead_minutes: int,
    band_window_days: int,
) -> DecisionView:
    day = backtest[backtest[bt.DELIVERY_DATE] == window.delivery_date]
    publish_time = None if day.empty else pd.Timestamp(day[PUBLISH_TIME].iloc[0])
    in_window = (actuals[START_TIME] >= pd.Timestamp(window.delivery_start)) & (
        actuals[START_TIME] < pd.Timestamp(window.delivery_end)
    )
    return DecisionView(
        delivery_date=window.delivery_date,
        decision_date=window.decision_date,
        market=market,
        bid_lead_minutes=bid_lead_minutes,
        gate_closure=window.gate_closure,
        cutoff=window.cutoff,
        delivery_start=window.delivery_start,
        delivery_end=window.delivery_end,
        forecast_publish_time=None if publish_time is None else to_datetime(publish_time),
        forecast_age_minutes=(
            None
            if publish_time is None
            else (pd.Timestamp(window.cutoff) - publish_time).total_seconds() / 60
        ),
        band=None if day.empty else _band(day, band_window_days),
        hours=_hours(day),
        actuals_half_hourly=[
            SeriesPoint(to_datetime(t), float(g))
            for t, g in zip(
                actuals.loc[in_window, START_TIME], actuals.loc[in_window, GENERATION], strict=True
            )
        ],
        vintages=_vintages(forecasts, window, publish_time),
        summary=None if day.empty else _summary(day),
    )
