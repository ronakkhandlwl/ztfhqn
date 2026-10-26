import pytest

from winddesk.config import load_settings


def test_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    for key in ("WINDDESK_DATA_SOURCE", "WINDDESK_DECISION_START", "WINDDESK_CORS_ORIGINS"):
        monkeypatch.delenv(key, raising=False)
    s = load_settings()
    assert s.data_source == "snapshot"
    assert s.decision_start.isoformat() == "2026-01-01"
    assert s.decision_end.isoformat() == "2026-01-31"
    assert s.band_window_days == 28


def test_custom_cors(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("WINDDESK_CORS_ORIGINS", "https://a.test, https://b.test,")
    assert load_settings().cors_origins == ("https://a.test", "https://b.test")


@pytest.mark.parametrize(
    ("key", "value"),
    [
        ("WINDDESK_DATA_SOURCE", "ftp"),
        ("WINDDESK_DECISION_START", "2027-01-01"),
        ("WINDDESK_BAND_WINDOW_DAYS", "0"),
    ],
)
def test_invalid_values(monkeypatch: pytest.MonkeyPatch, key: str, value: str) -> None:
    monkeypatch.setenv(key, value)
    with pytest.raises(ValueError):
        load_settings()
