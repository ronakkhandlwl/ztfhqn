import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Accuracy, BucketStats, DailyAccuracy, HistogramBin } from '../../api/types'
import { TooltipBox, type ChartTooltipProps } from '../../components/ChartTooltip'
import { Legend } from '../../components/Legend'
import { energy, gwTick, mw, pct, signedPower } from '../../lib/format'
import { AXIS_TICK, COLORS } from '../../lib/palette'
import { niceScale } from '../../lib/scale'
import { formatDate, formatDateShort } from '../../lib/time'

const BAR_RADIUS: [number, number, number, number] = [4, 4, 0, 0]
const MARGIN = { top: 8, right: 16, bottom: 0, left: 0 }

function bucketTooltip(titleFor: (b: BucketStats) => string) {
  return function BucketTooltip({ active, payload }: ChartTooltipProps) {
    if (!active || !payload?.length) return null
    const b = payload[0].payload as BucketStats
    return (
      <TooltipBox
        title={titleFor(b)}
        rows={[
          { label: 'Mean abs. error', value: mw(b.stats.mae), color: COLORS.forecast },
          { label: 'Bias (mean error)', value: signedPower(b.stats.bias), color: COLORS.over },
          { label: 'Over-forecast hours', value: pct(b.stats.overForecastShare, 0) },
          { label: 'Samples', value: String(b.stats.n) },
        ]}
      />
    )
  }
}

const statsAccessors = {
  mae: (b: BucketStats) => b.stats.mae,
  bias: (b: BucketStats) => b.stats.bias,
}

function bucketScale(buckets: BucketStats[]) {
  return niceScale(buckets.flatMap((b) => [b.stats.mae, b.stats.bias]), 4)
}

export function HorizonChart({ data }: { data: Accuracy }) {
  const y = bucketScale(data.byHorizon)
  return (
    <>
      <Legend
        items={[
          { label: 'Mean absolute error', color: COLORS.forecast },
          { label: 'Bias (forecast − outturn)', color: COLORS.over },
          { label: 'Lead times used for day-ahead bids', color: COLORS.band, kind: 'band' },
        ]}
      />
      <div className="chart chart--short" style={{ marginTop: 12 }}>
        <ResponsiveContainer>
          <LineChart data={data.byHorizon} margin={MARGIN}>
            <CartesianGrid stroke={COLORS.grid} vertical={false} />
            <XAxis
              dataKey="key"
              type="number"
              domain={[0, 48]}
              ticks={[0, 6, 12, 18, 24, 30, 36, 42, 48]}
              tickFormatter={(v: number) => `${v} h`}
              tick={AXIS_TICK}
              stroke={COLORS.axis}
            />
            <YAxis domain={y.domain} ticks={y.ticks} tickFormatter={gwTick} tick={AXIS_TICK} stroke={COLORS.axis} width={64} />
            <ReferenceArea
              x1={Math.floor(data.decisionHorizonMinH)}
              x2={Math.ceil(data.decisionHorizonMaxH)}
              fill={COLORS.band}
              fillOpacity={0.08}
            />
            <Tooltip content={bucketTooltip((b) => `Forecast made ${b.label} ahead`)} />
            <Line dataKey={statsAccessors.mae} name="MAE" stroke={COLORS.forecast} strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line dataKey={statsAccessors.bias} name="Bias" stroke={COLORS.over} strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  )
}

export function LevelChart({ data }: { data: Accuracy }) {
  const y = bucketScale(data.byForecastLevel)
  return (
    <>
      <Legend
        items={[
          { label: 'Mean absolute error', color: COLORS.forecast, kind: 'box' },
          { label: 'Bias (forecast − outturn)', color: COLORS.over, kind: 'box' },
        ]}
      />
      <div className="chart chart--short" style={{ marginTop: 12 }}>
        <ResponsiveContainer>
          <BarChart data={data.byForecastLevel} margin={MARGIN} barGap={2}>
            <CartesianGrid stroke={COLORS.grid} vertical={false} />
            <XAxis dataKey="label" tickFormatter={(l: string) => l.replace(' GW', '')} tick={AXIS_TICK} stroke={COLORS.axis} interval={0} />
            <YAxis domain={y.domain} ticks={y.ticks} tickFormatter={gwTick} tick={AXIS_TICK} stroke={COLORS.axis} width={64} />
            <ReferenceLine y={0} stroke={COLORS.axis} />
            <Tooltip content={bucketTooltip((b) => `Forecast ${b.label}`)} cursor={{ fill: 'var(--surface-2)' }} />
            <Bar dataKey={statsAccessors.mae} fill={COLORS.forecast} radius={BAR_RADIUS} maxBarSize={22} isAnimationActive={false} />
            <Bar dataKey={statsAccessors.bias} fill={COLORS.over} radius={BAR_RADIUS} maxBarSize={22} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  )
}

