"""Application service: the single entry point the API talks to.

Holds the loaded dataset and caches the per-market day-ahead backtest, which every
view is derived from. The dataset is immutable, so cached tables never go stale.
"""

from __future__ import annotations

import threading
from datetime import UTC, date, datetime, timedelta

import pandas as pd

from winddesk.config import Settings
from winddesk.data.repository import WindDataset
from winddesk.domain.frames import HORIZON_H, START_TIME
from winddesk.domain.markets import (
    DEFAULT_BID_LEAD_MINUTES,
    DEFAULT_MARKET_ID,
    MARKETS,
    MAX_BID_LEAD_MINUTES,
    Market,
    UnknownMarketError,
    delivery_dates_for_decisions,
    get_market,
)
from winddesk.domain.metrics import error_stats
from winddesk.services import accuracy as acc
from winddesk.services import backtest as bt
from winddesk.services.decision import build_decision_view
from winddesk.services.errors import InvalidRequestError, NotFoundError
from winddesk.services.explorer import build_explorer_view
from winddesk.services.views import (
    AccuracyView,
    DecisionView,
    ExplorerView,
    MarketComparison,
    MarketView,
    MetaView,
)

MAX_EXPLORER_DAYS = 35
MAX_EXPLORER_HORIZON_H = 48.0
MAX_CACHED_BACKTESTS = 32


def market_view(market: Market) -> MarketView:
    return MarketView(
        id=market.id,
        name=market.name,
        venue=market.venue,
        gate_closure=market.gate_closure_local.strftime("%H:%M"),
        product=market.product,
    )


