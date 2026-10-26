import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from './client'

// Served data is historical and immutable per deployment: cache aggressively.
const STALE_FOREVER = Number.POSITIVE_INFINITY

export function useMeta() {
  return useQuery({
    queryKey: ['meta'],
    queryFn: ({ signal }) => api.meta(signal),
    staleTime: STALE_FOREVER,
  })
}

export function useDecision(deliveryDate: string | undefined, market: string, bidLeadMinutes: number) {
  return useQuery({
    queryKey: ['decision', deliveryDate, market, bidLeadMinutes],
    queryFn: ({ signal }) =>
      api.decision({ deliveryDate: deliveryDate as string, market, bidLeadMinutes }, signal),
    enabled: Boolean(deliveryDate),
    staleTime: STALE_FOREVER,
    placeholderData: keepPreviousData,
  })
}

export function useAccuracy(market: string, bidLeadMinutes: number, enabled = true) {
  return useQuery({
    queryKey: ['accuracy', market, bidLeadMinutes],
    queryFn: ({ signal }) => api.accuracy({ market, bidLeadMinutes }, signal),
    enabled,
    staleTime: STALE_FOREVER,
    placeholderData: keepPreviousData,
  })
}

export function useExplorer(start: string, end: string, minHorizonH: number, enabled = true) {
  return useQuery({
    queryKey: ['explorer', start, end, minHorizonH],
    queryFn: ({ signal }) => api.explorer({ start, end, minHorizonH }, signal),
    enabled,
    staleTime: STALE_FOREVER,
    placeholderData: keepPreviousData,
  })
}
