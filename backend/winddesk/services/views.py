"""Read models returned by the services and serialised by the API layer."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime

from winddesk.domain.bands import Coverage
from winddesk.domain.metrics import ErrorStats, HistogramBin


@dataclass(frozen=True)
class MarketView:
    id: str
    name: str
    venue: str
    gate_closure: str
    product: str


@dataclass(frozen=True)
class MetaView:
    data_source: str
    retrieved_at: datetime
    decision_start: date
    decision_end: date
    delivery_dates: list[date]
    markets: list[MarketView]
    default_market: str
    default_bid_lead_minutes: int
    band_window_days: int
    timezone: str


@dataclass(frozen=True)
class SeriesPoint:
    start_time: datetime
    generation: float


@dataclass(frozen=True)
class DecisionHour:
    start_time: datetime
    horizon_h: float
    forecast: float
    adjusted: float | None
    p10: float | None
    p90: float | None
    actual: float | None
    error: float | None


@dataclass(frozen=True)
class Vintage:
    publish_time: datetime
    is_decision: bool
    after_cutoff: bool
    points: list[SeriesPoint]


@dataclass(frozen=True)
class BandView:
    q10: float
    q50: float
    q90: float
    samples: int
    window_days: int


@dataclass(frozen=True)
class DecisionSummary:
    forecast_energy_mwh: float
    adjusted_energy_mwh: float | None
    low_energy_mwh: float | None
    high_energy_mwh: float | None
    actual_energy_mwh: float | None
    mean_forecast_mw: float
    peak_forecast_mw: float
    min_forecast_mw: float
    stats: ErrorStats | None
    adjusted_stats: ErrorStats | None
    coverage: Coverage | None


@dataclass(frozen=True)
class DecisionView:
    delivery_date: date
    decision_date: date
    market: MarketView
    bid_lead_minutes: int
    gate_closure: datetime
    cutoff: datetime
    delivery_start: datetime
    delivery_end: datetime
    forecast_publish_time: datetime | None
    forecast_age_minutes: float | None
    band: BandView | None
    hours: list[DecisionHour]
    actuals_half_hourly: list[SeriesPoint]
    vintages: list[Vintage]
    summary: DecisionSummary | None


@dataclass(frozen=True)
class BucketStats:
    key: float
    label: str
    stats: ErrorStats


@dataclass(frozen=True)
class DailyAccuracy:
    delivery_date: date
    forecast_energy_mwh: float
    adjusted_energy_mwh: float | None
    actual_energy_mwh: float
    mae: float
    bias: float


@dataclass(frozen=True)
class MarketComparison:
    market: MarketView
    horizon_min_h: float
    horizon_max_h: float
    stats: ErrorStats


@dataclass(frozen=True)
class AccuracyView:
    market: MarketView
    bid_lead_minutes: int
    first_delivery: date
    last_delivery: date
    decision_horizon_min_h: float
    decision_horizon_max_h: float
    overall: ErrorStats | None
    overall_adjusted: ErrorStats | None
    mean_actual_mw: float
    coverage: Coverage | None
    by_horizon: list[BucketStats]
    by_hour_of_day: list[BucketStats]
    by_forecast_level: list[BucketStats]
    histogram: list[HistogramBin]
    daily: list[DailyAccuracy]
    market_comparison: list[MarketComparison]


@dataclass(frozen=True)
class ExplorerForecastPoint:
    start_time: datetime
    publish_time: datetime
    horizon_h: float
    generation: float
    actual: float | None


@dataclass(frozen=True)
class ExplorerView:
    start: datetime
    end: datetime
    min_horizon_h: float
    actuals: list[SeriesPoint]
    forecasts: list[ExplorerForecastPoint]
    stats: ErrorStats | None
