import type { Accuracy, Decision, Explorer, Meta } from './types'

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? ''

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function readDetail(res: Response): Promise<string> {
  try {
    const body: unknown = await res.json()
    if (body && typeof body === 'object' && 'detail' in body) {
      const detail = (body as { detail: unknown }).detail
      if (typeof detail === 'string') return detail
      return 'The request was not valid.'
    }
  } catch {
    // fall through to the generic message
  }
  return `Request failed (${res.status})`
}

export async function getJson<T>(
  path: string,
  params: Record<string, string | number> = {},
  signal?: AbortSignal,
): Promise<T> {
  const query = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)]),
  ).toString()
  const url = `${API_BASE}${path}${query ? `?${query}` : ''}`
  let res: Response
  try {
    res = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new ApiError(0, 'Cannot reach the Wind Desk API. Check your connection.')
  }
  if (!res.ok) throw new ApiError(res.status, await readDetail(res))
  return (await res.json()) as T
}

export const api = {
  meta: (signal?: AbortSignal) => getJson<Meta>('/api/meta', {}, signal),
  decision: (
    p: { deliveryDate: string; market: string; bidLeadMinutes: number },
    signal?: AbortSignal,
  ) => getJson<Decision>('/api/decision', p, signal),
  accuracy: (p: { market: string; bidLeadMinutes: number }, signal?: AbortSignal) =>
    getJson<Accuracy>('/api/accuracy', p, signal),
  explorer: (p: { start: string; end: string; minHorizonH: number }, signal?: AbortSignal) =>
    getJson<Explorer>('/api/explorer', p, signal),
}
