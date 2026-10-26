import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api, getJson } from './client'

afterEach(() => vi.restoreAllMocks())

describe('api client', () => {
  it('builds query strings and parses JSON', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    )
    await api.decision({ deliveryDate: '2026-01-03', market: 'epex-hourly', bidLeadMinutes: 30 })
    expect(fetchMock.mock.calls[0][0]).toBe(
      '/api/decision?deliveryDate=2026-01-03&market=epex-hourly&bidLeadMinutes=30',
    )
  })

  it('surfaces the API detail message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Delivery date out of range' }), { status: 404 }),
    )
    await expect(getJson('/api/decision')).rejects.toMatchObject({
      status: 404,
      message: 'Delivery date out of range',
    })
  })

  it('falls back to a generic message for validation errors and non-JSON bodies', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: [{ msg: 'x' }] }), { status: 422 }))
      .mockResolvedValueOnce(new Response('oops', { status: 502 }))
    await expect(getJson('/api/x')).rejects.toThrow('The request was not valid.')
    await expect(getJson('/api/x')).rejects.toThrow('Request failed (502)')
  })

  it('maps network failures to a friendly ApiError', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))
    const err = await getJson('/api/meta').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).status).toBe(0)
  })
})
