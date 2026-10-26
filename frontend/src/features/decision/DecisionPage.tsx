import { useState } from 'react'
import { useDecision, useMeta } from '../../api/queries'
import type { Decision, Meta } from '../../api/types'
import { Card } from '../../components/Card'
import { MarketControls } from '../../components/MarketControls'
import { ErrorPanel, Loading } from '../../components/States'
import { Tile } from '../../components/Tile'
import { energy, hours, minutesToText, pctChange, power } from '../../lib/format'
import { COLORS } from '../../lib/palette'
import { addDays, formatDate, formatDayTime, formatTime } from '../../lib/time'
import { useDeskParams } from '../../lib/useDeskParams'
import { DecisionChart } from './DecisionChart'
import { decisionStory, hindsightStory, outsideBandHours } from './decisionModel'
import { EvolutionChart } from './EvolutionChart'
import { HourlyTable } from './HourlyTable'

function DateStepper({
  meta,
  value,
  onChange,
}: {
  meta: Meta
  value: string
  onChange: (date: string) => void
}) {
  const idx = meta.deliveryDates.indexOf(value)
  return (
    <label className="field">
      Delivery day
      <span className="stepper">
        <button
          type="button"
          className="icon-btn"
          aria-label="Previous delivery day"
          disabled={idx <= 0}
          onClick={() => onChange(meta.deliveryDates[idx - 1])}
        >
          ‹
        </button>
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          {meta.deliveryDates.map((d) => (
            <option key={d} value={d}>
              {formatDate(d)}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="icon-btn"
          aria-label="Next delivery day"
          disabled={idx >= meta.deliveryDates.length - 1}
          onClick={() => onChange(meta.deliveryDates[idx + 1])}
        >
          ›
        </button>
      </span>
    </label>
  )
}

function ContextStrip({ d }: { d: Decision }) {
  const horizons = d.hours.map((h) => h.horizonH)
  const items = [
    { label: 'Decision day', value: formatDate(d.decisionDate) },
    { label: 'Gate closure', value: `${formatTime(d.gateClosure)} (${d.market.venue})` },
    { label: 'Bids finalised', value: formatTime(d.cutoff) },
    {
      label: 'Forecast used',
      value: d.forecastPublishTime
        ? `${formatDayTime(d.forecastPublishTime)} · ${minutesToText(d.forecastAgeMinutes)} old`
        : 'None available',
    },
    {
      label: 'Delivery window',
      value: `${formatDayTime(d.deliveryStart)} → ${formatTime(d.deliveryEnd)}`,
    },
    {
      label: 'Lead time',
      value: horizons.length
        ? `${hours(Math.min(...horizons))} – ${hours(Math.max(...horizons))}`
        : '—',
    },
  ]
  return (
    <div className="context" aria-label="Decision context">
      {items.map((i) => (
        <div className="context__item" key={i.label}>
          <span className="context__label">{i.label}</span>
          <span className="context__value">{i.value}</span>
        </div>
      ))}
    </div>
  )
}

function SummaryTiles({ d, showActual }: { d: Decision; showActual: boolean }) {
  const s = d.summary
  if (!s) return null
  const actualChange = pctChange(s.forecastEnergyMwh, s.actualEnergyMwh)
  const outside = outsideBandHours(d)
  return (
    <div className="grid grid--tiles">
      <Tile
        label="Forecast at bid time"
        swatch={COLORS.forecast}
        value={energy(s.forecastEnergyMwh)}
        note={`Avg ${power(s.meanForecastMw)} · peak ${power(s.peakForecastMw)} · min ${power(s.minForecastMw)}`}
      />
      <Tile
        accent
        label="Plan-to wind (P50)"
        swatch={COLORS.adjusted}
        value={energy(s.adjustedEnergyMwh)}
        note={
          s.adjustedEnergyMwh === null
            ? 'Needs more error history'
            : `${pctChange(s.forecastEnergyMwh, s.adjustedEnergyMwh)} vs raw forecast, from recent bias`
        }
      />
      <Tile
        label="80% planning range"
        value={
          s.lowEnergyMwh === null
            ? '—'
            : `${energy(s.lowEnergyMwh).replace(' GWh', '')}–${energy(s.highEnergyMwh)}`
        }
        note="Low-wind P10 to high-wind P90 case"
      />
      {showActual && (
        <Tile
          label="Outturn (hindsight)"
          swatch={COLORS.actual}
          value={energy(s.actualEnergyMwh)}
          note={
            s.actualEnergyMwh === null
              ? 'Not yet metered'
              : `${actualChange} vs forecast · ${outside.below + outside.above}/${outside.total} h outside range`
          }
        />
      )}
    </div>
  )
}

export function DecisionPage() {
  const meta = useMeta()
  const { market, bidLeadMinutes, deliveryDate, update } = useDeskParams(meta.data)
  const decision = useDecision(deliveryDate, market, bidLeadMinutes)
  const [showActual, setShowActual] = useState(true)

  if (meta.isPending) return <Loading />
  if (meta.isError) return <ErrorPanel error={meta.error} onRetry={() => meta.refetch()} />
  const m = meta.data

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Decision desk</h1>
          <p>
            The wind forecast your team could act on before each day-ahead auction, turned into a
            plan-to number and a planning range using recent forecast errors.
          </p>
        </div>
        <div className="controls">
          {deliveryDate && (
            <DateStepper meta={m} value={deliveryDate} onChange={(date) => update({ date })} />
          )}
          <MarketControls meta={m} market={market} bidLeadMinutes={bidLeadMinutes} onChange={update} />
          <label className="toggle">
            <input
              type="checkbox"
              checked={showActual}
              onChange={(e) => setShowActual(e.target.checked)}
            />
            Show outturn
          </label>
        </div>
      </div>

      {decision.isPending && <Loading />}
      {decision.isError && <ErrorPanel error={decision.error} onRetry={() => decision.refetch()} />}
      {decision.data && (
        <div className="grid" style={{ opacity: decision.isPlaceholderData ? 0.6 : 1 }}>
          <ContextStrip d={decision.data} />
          <div className="callout">
            <p>{decisionStory(decision.data)}</p>
            {showActual && hindsightStory(decision.data) && (
              <p style={{ marginTop: 6 }} className="muted">
                {hindsightStory(decision.data)}
              </p>
            )}
          </div>
          <SummaryTiles d={decision.data} showActual={showActual} />
          <Card
            title={`Wind for delivery ${formatDate(decision.data.deliveryDate)}`}
            subtitle="Hourly national wind forecast available at bid time, with the bias-adjusted plan-to line and 80% range from the trailing error history."
          >
            <DecisionChart decision={decision.data} showActual={showActual} />
          </Card>
          <Card
            title="How the forecast evolved"
            subtitle="Every WINDFOR run covering this delivery day. Runs after the cutoff show what you would have learned too late to bid on."
          >
            <EvolutionChart decision={decision.data} />
          </Card>
          <Card title="Hourly detail" subtitle="Values per delivery hour (MW, hourly average).">
            <details>
              <summary>Show table ({decision.data.hours.length} hours)</summary>
              <div style={{ marginTop: 12 }}>
                <HourlyTable decision={decision.data} />
              </div>
            </details>
          </Card>
          {deliveryDate && (
            <p className="muted" style={{ fontSize: 12 }}>
              Tip: use ‹ › to step through days. Shareable link includes your selections.{' '}
              {m.deliveryDates.includes(addDays(deliveryDate, 1)) ? '' : 'Last day in scope.'}
            </p>
          )}
        </div>
      )}
    </>
  )
}
