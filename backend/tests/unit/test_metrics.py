import math

import numpy as np
import pandas as pd
import pytest

from winddesk.domain.metrics import error_histogram, error_stats, grouped_error_stats


def test_error_stats_known_values() -> None:
    stats = error_stats(pd.Series([110.0, 90.0, 100.0, 120.0]), pd.Series([100.0] * 4))
    assert stats is not None
    assert stats.n == 4
    assert stats.mae == pytest.approx(10.0)
    assert stats.bias == pytest.approx(5.0)
    assert stats.rmse == pytest.approx(math.sqrt((100 + 100 + 0 + 400) / 4))
    assert stats.wape == pytest.approx(40 / 400)
    assert stats.max_abs == 20
    assert stats.over_forecast_share == 0.5


def test_error_stats_ignores_nan_pairs_and_handles_empty() -> None:
    stats = error_stats(pd.Series([1.0, np.nan]), pd.Series([0.0, 5.0]))
    assert stats is not None and stats.n == 1
    assert error_stats(pd.Series([np.nan]), pd.Series([1.0])) is None


def test_error_stats_zero_actual_gives_nan_wape() -> None:
    stats = error_stats(pd.Series([1.0]), pd.Series([0.0]))
    assert stats is not None and math.isnan(stats.wape)


def test_error_stats_length_mismatch() -> None:
    with pytest.raises(ValueError):
        error_stats(pd.Series([1.0, 2.0]), pd.Series([1.0]))


def test_grouped_error_stats() -> None:
    df = pd.DataFrame({"g": [1, 1, 2], "f": [2.0, 4.0, 1.0], "a": [1.0, 1.0, 1.0]})
    out = dict(grouped_error_stats(df, "g", "f", "a"))
    assert out[1].mae == pytest.approx(2.0)
    assert out[2].mae == 0


def test_histogram_bins_cover_all_values() -> None:
    bins = error_histogram(pd.Series([-600.0, -100.0, 0.0, 499.0, 1200.0]), 500)
    assert sum(b.count for b in bins) == 5
    assert bins[0].lower == -1000 and bins[-1].upper == 1500


def test_histogram_edge_cases() -> None:
    assert error_histogram(pd.Series([], dtype=float), 100) == []
    single = error_histogram(pd.Series([200.0]), 100)
    assert sum(b.count for b in single) == 1
    with pytest.raises(ValueError):
        error_histogram(pd.Series([1.0]), 0)
