"""Thin client for the Elexon BMRS Insights API (no API key required).

Datasets used:
* FUELHH  - half-hourly outturn generation by fuel type (we keep fuelType == WIND)
* WINDFOR - national wind generation forecast, hourly targets, ~8 runs per day
Requests are chunked so each call stays small, and transient failures are retried.
"""

from __future__ import annotations

import logging
import time
from collections.abc import Iterator
from datetime import UTC, date, datetime, timedelta
from typing import Any

import httpx
import pandas as pd

from winddesk.domain.frames import (
    GENERATION,
    PUBLISH_TIME,
    START_TIME,
    normalise_actuals,
    normalise_forecasts,
)

logger = logging.getLogger(__name__)

FUELHH_PATH = "/datasets/FUELHH/stream"
WINDFOR_PATH = "/datasets/WINDFOR/stream"
WIND_FUEL_TYPE = "WIND"
CHUNK_DAYS = 7
MAX_ATTEMPTS = 3
RETRY_BACKOFF_S = 1.0


class ElexonError(RuntimeError):
    pass


def _date_chunks(start: date, end: date, days: int = CHUNK_DAYS) -> Iterator[tuple[date, date]]:
    """Inclusive [start, end] split into inclusive chunks of at most ``days`` days."""
    cursor = start
    while cursor <= end:
        chunk_end = min(cursor + timedelta(days=days - 1), end)
        yield cursor, chunk_end
        cursor = chunk_end + timedelta(days=1)


def _iso_z(value: datetime) -> str:
    return value.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


class ElexonClient:
    def __init__(
        self,
        base_url: str,
        timeout_s: float = 30.0,
        http: httpx.Client | None = None,
        backoff_s: float = RETRY_BACKOFF_S,
    ) -> None:
        self._http = http or httpx.Client(base_url=base_url, timeout=timeout_s)
        self._backoff_s = backoff_s

    def close(self) -> None:
        self._http.close()

    def _get_records(self, path: str, params: dict[str, Any]) -> list[dict[str, Any]]:
        last_error: Exception | None = None
        for attempt in range(1, MAX_ATTEMPTS + 1):
            try:
                response = self._http.get(path, params=params)
                response.raise_for_status()
                payload = response.json()
            except (httpx.HTTPError, ValueError) as exc:
                last_error = exc
                logger.warning("Elexon %s attempt %d failed: %s", path, attempt, exc)
                if attempt < MAX_ATTEMPTS:
                    time.sleep(self._backoff_s * attempt)
                continue
            if isinstance(payload, dict):  # some endpoints wrap results in {"data": [...]}
                payload = payload.get("data", [])
            if not isinstance(payload, list):
                raise ElexonError(f"Unexpected payload type from {path}: {type(payload)}")
            return payload
        raise ElexonError(f"Elexon request to {path} failed: {last_error}") from last_error

    def fetch_wind_actuals(self, settlement_from: date, settlement_to: date) -> pd.DataFrame:
        rows: list[dict[str, Any]] = []
        for chunk_start, chunk_end in _date_chunks(settlement_from, settlement_to):
            records = self._get_records(
                FUELHH_PATH,
                {
                    "settlementDateFrom": chunk_start.isoformat(),
                    "settlementDateTo": chunk_end.isoformat(),
                    "fuelType": WIND_FUEL_TYPE,
                },
            )
            rows.extend(
                {START_TIME: r.get("startTime"), GENERATION: r.get("generation")}
                for r in records
                if r.get("fuelType", WIND_FUEL_TYPE) == WIND_FUEL_TYPE
            )
        return normalise_actuals(pd.DataFrame(rows, columns=[START_TIME, GENERATION]))

    def fetch_wind_forecasts(self, publish_from: date, publish_to: date) -> pd.DataFrame:
        """All forecast runs published on days publish_from..publish_to (inclusive, UTC)."""
        rows: list[dict[str, Any]] = []
        for chunk_start, chunk_end in _date_chunks(publish_from, publish_to):
            start_dt = datetime.combine(chunk_start, datetime.min.time(), tzinfo=UTC)
            end_dt = datetime.combine(chunk_end, datetime.max.time(), tzinfo=UTC)
            records = self._get_records(
                WINDFOR_PATH,
                {
                    "publishDateTimeFrom": _iso_z(start_dt),
                    "publishDateTimeTo": _iso_z(end_dt.replace(microsecond=0)),
                },
            )
            rows.extend(
                {
                    PUBLISH_TIME: r.get("publishTime"),
                    START_TIME: r.get("startTime"),
                    GENERATION: r.get("generation"),
                }
                for r in records
            )
        return normalise_forecasts(
            pd.DataFrame(rows, columns=[PUBLISH_TIME, START_TIME, GENERATION])
        )
