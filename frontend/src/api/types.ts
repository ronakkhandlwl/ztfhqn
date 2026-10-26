// Response contracts of the Wind Desk API (camelCase). Mirrors backend/winddesk/api/schemas.py.

export interface ErrorStats {
  n: number
  mae: number
  rmse: number
  bias: number
  wape: number | null
  p10: number
  p50: number
  p90: number
  maxAbs: number
  overForecastShare: number
}

export interface Coverage {
  nominal: number
  inside: number
  belowLow: number
  aboveHigh: number
  samples: number
}

export interface Market {
  id: string
  name: string
  venue: string
  gateClosure: string
  product: string
}

export interface Meta {
  dataSource: string
  retrievedAt: string
  decisionStart: string
  decisionEnd: string
  deliveryDates: string[]
  markets: Market[]
  defaultMarket: string
  defaultBidLeadMinutes: number
  bandWindowDays: number
  timezone: string
}

export interface SeriesPoint {
  startTime: string
  generation: number
}

export interface DecisionHour {
  startTime: string
  horizonH: number
  forecast: number
  adjusted: number | null
  p10: number | null
  p90: number | null
  actual: number | null
  error: number | null
}

export interface Vintage {
  publishTime: string
  isDecision: boolean
  afterCutoff: boolean
  points: SeriesPoint[]
}

export interface Band {
  q10: number
  q50: number
  q90: number
  samples: number
  windowDays: number
}

export interface DecisionSummary {
  forecastEnergyMwh: number
  adjustedEnergyMwh: number | null
  lowEnergyMwh: number | null
  highEnergyMwh: number | null
  actualEnergyMwh: number | null
  meanForecastMw: number
  peakForecastMw: number
  minForecastMw: number
  stats: ErrorStats | null
  adjustedStats: ErrorStats | null
  coverage: Coverage | null
}

export interface Decision {
  deliveryDate: string
  decisionDate: string
  market: Market
  bidLeadMinutes: number
  gateClosure: string
  cutoff: string
  deliveryStart: string
  deliveryEnd: string
  forecastPublishTime: string | null
  forecastAgeMinutes: number | null
  band: Band | null
  hours: DecisionHour[]
  actualsHalfHourly: SeriesPoint[]
  vintages: Vintage[]
  summary: DecisionSummary | null
}

export interface BucketStats {
  key: number
  label: string
  stats: ErrorStats
}

export interface DailyAccuracy {
  deliveryDate: string
  forecastEnergyMwh: number
  adjustedEnergyMwh: number | null
  actualEnergyMwh: number
  mae: number
  bias: number
}

export interface MarketComparison {
  market: Market
  horizonMinH: number
  horizonMaxH: number
  stats: ErrorStats
}

export interface HistogramBin {
  lower: number
  upper: number
  count: number
}

export interface Accuracy {
  market: Market
  bidLeadMinutes: number
  firstDelivery: string
  lastDelivery: string
  decisionHorizonMinH: number
  decisionHorizonMaxH: number
  overall: ErrorStats | null
  overallAdjusted: ErrorStats | null
  meanActualMw: number
  coverage: Coverage | null
  byHorizon: BucketStats[]
  byHourOfDay: BucketStats[]
  byForecastLevel: BucketStats[]
  histogram: HistogramBin[]
  daily: DailyAccuracy[]
  marketComparison: MarketComparison[]
}

export interface ExplorerForecast {
  startTime: string
  publishTime: string
  horizonH: number
  generation: number
  actual: number | null
}

export interface Explorer {
  start: string
  end: string
  minHorizonH: number
  actuals: SeriesPoint[]
  forecasts: ExplorerForecast[]
  stats: ErrorStats | null
}
