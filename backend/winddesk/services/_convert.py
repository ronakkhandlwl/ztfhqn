"""Small helpers for turning pandas values into JSON-friendly Python values."""

from __future__ import annotations

import math
from datetime import datetime
from typing import Any

import pandas as pd


def opt_float(value: Any) -> float | None:
    if value is None:
        return None
    number = float(value)
    return None if math.isnan(number) or math.isinf(number) else number


def to_datetime(value: Any) -> datetime:
    return pd.Timestamp(value).to_pydatetime()


def energy_mwh(hourly_mw: pd.Series) -> float | None:
    """Energy of hourly-average MW values (1 h each); None if nothing is known."""
    values = hourly_mw.dropna()
    return None if values.empty else float(values.sum())
