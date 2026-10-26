"""Shared fixtures: a small, fully deterministic synthetic wind dataset.

* Actuals: constant 10,000 MW every half hour.
* Forecast runs: published 8x per day (like WINDFOR) at 02:30 ... 22:30 UTC, each
  covering hourly targets from 21:00 the previous day to 72 h later.
  Run value = 11,000 + 10 * publish_hour, so the error of any run is known exactly
  and tests can tell which run was selected.
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from pathlib import Path

import pandas as pd
import pytest

from winddesk.config import Settings
from winddesk.data.repository import WindDataset
from winddesk.domain.frames import normalise_actuals, normalise_forecasts

PUBLISH_HOURS = (2, 4, 7, 9, 11, 15, 18, 22)
ACTUAL_MW = 10_000.0


def run_value(publish_hour: int) -> float:
    return 11_000.0 + 10.0 * publish_hour


def make_forecasts(first_day: date, last_day: date) -> pd.DataFrame:
    rows = []
    day = first_day
    while day <= last_day:
        for hour in PUBLISH_HOURS:
            publish = datetime(day.year, day.month, day.day, hour, 30, tzinfo=UTC)
            first_target = datetime(day.year, day.month, day.day, 21, tzinfo=UTC) - timedelta(
                days=1
            )
            rows.extend(
                {
                    "publish_time": publish,
                    "start_time": first_target + timedelta(hours=h),
                    "generation": run_value(hour),
                }
                for h in range(73)
            )
        day += timedelta(days=1)
    return normalise_forecasts(pd.DataFrame(rows))


def make_actuals(first_day: date, last_day: date) -> pd.DataFrame:
    start = datetime(first_day.year, first_day.month, first_day.day, tzinfo=UTC)
    end = datetime(last_day.year, last_day.month, last_day.day, tzinfo=UTC) + timedelta(days=1)
    times = pd.date_range(start, end, freq="30min", inclusive="left")
    return normalise_actuals(pd.DataFrame({"start_time": times, "generation": ACTUAL_MW}))


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return Settings(
        data_source="snapshot",
        snapshot_dir=tmp_path,
        elexon_base_url="https://example.test/api",
        elexon_timeout_s=5.0,
        decision_start=date(2026, 1, 1),
        decision_end=date(2026, 1, 5),
        history_start=date(2025, 12, 26),
        band_window_days=3,
        cors_origins=("http://localhost:5173",),
    )


@pytest.fixture
def dataset() -> WindDataset:
    return WindDataset(
        actuals=make_actuals(date(2025, 12, 26), date(2026, 1, 8)),
        forecasts=make_forecasts(date(2025, 12, 26), date(2026, 1, 5)),
        source="synthetic",
        retrieved_at=datetime(2026, 2, 2, tzinfo=UTC),
    )
