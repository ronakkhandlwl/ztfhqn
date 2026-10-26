"""HTTP response contracts (camelCase JSON). Mirrors ``services.views``."""

from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class ApiModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
        frozen=True,
    )


class ErrorStatsOut(ApiModel):
    n: int
    mae: float
    rmse: float
    bias: float
    wape: float | None
    p10: float
    p50: float
    p90: float
    max_abs: float
    over_forecast_share: float


class CoverageOut(ApiModel):
    nominal: float
    inside: float
    below_low: float
    above_high: float
    samples: int


class HistogramBinOut(ApiModel):
    lower: float
    upper: float
    count: int


class MarketOut(ApiModel):
    id: str
    name: str
    venue: str
    gate_closure: str
    product: str


class MetaOut(ApiModel):
    data_source: str
    retrieved_at: datetime
    decision_start: date
    decision_end: date
    delivery_dates: list[date]
    markets: list[MarketOut]
    default_market: str
    default_bid_lead_minutes: int
    band_window_days: int
    timezone: str


class SeriesPointOut(ApiModel):
    start_time: datetime
    generation: float


class DecisionHourOut(ApiModel):
    start_time: datetime
    horizon_h: float
    forecast: float
    adjusted: float | None
    p10: float | None
    p90: float | None
    actual: float | None
    error: float | None


class VintageOut(ApiModel):
    publish_time: datetime
    is_decision: bool
    after_cutoff: bool
    points: list[SeriesPointOut]


class BandOut(ApiModel):
    q10: float
    q50: float
    q90: float
    samples: int
    window_days: int


class DecisionSummaryOut(ApiModel):
    forecast_energy_mwh: float
    adjusted_energy_mwh: float | None
    low_energy_mwh: float | None
    high_energy_mwh: float | None
    actual_energy_mwh: float | None
    mean_forecast_mw: float
    peak_forecast_mw: float
    min_forecast_mw: float
    stats: ErrorStatsOut | None
    adjusted_stats: ErrorStatsOut | None
    coverage: CoverageOut | None


class DecisionOut(ApiModel):
    delivery_date: date
    decision_date: date
    market: MarketOut
    bid_lead_minutes: int
    gate_closure: datetime
    cutoff: datetime
    delivery_start: datetime
    delivery_end: datetime
    forecast_publish_time: datetime | None
    forecast_age_minutes: float | None
    band: BandOut | None
    hours: list[DecisionHourOut]
    actuals_half_hourly: list[SeriesPointOut]
    vintages: list[VintageOut]
    summary: DecisionSummaryOut | None


class BucketStatsOut(ApiModel):
    key: float
    label: str
    stats: ErrorStatsOut


class DailyAccuracyOut(ApiModel):
    delivery_date: date
    forecast_energy_mwh: float
    adjusted_energy_mwh: float | None
    actual_energy_mwh: float
    mae: float
    bias: float


class MarketComparisonOut(ApiModel):
    market: MarketOut
    horizon_min_h: float
    horizon_max_h: float
    stats: ErrorStatsOut


class AccuracyOut(ApiModel):
    market: MarketOut
    bid_lead_minutes: int
    first_delivery: date
    last_delivery: date
    decision_horizon_min_h: float
    decision_horizon_max_h: float
    overall: ErrorStatsOut | None
    overall_adjusted: ErrorStatsOut | None
    mean_actual_mw: float
    coverage: CoverageOut | None
    by_horizon: list[BucketStatsOut]
    by_hour_of_day: list[BucketStatsOut]
    by_forecast_level: list[BucketStatsOut]
    histogram: list[HistogramBinOut]
    daily: list[DailyAccuracyOut]
    market_comparison: list[MarketComparisonOut]


class ExplorerForecastOut(ApiModel):
    start_time: datetime
    publish_time: datetime
    horizon_h: float
    generation: float
    actual: float | None


class ExplorerOut(ApiModel):
    start: datetime
    end: datetime
    min_horizon_h: float
    actuals: list[SeriesPointOut]
    forecasts: list[ExplorerForecastOut]
    stats: ErrorStatsOut | None


class HealthOut(ApiModel):
    status: str
    data_source: str
    forecast_rows: int
    actual_rows: int


class ErrorOut(ApiModel):
    detail: str
