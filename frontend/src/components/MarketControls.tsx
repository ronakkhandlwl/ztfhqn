import type { Meta } from '../api/types'
import { BID_LEAD_OPTIONS } from '../lib/useDeskParams'

interface Props {
  meta: Meta
  market: string
  bidLeadMinutes: number
  onChange: (patch: { market?: string; lead?: string }) => void
}

export function MarketControls({ meta, market, bidLeadMinutes, onChange }: Props) {
  return (
    <>
      <label className="field">
        Auction
        <select value={market} onChange={(e) => onChange({ market: e.target.value })}>
          {meta.markets.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} · gate {m.gateClosure}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Bids finalised
        <select
          value={bidLeadMinutes}
          onChange={(e) => onChange({ lead: e.target.value })}
        >
          {BID_LEAD_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {m === 0 ? 'At gate closure' : `${m} min before gate`}
            </option>
          ))}
        </select>
      </label>
    </>
  )
}
