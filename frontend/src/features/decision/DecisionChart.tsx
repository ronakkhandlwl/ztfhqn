import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Decision } from '../../api/types'
import { TooltipBox, type ChartTooltipProps } from '../../components/ChartTooltip'
import { Legend } from '../../components/Legend'
import { gwTick, mw } from '../../lib/format'
import { AXIS_TICK, COLORS } from '../../lib/palette'
import { niceScale } from '../../lib/scale'
import { formatDayTime, formatTime, toMs } from '../../lib/time'
import { buildDecisionRows, type DecisionRow } from './decisionModel'

export function DecisionTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload as DecisionRow
  const rows = []
  if (row.forecast !== undefined)
    rows.push({ label: 'Forecast (bid time)', value: mw(row.forecast), color: COLORS.forecast })
  if (row.adjusted !== undefined)
    rows.push({ label: 'Plan-to (P50)', value: mw(row.adjusted), color: COLORS.adjusted })
  if (row.band)
    rows.push({ label: '80% range', value: `${mw(row.band[0])} – ${mw(row.band[1])}` })
  if (row.actual !== undefined)
    rows.push({ label: 'Outturn', value: mw(row.actual), color: COLORS.actual })
  return <TooltipBox title={formatDayTime(row.t)} rows={rows} />
}

export function DecisionChart({ decision, showActual }: { decision: Decision; showActual: boolean }) {
  const rows = buildDecisionRows(decision, showActual)
  const start = toMs(decision.deliveryStart)
  const end = toMs(decision.deliveryEnd)
  const ticks = Array.from({ length: 9 }, (_, i) => start + i * 3 * 3600_000).filter((t) => t <= end)
  const hasBand = rows.some((r) => r.band)
  const y = niceScale(rows.flatMap((r) => [r.forecast, r.actual, r.band?.[1]]))

  return (
    <>
      <Legend
        items={[
          { label: 'Forecast at bid time', color: COLORS.forecast },
          ...(hasBand
            ? [
                { label: 'Plan-to wind (bias-adjusted P50)', color: COLORS.adjusted, kind: 'dashed' as const },
                { label: '80% planning range (P10–P90)', color: COLORS.band, kind: 'band' as const },
              ]
            : []),
          ...(showActual ? [{ label: 'Metered outturn (hindsight)', color: COLORS.actual }] : []),
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
              domain={[start, end]}
              ticks={ticks}
              tickFormatter={(t: number) => formatTime(t)}
              tick={AXIS_TICK}
              stroke={COLORS.axis}
            />
            <YAxis domain={y.domain} ticks={y.ticks} tickFormatter={gwTick} tick={AXIS_TICK} stroke={COLORS.axis} width={64} />
            <Tooltip content={DecisionTooltip} />
            {hasBand && (
              <Area
                dataKey="band"
                stroke="none"
                fill={COLORS.band}
                fillOpacity={0.14}
                connectNulls
                isAnimationActive={false}
                activeDot={false}
              />
            )}
            <Line
              dataKey="forecast"
              stroke={COLORS.forecast}
              strokeWidth={2.5}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
            {hasBand && (
              <Line
                dataKey="adjusted"
                stroke={COLORS.adjusted}
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            )}
            {showActual && (
              <Line
                dataKey="actual"
                stroke={COLORS.actual}
                strokeWidth={2}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </>
  )
}
