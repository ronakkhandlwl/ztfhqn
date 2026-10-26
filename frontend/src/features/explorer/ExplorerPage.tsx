import { useDeferredValue, useState } from 'react'
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useExplorer } from '../../api/queries'
import { Card } from '../../components/Card'
import { TooltipBox, type ChartTooltipProps } from '../../components/ChartTooltip'
import { Legend } from '../../components/Legend'
import { ErrorPanel, Loading } from '../../components/States'
import { Tile } from '../../components/Tile'
import { gwTick, hours, mw, pct, power, signedPower } from '../../lib/format'
import { AXIS_TICK, COLORS } from '../../lib/palette'
import { niceScale } from '../../lib/scale'
import { addDays, formatDayTime, formatShortDay, toMs } from '../../lib/time'
import { buildExplorerRows, type ExplorerRow } from './explorerModel'

const MIN_DATE = '2026-01-01'
const MAX_DATE = '2026-02-01'
const MAX_SPAN_DAYS = 31

export function ExplorerTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  const r = payload[0].payload as ExplorerRow
  const rows = []
  if (r.actual !== undefined) rows.push({ label: 'Outturn', value: mw(r.actual), color: COLORS.actual })
  if (r.forecast !== undefined) {
    rows.push({ label: 'Forecast', value: mw(r.forecast), color: COLORS.forecast })
    rows.push({ label: 'Published', value: formatDayTime(r.publishTime as string) })
    rows.push({ label: 'Lead time', value: hours(r.horizonH) })
  }
  return <TooltipBox title={formatDayTime(r.t)} rows={rows} />
}

/** Midnight UK on a calendar date, as an ISO instant (January: UK = UTC). */
function ukMidnight(isoDate: string): string {
  return `${isoDate}T00:00:00Z`
}

export function ExplorerPage() {
  const [startDate, setStartDate] = useState(MIN_DATE)
  const [endDate, setEndDate] = useState('2026-01-31')
  const [horizon, setHorizon] = useState(24)
  const deferredHorizon = useDeferredValue(horizon)

  const validRange = startDate <= endDate && startDate >= MIN_DATE && endDate <= MAX_DATE
  const query = useExplorer(
    ukMidnight(startDate),
    ukMidnight(addDays(endDate, 1)),
    deferredHorizon,
    validRange,
  )

  const data = query.data
  const rows = data ? buildExplorerRows(data) : []
  const y = niceScale(rows.flatMap((r) => [r.actual, r.forecast]))
  const span = Math.round(
    (Date.parse(ukMidnight(endDate)) - Date.parse(ukMidnight(startDate))) / 86_400_000,
  )

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Horizon explorer</h1>
          <p>
            For every target hour, show the latest forecast that was published at least{' '}
            <strong>{horizon} h</strong> before it — and see how accuracy changes as you demand
            more notice.
          </p>
        </div>
        <div className="controls">
          <label className="field">
            From
            <input
              type="date"
              min={MIN_DATE}
              max={endDate}
              value={startDate}
              onChange={(e) => e.target.value && setStartDate(e.target.value)}
            />
          </label>
          <label className="field">
            To
            <input
              type="date"
              min={startDate}
              max={MAX_DATE}
              value={endDate}
              onChange={(e) => {
                const v = e.target.value
                if (!v) return
                setEndDate(v > addDays(startDate, MAX_SPAN_DAYS) ? addDays(startDate, MAX_SPAN_DAYS) : v)
              }}
            />
          </label>
          <label className="field range">
            Minimum forecast lead time: {horizon} h
            <input
              type="range"
              min={0}
              max={48}
              step={1}
              value={horizon}
              onChange={(e) => setHorizon(Number(e.target.value))}
              aria-valuetext={`${horizon} hours`}
            />
          </label>
        </div>
      </div>

      {!validRange && <div className="callout callout--warn">Choose a range within 1 Jan – 1 Feb 2026.</div>}
      {validRange && query.isPending && <Loading />}
      {query.isError && <ErrorPanel error={query.error} onRetry={() => query.refetch()} />}
      {data && (
        <div className="grid" style={{ opacity: query.isPlaceholderData ? 0.6 : 1 }}>
          <div className="grid grid--tiles">
            <Tile label="Mean absolute error" value={power(data.stats?.mae)} note={`${pct(data.stats?.wape)} of outturn`} />
            <Tile label="Bias (forecast − outturn)" value={signedPower(data.stats?.bias)} note={`Over-forecast ${pct(data.stats?.overForecastShare, 0)} of hours`} />
            <Tile label="RMSE" value={power(data.stats?.rmse)} />
            <Tile label="Hours compared" value={String(data.stats?.n ?? 0)} note={`${span + 1} days · hourly targets`} />
          </div>
          <Card
            title={`Outturn vs forecast made ≥ ${data.minHorizonH} h ahead`}
            subtitle={`${formatShortDay(data.start)} – ${formatShortDay(toMs(data.end) - 1)}. Outturn is half-hourly (FUELHH); forecasts are hourly (WINDFOR).`}
          >
            <Legend
              items={[
                { label: 'Metered outturn', color: COLORS.actual },
                { label: `Forecast (≥ ${data.minHorizonH} h lead)`, color: COLORS.forecast },
              ]}
            />
            <div className="chart" style={{ marginTop: 12 }}>
              <ResponsiveContainer>
                <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={COLORS.grid} vertical={false} />
                  <XAxis
                    dataKey="t"
                    type="number"
                    scale="time"
                    domain={['dataMin', 'dataMax']}
                    tickFormatter={(t: number) => formatShortDay(t)}
                    tick={AXIS_TICK}
                    stroke={COLORS.axis}
                    minTickGap={40}
                  />
                  <YAxis domain={y.domain} ticks={y.ticks} tickFormatter={gwTick} tick={AXIS_TICK} stroke={COLORS.axis} width={64} />
                  <Tooltip content={ExplorerTooltip} />
                  <Line dataKey="actual" stroke={COLORS.actual} strokeWidth={1.75} dot={false} connectNulls isAnimationActive={false} />
                  <Line dataKey="forecast" stroke={COLORS.forecast} strokeWidth={1.75} dot={false} connectNulls isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}
    </>
  )
}
