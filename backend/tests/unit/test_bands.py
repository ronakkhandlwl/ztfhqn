from datetime import UTC, date, datetime, timedelta

import numpy as np
import pandas as pd
import pytest

from winddesk.domain.bands import band_coverage, history_mask, walk_forward_quantiles


def _errors(start: datetime, hours: int, value: float = 100.0) -> pd.DataFrame:
    times = [start + timedelta(hours=h) for h in range(hours)]
    return pd.DataFrame({"start_time": pd.to_datetime(times, utc=True), "error": value})


def test_history_mask_excludes_unfinished_periods_and_old_errors() -> None:
    errors = _errors(datetime(2026, 1, 1, tzinfo=UTC), 72)
    cutoff = datetime(2026, 1, 3, 8, 50, tzinfo=UTC)
    mask = history_mask(errors, cutoff, window_days=1)
    kept = errors.loc[mask, "start_time"]
    assert kept.max() == pd.Timestamp("2026-01-03T08:00:00Z")  # 08:00 ended at 08:30
    assert kept.min() >= pd.Timestamp(cutoff - timedelta(days=1))


def test_walk_forward_quantiles_uses_only_past() -> None:
    past = _errors(datetime(2026, 1, 1, tzinfo=UTC), 48, value=100.0)
    future = _errors(datetime(2026, 1, 3, tzinfo=UTC), 48, value=9_999.0)
    errors = pd.concat([past, future], ignore_index=True)
    q = walk_forward_quantiles(
        errors, "error", {date(2026, 1, 4): datetime(2026, 1, 3, 0, 0, tzinfo=UTC)}, 7, 10
    )[date(2026, 1, 4)]
    assert q is not None
    assert q.q10 == q.q50 == q.q90 == 100.0
    assert q.samples == 48


def test_walk_forward_quantiles_none_when_history_short() -> None:
    errors = _errors(datetime(2026, 1, 1, tzinfo=UTC), 5)
    q = walk_forward_quantiles(
        errors, "error", {date(2026, 1, 2): datetime(2026, 1, 2, tzinfo=UTC)}, 7, 48
    )
    assert q[date(2026, 1, 2)] is None


def test_band_coverage() -> None:
    cov = band_coverage(
        pd.Series([5.0, 15.0, 25.0, np.nan]),
        pd.Series([10.0, 10.0, 10.0, 10.0]),
        pd.Series([20.0, 20.0, 20.0, 20.0]),
    )
    assert cov is not None
    assert cov.samples == 3
    assert cov.inside == pytest.approx(1 / 3)
    assert cov.below_low == pytest.approx(1 / 3)
    assert cov.above_high == pytest.approx(1 / 3)
    assert cov.nominal == pytest.approx(0.8)


def test_band_coverage_empty() -> None:
    assert band_coverage(pd.Series([np.nan]), pd.Series([1.0]), pd.Series([2.0])) is None
