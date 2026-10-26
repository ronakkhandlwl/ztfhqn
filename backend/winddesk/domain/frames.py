"""Canonical column names and schema checks for the two input tables.

forecasts: one row per (publish_time, start_time) with the forecast generation in MW.
actuals:   one row per settlement period start_time with metered generation in MW.
All timestamps are timezone-aware UTC.
"""

from __future__ import annotations

import pandas as pd

PUBLISH_TIME = "publish_time"
START_TIME = "start_time"
GENERATION = "generation"
HORIZON_H = "horizon_h"

FORECAST_COLUMNS = (PUBLISH_TIME, START_TIME, GENERATION)
ACTUAL_COLUMNS = (START_TIME, GENERATION)


class SchemaError(ValueError):
    pass


def _require_columns(df: pd.DataFrame, columns: tuple[str, ...], name: str) -> None:
    missing = [c for c in columns if c not in df.columns]
    if missing:
        raise SchemaError(f"{name} is missing columns {missing}")


def _to_utc(series: pd.Series) -> pd.Series:
    """Parse ISO-8601 strings/datetimes to UTC; unparseable values become NaT."""
    return pd.to_datetime(series, utc=True, errors="coerce", format="ISO8601")


def normalise_forecasts(df: pd.DataFrame) -> pd.DataFrame:
    """Coerce types, drop invalid rows, de-duplicate and add the forecast horizon."""
    _require_columns(df, FORECAST_COLUMNS, "forecasts")
    out = pd.DataFrame(
        {
            PUBLISH_TIME: _to_utc(df[PUBLISH_TIME]),
            START_TIME: _to_utc(df[START_TIME]),
            GENERATION: pd.to_numeric(df[GENERATION], errors="coerce"),
        }
    )
    out = out.dropna()
    out = out[out[GENERATION] >= 0]
    out = out.drop_duplicates(subset=[PUBLISH_TIME, START_TIME], keep="last")
    out[HORIZON_H] = (out[START_TIME] - out[PUBLISH_TIME]).dt.total_seconds() / 3600.0
    return out.sort_values([PUBLISH_TIME, START_TIME]).reset_index(drop=True)


def normalise_actuals(df: pd.DataFrame) -> pd.DataFrame:
    _require_columns(df, ACTUAL_COLUMNS, "actuals")
    out = pd.DataFrame(
        {
            START_TIME: _to_utc(df[START_TIME]),
            GENERATION: pd.to_numeric(df[GENERATION], errors="coerce"),
        }
    )
    out = out.dropna()
    out = out[out[GENERATION] >= 0]
    out = out.drop_duplicates(subset=[START_TIME], keep="last")
    return out.sort_values(START_TIME).reset_index(drop=True)
