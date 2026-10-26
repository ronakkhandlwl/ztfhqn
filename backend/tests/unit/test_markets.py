from datetime import UTC, date, datetime, time

import pytest

from winddesk.domain.markets import (
    MARKETS,
    UnknownMarketError,
    decision_window,
    delivery_dates_for_decisions,
    get_market,
)


def test_winter_window_uses_gmt_and_23h_delivery_boundaries() -> None:
    w = decision_window(date(2026, 1, 15), get_market("epex-hourly"), bid_lead_minutes=30)
    assert w.decision_date == date(2026, 1, 14)
    assert w.gate_closure == datetime(2026, 1, 14, 9, 20, tzinfo=UTC)
    assert w.cutoff == datetime(2026, 1, 14, 8, 50, tzinfo=UTC)
    assert w.delivery_start == datetime(2026, 1, 14, 23, 0, tzinfo=UTC)
    assert w.delivery_end == datetime(2026, 1, 15, 23, 0, tzinfo=UTC)


def test_summer_window_converts_bst_to_utc() -> None:
    w = decision_window(date(2026, 7, 2), get_market("n2ex-hourly"), bid_lead_minutes=0)
    assert w.gate_closure == datetime(2026, 7, 1, 8, 50, tzinfo=UTC)  # 09:50 BST
    assert w.delivery_start == datetime(2026, 7, 1, 22, 0, tzinfo=UTC)


def test_clock_change_day_has_23_hours() -> None:
    w = decision_window(date(2026, 3, 29), get_market("epex-hourly"))
    assert (w.delivery_end - w.delivery_start).total_seconds() == 23 * 3600


@pytest.mark.parametrize("lead", [-1, 361])
def test_rejects_out_of_range_lead(lead: int) -> None:
    with pytest.raises(ValueError):
        decision_window(date(2026, 1, 15), get_market("epex-hourly"), lead)


def test_unknown_market() -> None:
    with pytest.raises(UnknownMarketError):
        get_market("nope")


def test_market_catalogue_gate_closures() -> None:
    assert MARKETS["epex-hourly"].gate_closure_local == time(9, 20)
    assert MARKETS["n2ex-hourly"].gate_closure_local == time(9, 50)
    assert MARKETS["epex-half-hourly"].gate_closure_local == time(15, 30)


def test_delivery_dates_are_decision_plus_one() -> None:
    dates = delivery_dates_for_decisions(date(2026, 1, 1), date(2026, 1, 31))
    assert dates[0] == date(2026, 1, 2)
    assert dates[-1] == date(2026, 2, 1)
    assert len(dates) == 31
