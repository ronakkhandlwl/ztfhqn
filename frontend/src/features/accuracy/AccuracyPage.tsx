import { useAccuracy, useMeta } from '../../api/queries'
import type { Accuracy } from '../../api/types'
import { Card } from '../../components/Card'
import { MarketControls } from '../../components/MarketControls'
import { ErrorPanel, Loading } from '../../components/States'
import { Tile } from '../../components/Tile'
import { hours, mw, pct, power, signedGw, signedPower } from '../../lib/format'
import { formatDate } from '../../lib/time'
import { useDeskParams } from '../../lib/useDeskParams'
import {
  DailyEnergyChart,
  HistogramChart,
  HorizonChart,
  HourOfDayChart,
  LevelChart,
} from './AccuracyCharts'
import { bestMarket, highWindBias, lowWindBias, maeReduction } from './accuracyModel'

function Insights({ a }: { a: Accuracy }) {
  const o = a.overall
  if (!o) return null
  const reduction = maeReduction(a)
  const best = bestMarket(a.marketComparison)
  const current = a.marketComparison.find((m) => m.market.id === a.market.id)
  const high = highWindBias(a)
  const low = lowWindBias(a)
  return (
    <div className="insights">
      <div className="insight">
        <b>Over-forecast {pct(o.overForecastShare, 0)} of hours</b>
        The bid-time forecast ran {signedPower(o.bias)} high on average —{' '}
        {pct(o.bias / a.meanActualMw, 0)} of mean outturn. Planning on the raw number leaves a
        systematic shortfall to buy back.
      </div>
      {reduction !== null && a.overallAdjusted && (
        <div className="insight">
          <b>Bias-adjusting cuts error {pct(reduction, 0)}</b>
          Correcting with only the errors known at bid time drops MAE from {power(o.mae)} to{' '}
          {power(a.overallAdjusted.mae)} per hour.
        </div>
      )}
      {a.coverage && (
        <div className="insight">
          <b>80% range held {pct(a.coverage.inside, 0)} of hours</b>
          Walk-forward calibrated: {pct(a.coverage.belowLow, 0)} fell below the low case,{' '}
          {pct(a.coverage.aboveHigh, 0)} above the high case.
        </div>
      )}
      {high !== null && low !== null && (
        <div className="insight">
          <b>Errors grow in high wind</b>
          When the forecast is 16 GW or more the bias is {signedPower(high)}, versus{' '}
          {signedPower(low)} below — consistent with output curtailed on windy days.
        </div>
      )}
      {best && current && best.market.id !== current.market.id && (
        <div className="insight">
          <b>Later auction, {pct(1 - best.stats.mae / current.stats.mae, 0)} less error</b>
          {best.market.name} (gate {best.market.gateClosure}) bids on a fresher forecast: MAE{' '}
          {power(best.stats.mae)} vs {power(current.stats.mae)}.
        </div>
      )}
    </div>
  )
}

function MarketTable({ a }: { a: Accuracy }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col">Auction</th>
            <th scope="col">Gate (UK)</th>
            <th scope="col">Lead times</th>
            <th scope="col">MAE</th>
            <th scope="col">RMSE</th>
            <th scope="col">Bias</th>
            <th scope="col">WAPE</th>
            <th scope="col">P90 error</th>
          </tr>
        </thead>
        <tbody>
          {a.marketComparison.map((m) => (
            <tr key={m.market.id} style={m.market.id === a.market.id ? { fontWeight: 650 } : undefined}>
              <td>{m.market.name}</td>
              <td>{m.market.gateClosure}</td>
              <td>
                {hours(m.horizonMinH)} – {hours(m.horizonMaxH)}
              </td>
              <td>{mw(m.stats.mae)}</td>
              <td>{mw(m.stats.rmse)}</td>
              <td>{signedPower(m.stats.bias)}</td>
              <td>{pct(m.stats.wape)}</td>
              <td>{signedPower(m.stats.p90)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function AccuracyPage() {
  const meta = useMeta()
  const { market, bidLeadMinutes, update } = useDeskParams(meta.data)
  const accuracy = useAccuracy(market, bidLeadMinutes)

  if (meta.isPending) return <Loading />
  if (meta.isError) return <ErrorPanel error={meta.error} onRetry={() => meta.refetch()} />

  const a = accuracy.data
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Forecast accuracy</h1>
          <p>
            How good was the forecast the desk actually bid on? Every delivery day with a decision
            in January 2026, scored against metered wind outturn.
          </p>
        </div>
        <div className="controls">
          <MarketControls meta={meta.data} market={market} bidLeadMinutes={bidLeadMinutes} onChange={update} />
        </div>
      </div>
      {accuracy.isPending && <Loading />}
      {accuracy.isError && <ErrorPanel error={accuracy.error} onRetry={() => accuracy.refetch()} />}
      {a && a.overall && (
        <div className="grid" style={{ opacity: accuracy.isPlaceholderData ? 0.6 : 1 }}>
          <Insights a={a} />
          <div className="grid grid--tiles">
            <Tile label="Mean absolute error" value={power(a.overall.mae)} note={`${pct(a.overall.wape)} of outturn (WAPE) · ${a.overall.n} hours`} />
            <Tile label="Bias (forecast − outturn)" value={signedPower(a.overall.bias)} note="Positive = forecast too high" />
            <Tile label="RMSE" value={power(a.overall.rmse)} note={`Worst hour ${power(a.overall.maxAbs)}`} />
            <Tile
              accent
              label="Bias-adjusted MAE"
              value={power(a.overallAdjusted?.mae)}
              note={`Bias left ${signedPower(a.overallAdjusted?.bias)}`}
            />
            <Tile
              label="Error range (P10 – P90)"
              value={`${signedGw(a.overall.p10).replace(' GW', '')} to ${signedGw(a.overall.p90)}`}
              note="80% of hourly errors fall here"
            />
          </div>
          <Card
            title="Daily wind energy: forecast vs plan-to vs outturn"
            subtitle={`Delivery days ${formatDate(a.firstDelivery)} – ${formatDate(a.lastDelivery)}. Hover a day for detail.`}
          >
            <DailyEnergyChart daily={a.daily} />
          </Card>
          <div className="grid grid--2">
            <Card
              title="Error vs forecast lead time"
              subtitle={`All WINDFOR runs for these delivery days, 0–48 h ahead. Shaded: lead times behind day-ahead bids (${hours(a.decisionHorizonMinH)}–${hours(a.decisionHorizonMaxH)}).`}
            >
              <HorizonChart data={a} />
            </Card>
            <Card
              title="Error vs forecast wind level"
              subtitle="Day-ahead forecasts grouped by forecast value (GW). High-wind hours carry the largest over-forecast."
            >
              <LevelChart data={a} />
            </Card>
            <Card
              title="Distribution of hourly errors"
              subtitle="Day-ahead forecast minus outturn, 500 MW bins. Skewed right: shortfalls dominate."
            >
              <HistogramChart bins={a.histogram} />
            </Card>
            <Card title="Error by delivery hour" subtitle="Day-ahead MAE and bias by hour of day (UK time).">
              <HourOfDayChart data={a} />
            </Card>
          </div>
          <Card
            title="Auction comparison"
            subtitle="Same delivery days, scored for each GB day-ahead auction's bid cutoff. Bold: selected auction."
          >
            <MarketTable a={a} />
          </Card>
        </div>
      )}
    </>
  )
}
