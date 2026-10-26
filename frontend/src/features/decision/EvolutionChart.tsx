import {
  CartesianGrid,
  Line,
  LineChart,
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
import { buildEvolution, vintageLabel, type EvolutionSeries } from './decisionModel'

const STYLE: Record<EvolutionSeries['role'], { stroke: string; width: number; dash?: string }> = {
  earlier: { stroke: COLORS.vintage, width: 1.25 },
  decision: { stroke: COLORS.forecast, width: 3 },
  later: { stroke: COLORS.vintageLate, width: 1.5, dash: '5 4' },
}

export function EvolutionChart({ decision }: { decision: Decision }) {
  const { rows, series } = buildEvolution(decision)
  const start = toMs(decision.deliveryStart)
  const end = toMs(decision.deliveryEnd)
  const ticks = Array.from({ length: 9 }, (_, i) => start + i * 3 * 3600_000).filter((t) => t <= end)
  const byKey = new Map(series.map((s) => [s.key, s]))
  const y = niceScale(rows.flatMap((r) => Object.entries(r).filter(([k]) => k !== 't').map(([, v]) => v)))
  // Draw decision run last so it sits on top.
  const ordered = [...series].sort((a, b) => Number(a.role === 'decision') - Number(b.role === 'decision'))

  function EvolutionTooltip({ active, payload, label }: ChartTooltipProps) {
    if (!active || !payload?.length) return null
    const items = payload
      .filter((p) => typeof p.value === 'number')
      .map((p) => {
        const s = byKey.get(String(p.dataKey))
        return {
          label: s ? `Run ${vintageLabel(s.publishTime)}${s.role === 'decision' ? ' (bid)' : ''}` : 'Outturn',
          value: mw(p.value as number),
          color: s ? STYLE[s.role].stroke : COLORS.actual,
          role: s?.role ?? 'actual',
        }
      })
      .filter((r) => r.role === 'decision' || r.role === 'actual' || r.role === 'later')
      .slice(-6)
    return <TooltipBox title={formatDayTime(label as number)} rows={items} />
  }

  return (
    <>
      <Legend
        items={[
          { label: 'Earlier runs', color: COLORS.vintage },
          { label: 'Run used for bids', color: COLORS.forecast },
          { label: 'Runs after the bid cutoff', color: COLORS.vintageLate, kind: 'dashed' },
          { label: 'Metered outturn', color: COLORS.actual },
        ]}
      />
      <div className="chart chart--short" style={{ marginTop: 12 }}>
        <ResponsiveContainer>
          <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
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
            <Tooltip content={EvolutionTooltip} />
            {ordered.map((s) => (
              <Line
                key={s.key}
                dataKey={s.key}
                stroke={STYLE[s.role].stroke}
                strokeWidth={STYLE[s.role].width}
                strokeDasharray={STYLE[s.role].dash}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            ))}
            <Line
              dataKey="actual"
              stroke={COLORS.actual}
              strokeWidth={2}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  )
}
