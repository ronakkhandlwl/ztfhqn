import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Meta } from '../api/types'

export interface DeskParams {
  market: string
  bidLeadMinutes: number
  deliveryDate: string | undefined
}

const LEAD_OPTIONS = [0, 15, 30, 60, 90, 120] as const
export const BID_LEAD_OPTIONS: readonly number[] = LEAD_OPTIONS

/**
 * Desk selections live in the URL so any view can be shared as a link.
 * Unknown or invalid values fall back to the API defaults.
 */
export function useDeskParams(meta: Meta | undefined) {
  const [search, setSearch] = useSearchParams()

  const marketParam = search.get('market')
  const market =
    meta && marketParam && meta.markets.some((m) => m.id === marketParam)
      ? marketParam
      : (meta?.defaultMarket ?? 'epex-hourly')

  const leadParam = Number(search.get('lead'))
  const bidLeadMinutes =
    search.has('lead') && BID_LEAD_OPTIONS.includes(leadParam)
      ? leadParam
      : (meta?.defaultBidLeadMinutes ?? 30)

  const dateParam = search.get('date')
  const deliveryDate =
    meta && dateParam && meta.deliveryDates.includes(dateParam)
      ? dateParam
      : meta?.deliveryDates[0]

  const update = useCallback(
    (patch: Partial<Record<'market' | 'lead' | 'date', string>>) => {
      setSearch(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [k, v] of Object.entries(patch)) {
            if (v === undefined) next.delete(k)
            else next.set(k, v)
          }
          return next
        },
        { replace: true },
      )
    },
    [setSearch],
  )

  return { market, bidLeadMinutes, deliveryDate, update }
}
