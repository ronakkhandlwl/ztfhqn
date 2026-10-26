"""FastAPI dependencies. The analytics service is built once per process."""

from __future__ import annotations

from functools import lru_cache

from winddesk.config import get_settings
from winddesk.data.repository import load_dataset
from winddesk.services.analytics import WindAnalytics


@lru_cache(maxsize=1)
def get_analytics() -> WindAnalytics:
    settings = get_settings()
    return WindAnalytics(load_dataset(settings), settings)