export function HourOfDayChart({ data }: { data: Accuracy }) {
  const y = bucketScale(data.byHourOfDay)
  return (
    <>
      <Legend
        items={[
          { label: 'Mean absolute error', color: COLORS.forecast },
          { label: 'Bias', color: COLORS.over },
        ]}
      />
      <div className="chart chart--short" style={{ marginTop: 12 }}>
        <ResponsiveContainer>
          <LineChart data={data.byHourOfDay} margin={MARGIN}>
            <CartesianGrid stroke={COLORS.grid} vertical={false} />
            <XAxis dataKey="label" tick={AXIS_TICK} stroke={COLORS.axis} interval={2} />
            <YAxis domain={y.domain} ticks={y.ticks} tickFormatter={gwTick} tick={AXIS_TICK} stroke={COLORS.axis} width={64} />
            <Tooltip content={bucketTooltip((b) => `Delivery hour ${b.label}`)} />
            <Line dataKey={statsAccessors.mae} stroke={COLORS.forecast} strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line dataKey={statsAccessors.bias} stroke={COLORS.over} strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  )
}

function HistogramTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  const b = payload[0].payload as HistogramBin
  return (
    <TooltipBox
      title={`${signedPower(b.lower)} to ${signedPower(b.upper)}`}
      rows={[{ label: 'Hours', value: String(b.count) }]}
    />
  )
}

export function HistogramChart({ bins }: { bins: HistogramBin[] }) {
  const rows = bins.map((b) => ({ ...b, mid: (b.lower + b.upper) / 2 }))
  return (
    <>
      <Legend
        items={[
          { label: 'Over-forecast (shortfall to cover)', color: COLORS.over, kind: 'box' },
          { label: 'Under-forecast (surplus wind)', color: COLORS.under, kind: 'box' },
        ]}
      />
      <div className="chart chart--short" style={{ marginTop: 12 }}>
        <ResponsiveContainer>
          <BarChart data={rows} margin={MARGIN} barCategoryGap={2}>
            <CartesianGrid stroke={COLORS.grid} vertical={false} />
            <XAxis dataKey="mid" tickFormatter={(v: number) => gwTick(v)} tick={AXIS_TICK} stroke={COLORS.axis} interval="preserveStartEnd" />
            <YAxis tick={AXIS_TICK} stroke={COLORS.axis} width={40} allowDecimals={false} />
            <Tooltip content={HistogramTooltip} cursor={{ fill: 'var(--surface-2)' }} />
            <Bar dataKey="count" radius={BAR_RADIUS} isAnimationActive={false}>
              {rows.map((r) => (
                <Cell key={r.lower} fill={r.mid >= 0 ? COLORS.over : COLORS.under} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  )
}

function DailyTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload as DailyAccuracy
  return (
    <TooltipBox
      title={`Delivery ${formatDate(d.deliveryDate)}`}
      rows={[
        { label: 'Forecast at bid time', value: energy(d.forecastEnergyMwh), color: COLORS.forecast },
        { label: 'Plan-to (P50)', value: energy(d.adjustedEnergyMwh), color: COLORS.adjusted },
        { label: 'Outturn', value: energy(d.actualEnergyMwh), color: COLORS.actual },
        { label: 'Mean abs. error', value: mw(d.mae) },
      ]}
    />
  )
}

export function DailyEnergyChart({ daily }: { daily: DailyAccuracy[] }) {
  const y = niceScale(daily.flatMap((d) => [d.forecastEnergyMwh, d.actualEnergyMwh]), 4)
  return (
    <>
      <Legend
        items={[
          { label: 'Forecast at bid time', color: COLORS.forecast, kind: 'box' },
          { label: 'Plan-to (bias-adjusted P50)', color: COLORS.adjusted, kind: 'box' },
          { label: 'Metered outturn', color: COLORS.actual, kind: 'box' },
        ]}
      />
      <div className="chart" style={{ marginTop: 12 }}>
        <ResponsiveContainer>
          <BarChart data={daily} margin={MARGIN} barGap={1} barCategoryGap="18%">
            <CartesianGrid stroke={COLORS.grid} vertical={false} />
            <XAxis dataKey="deliveryDate" tickFormatter={(d: string) => formatDateShort(d)} tick={AXIS_TICK} stroke={COLORS.axis} interval={2} />
            <YAxis domain={y.domain} ticks={y.ticks} tickFormatter={(v: number) => `${Math.round(v / 1000)} GWh`} tick={AXIS_TICK} stroke={COLORS.axis} width={72} />
            <Tooltip content={DailyTooltip} cursor={{ fill: 'var(--surface-2)' }} />
            <Bar dataKey="forecastEnergyMwh" fill={COLORS.forecast} radius={BAR_RADIUS} maxBarSize={10} isAnimationActive={false} />
            <Bar dataKey="adjustedEnergyMwh" fill={COLORS.adjusted} radius={BAR_RADIUS} maxBarSize={10} isAnimationActive={false} />
            <Bar dataKey="actualEnergyMwh" fill={COLORS.actual} radius={BAR_RADIUS} maxBarSize={10} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  )
}
