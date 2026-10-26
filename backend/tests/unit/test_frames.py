import pandas as pd
import pytest

from winddesk.domain.frames import SchemaError, normalise_actuals, normalise_forecasts


def test_normalise_forecasts_cleans_and_adds_horizon() -> None:
    raw = pd.DataFrame(
        {
            "publish_time": ["2026-01-01T07:30:00Z", "2026-01-01T07:30:00Z", "bad", None],
            "start_time": ["2026-01-01T10:00:00Z", "2026-01-01T10:00:00Z", "x", "y"],
            "generation": [100, 200, 5, 6],
        }
    )
    raw.loc[2, "publish_time"] = None
    out = normalise_forecasts(raw)
    assert len(out) == 1
    assert out.loc[0, "generation"] == 200  # last duplicate wins
    assert out.loc[0, "horizon_h"] == pytest.approx(2.5)


def test_normalise_drops_negative_and_non_numeric() -> None:
    raw = pd.DataFrame(
        {
            "start_time": ["2026-01-01T00:00:00Z", "2026-01-01T00:30:00Z", "2026-01-01T01:00Z"],
            "generation": [-5, "abc", 7],
        }
    )
    out = normalise_actuals(raw)
    assert out["generation"].tolist() == [7]
    assert str(out["start_time"].dt.tz) == "UTC"


def test_missing_columns_raise() -> None:
    with pytest.raises(SchemaError):
        normalise_actuals(pd.DataFrame({"start_time": []}))
