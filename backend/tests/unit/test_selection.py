from datetime import UTC, date, datetime

import pandas as pd
import pytest

from tests.conftest import make_forecasts, run_value
from winddesk.domain.selection import (
    forecast_at_cutoff,
    forecasts_with_min_horizon,
    latest_publish_time,
    vintages_for_window,
)


@pytest.fixture
def forecasts() -> pd.DataFrame:
    return make_forecasts(date(2026, 1, 1), date(2026, 1, 3))


def test_latest_publish_time_is_inclusive(forecasts: pd.DataFrame) -> None:
    cutoff = datetime(2026, 1, 2, 7, 30, tzinfo=UTC)
    assert latest_publish_time(forecasts, cutoff) == pd.Timestamp(cutoff)


def test_latest_publish_time_none_before_first_run(forecasts: pd.DataFrame) -> None:
    assert latest_publish_time(forecasts, datetime(2025, 1, 1, tzinfo=UTC)) is None


def test_forecast_at_cutoff_picks_latest_run_and_window(forecasts: pd.DataFrame) -> None:
    out = forecast_at_cutoff(
        forecasts,
        cutoff=datetime(2026, 1, 2, 8, 50, tzinfo=UTC),
        start=datetime(2026, 1, 2, 23, tzinfo=UTC),
        end=datetime(2026, 1, 3, 23, tzinfo=UTC),
    )
    assert len(out) == 24
    assert set(out["generation"]) == {run_value(7)}  # the 07:30 run
    assert out["horizon_h"].min() == pytest.approx(15.5)
    assert out["horizon_h"].max() == pytest.approx(38.5)


def test_forecast_at_cutoff_excludes_past_targets(forecasts: pd.DataFrame) -> None:
    out = forecast_at_cutoff(
        forecasts,
        cutoff=datetime(2026, 1, 2, 9, 0, tzinfo=UTC),
        start=datetime(2026, 1, 2, 0, tzinfo=UTC),
        end=datetime(2026, 1, 2, 12, tzinfo=UTC),
    )
    assert (out["horizon_h"] >= 0).all()
    assert out["start_time"].min() == pd.Timestamp("2026-01-02T08:00:00Z")


def test_forecast_at_cutoff_empty_when_nothing_published(forecasts: pd.DataFrame) -> None:
    out = forecast_at_cutoff(
        forecasts,
        cutoff=datetime(2025, 12, 1, tzinfo=UTC),
        start=datetime(2026, 1, 2, tzinfo=UTC),
        end=datetime(2026, 1, 3, tzinfo=UTC),
    )
    assert out.empty


def test_min_horizon_selects_latest_eligible_run(forecasts: pd.DataFrame) -> None:
    out = forecasts_with_min_horizon(
        forecasts,
        min_horizon_h=4,
        start=datetime(2026, 1, 2, 12, tzinfo=UTC),
        end=datetime(2026, 1, 2, 13, tzinfo=UTC),
    )
    # Target 12:00: runs at 07:30 (4.5 h) qualifies, 09:30 (2.5 h) and 11:30 do not.
    assert len(out) == 1
    assert out.loc[0, "publish_time"] == pd.Timestamp("2026-01-02T07:30:00Z")
    assert out.loc[0, "horizon_h"] >= 4


def test_min_horizon_zero_uses_freshest_run(forecasts: pd.DataFrame) -> None:
    out = forecasts_with_min_horizon(
        forecasts,
        min_horizon_h=0,
        start=datetime(2026, 1, 2, 12, tzinfo=UTC),
        end=datetime(2026, 1, 2, 13, tzinfo=UTC),
    )
    assert out.loc[0, "publish_time"] == pd.Timestamp("2026-01-02T11:30:00Z")


def test_vintages_cover_window_after_lookback(forecasts: pd.DataFrame) -> None:
    out = vintages_for_window(
        forecasts,
        start=datetime(2026, 1, 2, 23, tzinfo=UTC),
        end=datetime(2026, 1, 3, 23, tzinfo=UTC),
        published_after=datetime(2026, 1, 2, tzinfo=UTC),
    )
    assert out["publish_time"].min() > pd.Timestamp("2026-01-02T00:00:00Z")
    assert (out["horizon_h"] >= 0).all()
