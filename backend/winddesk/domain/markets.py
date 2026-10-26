"""GB day-ahead market definitions and the decision window for a delivery day.

GB day-ahead auctions trade a delivery day that runs 23:00 -> 23:00 UK local time
(aligned to the CET day). Bids must be in before the auction's gate closure on D-1,
so the forecast that matters is the latest one published before the desk finalises
its bids: gate closure minus a bid-preparation lead time (the cutoff).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

UK_TZ = ZoneInfo("Europe/London")
DELIVERY_DAY_START_LOCAL = time(23, 0)
DEFAULT_BID_LEAD_MINUTES = 30
MAX_BID_LEAD_MINUTES = 6 * 60


@dataclass(frozen=True)
class Market:
    id: str
    name: str
    venue: str
    gate_closure_local: time
    product: str


MARKETS: dict[str, Market] = {
    m.id: m
    for m in (
        Market("epex-hourly", "EPEX GB Day-Ahead (hourly)", "EPEX SPOT", time(9, 20), "60-min"),
        Market("n2ex-hourly", "Nord Pool N2EX GB Day-Ahead", "Nord Pool", time(9, 50), "60-min"),
        Market(
            "epex-half-hourly",
            "EPEX GB Day-Ahead (half-hourly)",
            "EPEX SPOT",
            time(15, 30),
            "30-min",
        ),
    )
}
DEFAULT_MARKET_ID = "epex-hourly"


class UnknownMarketError(ValueError):
    pass


def get_market(market_id: str) -> Market:
    try:
        return MARKETS[market_id]
    except KeyError as exc:
        raise UnknownMarketError(
            f"Unknown market {market_id!r}; expected one of {sorted(MARKETS)}"
        ) from exc


@dataclass(frozen=True)
class DecisionWindow:
    """All instants are timezone-aware UTC datetimes."""

    delivery_date: date
    market_id: str
    gate_closure: datetime
    cutoff: datetime
    delivery_start: datetime
    delivery_end: datetime

    @property
    def decision_date(self) -> date:
        return self.delivery_date - timedelta(days=1)


def _local_to_utc(day: date, at: time) -> datetime:
    return datetime.combine(day, at, tzinfo=UK_TZ).astimezone(UTC)


def decision_window(
    delivery_date: date,
    market: Market,
    bid_lead_minutes: int = DEFAULT_BID_LEAD_MINUTES,
) -> DecisionWindow:
    if not 0 <= bid_lead_minutes <= MAX_BID_LEAD_MINUTES:
        raise ValueError(f"bid_lead_minutes must be within 0..{MAX_BID_LEAD_MINUTES}")
    decision_date = delivery_date - timedelta(days=1)
    gate_closure = _local_to_utc(decision_date, market.gate_closure_local)
    return DecisionWindow(
        delivery_date=delivery_date,
        market_id=market.id,
        gate_closure=gate_closure,
        cutoff=gate_closure - timedelta(minutes=bid_lead_minutes),
        delivery_start=_local_to_utc(decision_date, DELIVERY_DAY_START_LOCAL),
        delivery_end=_local_to_utc(delivery_date, DELIVERY_DAY_START_LOCAL),
    )


def delivery_dates_for_decisions(decision_start: date, decision_end: date) -> list[date]:
    """Delivery days whose purchase decision falls within [decision_start, decision_end]."""
    n_days = (decision_end - decision_start).days + 1
    return [decision_start + timedelta(days=i + 1) for i in range(n_days)]
