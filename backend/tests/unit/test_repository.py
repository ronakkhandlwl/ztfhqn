from dataclasses import replace
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from winddesk.config import Settings
from winddesk.data.elexon import ElexonError
from winddesk.data.repository import (
    ElexonSource,
    SnapshotSource,
    WindDataset,
    load_dataset,
    write_snapshot,
)


def test_snapshot_round_trip(dataset: WindDataset, tmp_path: Path) -> None:
    write_snapshot(dataset, tmp_path)
    loaded = SnapshotSource(tmp_path).load()
    assert loaded.source == "snapshot"
    assert loaded.retrieved_at == dataset.retrieved_at
    assert len(loaded.actuals) == len(dataset.actuals)
    assert len(loaded.forecasts) == len(dataset.forecasts)
    assert loaded.forecasts["horizon_h"].equals(dataset.forecasts["horizon_h"])


def test_snapshot_missing_files(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError):
        SnapshotSource(tmp_path / "missing").load()


def test_elexon_source_requests_history_and_delivery_margin(
    settings: Settings, dataset: WindDataset
) -> None:
    client = MagicMock()
    client.fetch_wind_forecasts.return_value = dataset.forecasts
    client.fetch_wind_actuals.return_value = dataset.actuals
    loaded = ElexonSource(client, settings).load()
    client.fetch_wind_forecasts.assert_called_once_with(
        settings.history_start, settings.decision_end
    )
    _, actual_to = client.fetch_wind_actuals.call_args.args
    assert (actual_to - settings.decision_end).days == 2
    assert loaded.source == "elexon"


def test_load_dataset_defaults_to_snapshot(
    settings: Settings, dataset: WindDataset, tmp_path: Path
) -> None:
    write_snapshot(dataset, tmp_path)
    assert load_dataset(settings).source == "snapshot"


def test_load_dataset_falls_back_when_live_fails(
    settings: Settings, dataset: WindDataset, tmp_path: Path
) -> None:
    write_snapshot(dataset, tmp_path)
    client = MagicMock()
    client.fetch_wind_forecasts.side_effect = ElexonError("down")
    live = replace(settings, data_source="elexon")
    assert load_dataset(live, client=client).source == "snapshot"


def test_load_dataset_live(settings: Settings, dataset: WindDataset) -> None:
    client = MagicMock()
    client.fetch_wind_forecasts.return_value = dataset.forecasts
    client.fetch_wind_actuals.return_value = dataset.actuals
    live = replace(settings, data_source="elexon")
    assert load_dataset(live, client=client).source == "elexon"