class WindAnalytics:
    def __init__(self, dataset: WindDataset, settings: Settings) -> None:
        self._dataset = dataset
        self._settings = settings
        self._delivery_dates = delivery_dates_for_decisions(
            settings.decision_start, settings.decision_end
        )
        self._backtests: dict[tuple[str, int], pd.DataFrame] = {}
        self._lock = threading.Lock()

    # ---- inputs -------------------------------------------------------------------------

    def _market(self, market_id: str) -> Market:
        try:
            return get_market(market_id)
        except UnknownMarketError as exc:
            raise InvalidRequestError(str(exc)) from exc

    @staticmethod
    def _check_lead(bid_lead_minutes: int) -> None:
        if not 0 <= bid_lead_minutes <= MAX_BID_LEAD_MINUTES:
            raise InvalidRequestError(
                f"bidLeadMinutes must be between 0 and {MAX_BID_LEAD_MINUTES}"
            )

    def _backtest(self, market: Market, bid_lead_minutes: int) -> pd.DataFrame:
        key = (market.id, bid_lead_minutes)
        with self._lock:
            cached = self._backtests.get(key)
            if cached is not None:
                return cached
            windows = bt.build_windows(
                self._settings.history_start + timedelta(days=1),
                self._delivery_dates[-1],
                market,
                bid_lead_minutes,
            )
            table = bt.build_day_ahead_backtest(
                self._dataset.forecasts,
                self._dataset.actuals,
                windows,
                self._settings.band_window_days,
            )
            if len(self._backtests) >= MAX_CACHED_BACKTESTS:
                self._backtests.pop(next(iter(self._backtests)))
            self._backtests[key] = table
            return table

    def _in_scope(self, table: pd.DataFrame) -> pd.DataFrame:
        return table[table[bt.DELIVERY_DATE].isin(self._delivery_dates)]

    # ---- queries ------------------------------------------------------------------------

    def health(self) -> dict[str, object]:
        return {
            "status": "ok",
            "data_source": self._dataset.source,
            "forecast_rows": len(self._dataset.forecasts),
            "actual_rows": len(self._dataset.actuals),
        }

    def meta(self) -> MetaView:
        return MetaView(
            data_source=self._dataset.source,
            retrieved_at=self._dataset.retrieved_at,
            decision_start=self._settings.decision_start,
            decision_end=self._settings.decision_end,
            delivery_dates=list(self._delivery_dates),
            markets=[market_view(m) for m in MARKETS.values()],
            default_market=DEFAULT_MARKET_ID,
            default_bid_lead_minutes=DEFAULT_BID_LEAD_MINUTES,
            band_window_days=self._settings.band_window_days,
            timezone="Europe/London",
        )

    def decision(self, delivery_date: date, market_id: str, bid_lead_minutes: int) -> DecisionView:
        market = self._market(market_id)
        self._check_lead(bid_lead_minutes)
        if delivery_date not in self._delivery_dates:
            raise NotFoundError(
                f"Delivery date {delivery_date} is outside the decision window "
                f"({self._delivery_dates[0]} to {self._delivery_dates[-1]})"
            )
        windows = bt.build_windows(delivery_date, delivery_date, market, bid_lead_minutes)
        return build_decision_view(
            backtest=self._backtest(market, bid_lead_minutes),
            forecasts=self._dataset.forecasts,
            actuals=self._dataset.actuals,
            window=windows[delivery_date],
            market=market_view(market),
            bid_lead_minutes=bid_lead_minutes,
            band_window_days=self._settings.band_window_days,
        )

    def _scope_bounds(self, market: Market, bid_lead_minutes: int) -> tuple[datetime, datetime]:
        windows = bt.build_windows(
            self._delivery_dates[0], self._delivery_dates[-1], market, bid_lead_minutes
        )
        return (
            windows[self._delivery_dates[0]].delivery_start,
            windows[self._delivery_dates[-1]].delivery_end,
        )

    def _market_comparison(self, bid_lead_minutes: int) -> list[MarketComparison]:
        out = []
        for market in MARKETS.values():
            rows = self._in_scope(self._backtest(market, bid_lead_minutes))
            stats = error_stats(rows[bt.FORECAST], rows[bt.ACTUAL])
            if stats is None:
                continue
            out.append(
                MarketComparison(
                    market=market_view(market),
                    horizon_min_h=float(rows[HORIZON_H].min()),
                    horizon_max_h=float(rows[HORIZON_H].max()),
                    stats=stats,
                )
            )
        return out

    def accuracy(self, market_id: str, bid_lead_minutes: int) -> AccuracyView:
        market = self._market(market_id)
        self._check_lead(bid_lead_minutes)
        rows = self._in_scope(self._backtest(market, bid_lead_minutes))
        if rows.empty:
            raise NotFoundError("No forecasts available for the decision window")
        start, end = self._scope_bounds(market, bid_lead_minutes)
        pairs = acc.all_forecasts_vs_actuals(
            self._dataset.forecasts, self._dataset.actuals, start, end
        )
        known = rows.dropna(subset=[bt.ACTUAL])
        parts = acc.summary_parts(rows)
        return AccuracyView(
            market=market_view(market),
            bid_lead_minutes=bid_lead_minutes,
            first_delivery=self._delivery_dates[0],
            last_delivery=self._delivery_dates[-1],
            decision_horizon_min_h=float(rows[HORIZON_H].min()),
            decision_horizon_max_h=float(rows[HORIZON_H].max()),
            by_horizon=acc.by_horizon(pairs),
            by_hour_of_day=acc.by_hour_of_day(known),
            by_forecast_level=acc.by_forecast_level(known),
            daily=acc.daily(rows),
            market_comparison=self._market_comparison(bid_lead_minutes),
            **parts,  # type: ignore[arg-type]
        )

    def explorer(self, start: datetime, end: datetime, min_horizon_h: float) -> ExplorerView:
        start = start if start.tzinfo else start.replace(tzinfo=UTC)
        end = end if end.tzinfo else end.replace(tzinfo=UTC)
        if end <= start:
            raise InvalidRequestError("end must be after start")
        if end - start > timedelta(days=MAX_EXPLORER_DAYS):
            raise InvalidRequestError(f"Range must be at most {MAX_EXPLORER_DAYS} days")
        if not 0 <= min_horizon_h <= MAX_EXPLORER_HORIZON_H:
            raise InvalidRequestError(
                f"minHorizonH must be between 0 and {MAX_EXPLORER_HORIZON_H:.0f}"
            )
        first = self._dataset.actuals[START_TIME].min()
        last = self._dataset.actuals[START_TIME].max()
        if pd.Timestamp(end) <= first or pd.Timestamp(start) > last:
            raise NotFoundError("Requested range has no data")
        return build_explorer_view(
            self._dataset.forecasts, self._dataset.actuals, start, end, min_horizon_h
        )
