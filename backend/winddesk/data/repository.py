"""Loads the wind dataset from a bundled snapshot or live from Elexon.

The January 2026 decision window is historical, so production serves a versioned
snapshot (fast cold starts, no runtime dependency on a third-party API). The live
source exists to refresh the snapshot and to point the app at other periods.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Protocol

import pandas as pd

from winddesk.config import DATA_SOURCE_ELEXON, Settings
from winddesk.data.elexon import ElexonClient
from winddesk.domain.frames import normalise_actuals, normalise_forecasts

logger = logging.getLogger(__name__)

ACTUALS_FILE = "fuelhh_wind.csv.gz"
FORECASTS_FILE = "windfor.csv.gz"
MANIFEST_FILE = "manifest.json"


@dataclass(frozen=True)
class WindDataset:
    actuals: pd.DataFrame
    forecasts: pd.DataFrame
    source: str
    retrieved_at: datetime


class DatasetSource(Protocol):
    def load(self) -> WindDataset: ...


class SnapshotSource:
    def __init__(self, directory: Path) -> None:
        self._dir = directory

    def load(self) -> WindDataset:
        actuals_path = self._dir / ACTUALS_FILE
        forecasts_path = self._dir / FORECASTS_FILE
        if not actuals_path.exists() or not forecasts_path.exists():
            raise FileNotFoundError(f"Snapshot files not found in {self._dir}")
        manifest_path = self._dir / MANIFEST_FILE
        retrieved_at = datetime.now(UTC)
        if manifest_path.exists():
            manifest = json.loads(manifest_path.read_text())
            retrieved_at = datetime.fromisoformat(manifest["retrieved_at"])
        return WindDataset(
            actuals=normalise_actuals(pd.read_csv(actuals_path)),
            forecasts=normalise_forecasts(pd.read_csv(forecasts_path)),
            source="snapshot",
            retrieved_at=retrieved_at,
        )


class ElexonSource:
    """Fetches exactly the data the analysis window needs."""

    def __init__(self, client: ElexonClient, settings: Settings) -> None:
        self._client = client
        self._settings = settings

    def load(self) -> WindDataset:
        s = self._settings
        # Forecast runs: from the start of calibration history to the last decision day.
        forecasts = self._client.fetch_wind_forecasts(s.history_start, s.decision_end)
        # Actuals: history start to the end of the last delivery day (+1 day margin).
        actuals = self._client.fetch_wind_actuals(
            s.history_start, s.decision_end + timedelta(days=2)
        )
        return WindDataset(
            actuals=actuals,
            forecasts=forecasts,
            source="elexon",
            retrieved_at=datetime.now(UTC),
        )


def write_snapshot(dataset: WindDataset, directory: Path) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    dataset.actuals.to_csv(directory / ACTUALS_FILE, index=False, date_format="%Y-%m-%dT%H:%M:%SZ")
    dataset.forecasts.drop(columns=["horizon_h"]).to_csv(
        directory / FORECASTS_FILE, index=False, date_format="%Y-%m-%dT%H:%M:%SZ"
    )
    manifest = {
        "retrieved_at": dataset.retrieved_at.isoformat(),
        "source": dataset.source,
        "actual_rows": len(dataset.actuals),
        "forecast_rows": len(dataset.forecasts),
        "actual_range": [
            dataset.actuals["start_time"].min().isoformat(),
            dataset.actuals["start_time"].max().isoformat(),
        ],
        "forecast_publish_range": [
            dataset.forecasts["publish_time"].min().isoformat(),
            dataset.forecasts["publish_time"].max().isoformat(),
        ],
    }
    (directory / MANIFEST_FILE).write_text(json.dumps(manifest, indent=2) + "\n")


def load_dataset(settings: Settings, client: ElexonClient | None = None) -> WindDataset:
    """Live source when configured, falling back to the snapshot if Elexon is unavailable."""
    snapshot = SnapshotSource(settings.snapshot_dir)
    if settings.data_source != DATA_SOURCE_ELEXON:
        return snapshot.load()
    live_client = client or ElexonClient(settings.elexon_base_url, settings.elexon_timeout_s)
    try:
        return ElexonSource(live_client, settings).load()
    except Exception:
        logger.exception("Live Elexon load failed; falling back to bundled snapshot")
        return snapshot.load()
