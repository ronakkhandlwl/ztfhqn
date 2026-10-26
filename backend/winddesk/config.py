"""Runtime configuration, read once from environment variables."""

from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import date
from functools import lru_cache
from pathlib import Path

PACKAGE_ROOT = Path(__file__).resolve().parent
DEFAULT_SNAPSHOT_DIR = PACKAGE_ROOT.parent / "data"

DATA_SOURCE_SNAPSHOT = "snapshot"
DATA_SOURCE_ELEXON = "elexon"
VALID_DATA_SOURCES = (DATA_SOURCE_SNAPSHOT, DATA_SOURCE_ELEXON)


@dataclass(frozen=True)
class Settings:
    """Application settings.

    The analysis scope is defined by *decision* dates: a purchase decision made on
    day D-1 buys power for delivery day D. ``history_start`` adds calibration history
    before the first decision so walk-forward error bands are populated from day one.
    """

    data_source: str
    snapshot_dir: Path
    elexon_base_url: str
    elexon_timeout_s: float
    decision_start: date
    decision_end: date
    history_start: date
    band_window_days: int
    cors_origins: tuple[str, ...]


def _env_date(name: str, default: str) -> date:
    return date.fromisoformat(os.getenv(name, default))


def load_settings() -> Settings:
    data_source = os.getenv("WINDDESK_DATA_SOURCE", DATA_SOURCE_SNAPSHOT).lower()
    if data_source not in VALID_DATA_SOURCES:
        raise ValueError(
            f"WINDDESK_DATA_SOURCE must be one of {VALID_DATA_SOURCES}, got {data_source!r}"
        )

    decision_start = _env_date("WINDDESK_DECISION_START", "2026-01-01")
    decision_end = _env_date("WINDDESK_DECISION_END", "2026-01-31")
    history_start = _env_date("WINDDESK_HISTORY_START", "2025-12-01")
    if not history_start <= decision_start <= decision_end:
        raise ValueError("Expected history_start <= decision_start <= decision_end")

    band_window_days = int(os.getenv("WINDDESK_BAND_WINDOW_DAYS", "28"))
    if band_window_days < 1:
        raise ValueError("WINDDESK_BAND_WINDOW_DAYS must be >= 1")

    origins = os.getenv("WINDDESK_CORS_ORIGINS", "http://localhost:5173,http://localhost:8080")
    return Settings(
        data_source=data_source,
        snapshot_dir=Path(os.getenv("WINDDESK_SNAPSHOT_DIR", str(DEFAULT_SNAPSHOT_DIR))),
        elexon_base_url=os.getenv(
            "WINDDESK_ELEXON_BASE_URL", "https://data.elexon.co.uk/bmrs/api/v1"
        ),
        elexon_timeout_s=float(os.getenv("WINDDESK_ELEXON_TIMEOUT_S", "30")),
        decision_start=decision_start,
        decision_end=decision_end,
        history_start=history_start,
        band_window_days=band_window_days,
        cors_origins=tuple(o.strip() for o in origins.split(",") if o.strip()),
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return load_settings()
