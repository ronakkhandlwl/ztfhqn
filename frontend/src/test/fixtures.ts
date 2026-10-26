import type { ChartTooltipProps } from '../components/ChartTooltip'
import type { Accuracy, Decision, ErrorStats, Meta } from '../api/types'

export const stats = (overrides: Partial<ErrorStats> = {}): ErrorStats => ({
  n: 24,
  mae: 2000,
  rmse: 2500,
  bias: 1500,
  wape: 0.18,
  p10: -400,
  p50: 1500,
  p90: 4000,
  maxAbs: 6000,
  overForecastShare: 0.85,
  ...overrides,
})

export const meta: Meta = {
  dataSource: 'snapshot',
  retrievedAt: '2026-10-26T01:31:04Z',
  decisionStart: '2026-01-01',
  decisionEnd: '2026-01-31',
  deliveryDates: ['2026-01-02', '2026-01-03', '2026-01-04'],
  markets: [
    { id: 'epex-hourly', name: 'EPEX GB Day-Ahead (hourly)', venue: 'EPEX SPOT', gateClosure: '09:20', product: '60-min' },
    { id: 'epex-half-hourly', name: 'EPEX GB Day-Ahead (half-hourly)', venue: 'EPEX SPOT', gateClosure: '15:30', product: '30-min' },
  ],
  defaultMarket: 'epex-hourly',
  defaultBidLeadMinutes: 30,
  bandWindowDays: 28,
  timezone: 'Europe/London',
}

export function decision(overrides: Partial<Decision> = {}): Decision {
  return {
    deliveryDate: '2026-01-03',
    decisionDate: '2026-01-02',
    market: meta.markets[0],
    bidLeadMinutes: 30,
    gateClosure: '2026-01-02T09:20:00Z',
    cutoff: '2026-01-02T08:50:00Z',
    deliveryStart: '2026-01-02T23:00:00Z',
    deliveryEnd: '2026-01-03T23:00:00Z',
    forecastPublishTime: '2026-01-02T07:30:00Z',
    forecastAgeMinutes: 80,
    band: { q10: -500, q50: 1000, q90: 3000, samples: 600, windowDays: 28 },
    hours: [
      { startTime: '2026-01-02T23:00:00Z', horizonH: 15.5, forecast: 10000, adjusted: 9000, p10: 7000, p90: 10500, actual: 6000, error: 4000 },
      { startTime: '2026-01-03T00:00:00Z', horizonH: 16.5, forecast: 11000, adjusted: 10000, p10: 8000, p90: 11500, actual: 9000, error: 2000 },
      { startTime: '2026-01-03T01:00:00Z', horizonH: 17.5, forecast: 9000, adjusted: null, p10: null, p90: null, actual: null, error: null },
    ],
    actualsHalfHourly: [
      { startTime: '2026-01-02T23:00:00Z', generation: 6000 },
      { startTime: '2026-01-02T23:30:00Z', generation: 6100 },
      { startTime: '2026-01-03T00:00:00Z', generation: 9000 },
    ],
    vintages: [
      { publishTime: '2026-01-02T04:30:00Z', isDecision: false, afterCutoff: false, points: [{ startTime: '2026-01-02T23:00:00Z', generation: 10200 }] },
      { publishTime: '2026-01-02T07:30:00Z', isDecision: true, afterCutoff: false, points: [{ startTime: '2026-01-02T23:00:00Z', generation: 10000 }] },
      { publishTime: '2026-01-02T09:30:00Z', isDecision: false, afterCutoff: true, points: [{ startTime: '2026-01-02T23:00:00Z', generation: 9500 }] },
    ],
    summary: {
      forecastEnergyMwh: 30000,
      adjustedEnergyMwh: 19000,
      lowEnergyMwh: 15000,
      highEnergyMwh: 22000,
      actualEnergyMwh: 15000,
      meanForecastMw: 10000,
      peakForecastMw: 11000,
      minForecastMw: 9000,
      stats: stats({ n: 2, mae: 3000 }),
      adjustedStats: stats({ n: 2, mae: 2000 }),
      coverage: { nominal: 0.8, inside: 0.5, belowLow: 0.5, aboveHigh: 0, samples: 2 },
    },
    ...overrides,
  }
}

const bucket = (key: number, label: string, bias: number, n = 10) => ({
  key,
  label,
  stats: stats({ bias, n }),
})

export const accuracy: Accuracy = {
  market: meta.markets[0],
  bidLeadMinutes: 30,
  firstDelivery: '2026-01-02',
  lastDelivery: '2026-02-01',
  decisionHorizonMinH: 15.5,
  decisionHorizonMaxH: 38.5,
  overall: stats({ n: 744, mae: 2019, bias: 1747 }),
  overallAdjusted: stats({ n: 744, mae: 1445, bias: 686 }),
  meanActualMw: 11300,
  coverage: { nominal: 0.8, inside: 0.86, belowLow: 0.1, aboveHigh: 0.04, samples: 744 },
  byHorizon: [bucket(0, '0-1 h', 1400), bucket(1, '1-2 h', 1450)],
  byHourOfDay: [bucket(0, '00:00', 1800), bucket(1, '01:00', 1900)],
  byForecastLevel: [bucket(8000, '8-10 GW', 1000, 30), bucket(16000, '16-18 GW', 2000, 10), bucket(18000, '18-20 GW', 4000, 10)],
  histogram: [
    { lower: -500, upper: 0, count: 3 },
    { lower: 0, upper: 500, count: 7 },
  ],
  daily: [
    { deliveryDate: '2026-01-02', forecastEnergyMwh: 400000, adjustedEnergyMwh: 380000, actualEnergyMwh: 360000, mae: 2000, bias: 1500 },
  ],
  marketComparison: [
    { market: meta.markets[0], horizonMinH: 15.5, horizonMaxH: 38.5, stats: stats({ mae: 2019 }) },
    { market: meta.markets[1], horizonMinH: 10.5, horizonMaxH: 34.5, stats: stats({ mae: 1880 }) },
  ],
}

/** Minimal props Recharts would pass to a custom tooltip renderer. */
export function tooltipProps(rows: unknown[], active = true): ChartTooltipProps {
  return { active, payload: rows.map((payload) => ({ payload })) } as unknown as ChartTooltipProps
}
