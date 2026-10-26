"""Refresh the bundled data snapshot from the Elexon BMRS API.

Usage (from backend/):  uv run python -m scripts.build_snapshot
"""

from __future__ import annotations

import logging

from winddesk.config import load_settings
from winddesk.data.elexon import ElexonClient
from winddesk.data.repository import ElexonSource, write_snapshot

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("build_snapshot")


def main() -> None:
    settings = load_settings()
    client = ElexonClient(settings.elexon_base_url, settings.elexon_timeout_s)
    try:
        dataset = ElexonSource(client, settings).load()
    finally:
        client.close()
    write_snapshot(dataset, settings.snapshot_dir)
    logger.info(
        "Wrote %d actual rows and %d forecast rows to %s",
        len(dataset.actuals),
        len(dataset.forecasts),
        settings.snapshot_dir,
    )


if __name__ == "__main__":
    main()
