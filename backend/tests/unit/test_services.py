from datetime import UTC, date, datetime

import pytest

from tests.conftest import ACTUAL_MW, run_value
from winddesk.config import Settings
from winddesk.data.repository import WindDataset
from winddesk.domain.markets import get_market
from winddesk.services import backtest as bt
from winddesk.services.analytics import WindAnalytics
from winddesk.services.errors import InvalidRequestError, NotFoundError


@pytest.fixture
def analytics(dataset: WindDataset, settings: Settings) -> WindAnalytics:
    return WindAnalytics(dataset, settings)


def test_backtest_uses_decision_run_and_walk_forward_band(
    dataset: WindDataset, settings: Settings
) -> None:
    windows = bt.build_windows(date(2025, 12, 28), date(2026, 1, 6), get_market("epex-hourly"), 30)
    table = bt.build_day_ahead_backtest(dataset.forecasts, dataset.actuals, windows, 3)
    jan3 = table[table[bt.DELIVERY_DATE] == date(2026, 1, 3)]
    assert len(jan3) == 24
    expected_error = run_value(7) - ACTUAL_MW
    assert (jan3[bt.FORECAST] == run_value(7)).all()
    assert (jan3[bt.ERROR] == expected_error).all()
    # Every past decision used the same 07:30 run, so the band collapses onto the truth.
    assert jan3[bt.Q50].iloc[0] == pytest.approx(expected_error)
    assert jan3[bt.ADJUSTED].iloc[0] == pytest.approx(ACTUAL_MW)
    first = table[table[bt.DELIVERY_DATE] == date(2025, 12, 28)]
    assert first[bt.Q50].isna().all()  # no history yet


def test_backtest_empty_when_no_forecasts(dataset: WindDataset) -> None:
    windows = bt.build_windows(date(2020, 1, 1), date(2020, 1, 2), get_market("epex-hourly"), 0)
    table = bt.build_day_ahead_backtest(dataset.forecasts, dataset.actuals, windows, 3)
    assert table.empty
    assert list(table.columns) == list(bt.BACKTEST_COLUMNS)


def test_meta(analytics: WindAnalytics) -> None:
    meta = analytics.meta()
    assert meta.delivery_dates[0] == date(2026, 1, 2)
    assert meta.delivery_dates[-1] == date(2026, 1, 6)
    assert {m.id for m in meta.markets} == {"epex-hourly", "n2ex-hourly", "epex-half-hourly"}


def test_decision_view(analytics: WindAnalytics) -> None:
    view = analytics.decision(date(2026, 1, 4), "epex-hourly", 30)
    assert view.forecast_publish_time == datetime(2026, 1, 3, 7, 30, tzinfo=UTC)
    assert view.forecast_age_minutes == 80
    assert len(view.hours) == 24
    assert len(view.actuals_half_hourly) == 48
    assert view.band is not None and view.band.window_days == 3
    assert view.summary is not None
    assert view.summary.forecast_energy_mwh == pytest.approx(24 * run_value(7))
    assert view.summary.actual_energy_mwh == pytest.approx(24 * ACTUAL_MW)
    decision_runs = [v for v in view.vintages if v.is_decision]
    assert len(decision_runs) == 1
    assert any(v.after_cutoff for v in view.vintages)


def test_half_hourly_auction_uses_later_run(analytics: WindAnalytics) -> None:
    view = analytics.decision(date(2026, 1, 4), "epex-half-hourly", 30)
    assert view.forecast_publish_time == datetime(2026, 1, 3, 11, 30, tzinfo=UTC)


def test_decision_errors(analytics: WindAnalytics) -> None:
    with pytest.raises(NotFoundError):
        analytics.decision(date(2026, 3, 1), "epex-hourly", 30)
    with pytest.raises(InvalidRequestError):
        analytics.decision(date(2026, 1, 4), "bogus", 30)
    with pytest.raises(InvalidRequestError):
        analytics.decision(date(2026, 1, 4), "epex-hourly", 999)


def test_accuracy_view(analytics: WindAnalytics) -> None:
    view = analytics.accuracy("epex-hourly", 30)
    assert view.overall is not None
    assert view.overall.n == 5 * 24
    assert view.overall.bias == pytest.approx(run_value(7) - ACTUAL_MW)
    assert view.overall_adjusted is not None
    assert view.overall_adjusted.mae == pytest.approx(0)
    assert view.decision_horizon_min_h == pytest.approx(15.5)
    assert len(view.daily) == 5
    assert len(view.by_hour_of_day) == 24
    assert view.by_horizon[0].label == "0-1 h"
    assert {c.market.id for c in view.market_comparison} == {
        "epex-hourly",
        "n2ex-hourly",
        "epex-half-hourly",
    }
    assert view.coverage is not None and view.histogram


def test_backtest_cache_reused(analytics: WindAnalytics) -> None:
    analytics.accuracy("epex-hourly", 30)
    first = analytics._backtest(get_market("epex-hourly"), 30)
    assert analytics._backtest(get_market("epex-hourly"), 30) is first


def test_explorer_view(analytics: WindAnalytics) -> None:
    view = analytics.explorer(datetime(2026, 1, 3, tzinfo=UTC), datetime(2026, 1, 4, tzinfo=UTC), 4)
    assert len(view.actuals) == 48
    assert len(view.forecasts) == 24
    assert all(p.horizon_h >= 4 for p in view.forecasts)
    assert view.stats is not None


def test_explorer_accepts_naive_datetimes(analytics: WindAnalytics) -> None:
    view = analytics.explorer(datetime(2026, 1, 3), datetime(2026, 1, 4), 0)
    assert view.start.tzinfo is not None


@pytest.mark.parametrize(
    ("start", "end", "horizon", "error"),
    [
        (datetime(2026, 1, 4), datetime(2026, 1, 3), 4, InvalidRequestError),
        (datetime(2026, 1, 1), datetime(2026, 3, 1), 4, InvalidRequestError),
        (datetime(2026, 1, 3), datetime(2026, 1, 4), 60, InvalidRequestError),
        (datetime(2024, 1, 1), datetime(2024, 1, 2), 4, NotFoundError),
    ],
)
def test_explorer_validation(
    analytics: WindAnalytics, start: datetime, end: datetime, horizon: float, error: type
) -> None:
    with pytest.raises(error):
        analytics.explorer(start, end, horizon)
