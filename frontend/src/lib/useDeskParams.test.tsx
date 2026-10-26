import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { meta } from '../test/fixtures'
import { useDeskParams } from './useDeskParams'

function at(path: string) {
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
  )
}

describe('useDeskParams', () => {
  it('reads valid selections from the URL', () => {
    const { result } = renderHook(() => useDeskParams(meta), {
      wrapper: at('/?market=epex-half-hourly&lead=60&date=2026-01-03'),
    })
    expect(result.current).toMatchObject({
      market: 'epex-half-hourly',
      bidLeadMinutes: 60,
      deliveryDate: '2026-01-03',
    })
  })

  it.each(['/?lead=', '/?lead=%20', '/?lead=7', '/?lead=abc'])(
    'falls back to the default lead for %s',
    (path) => {
      const { result } = renderHook(() => useDeskParams(meta), { wrapper: at(path) })
      expect(result.current.bidLeadMinutes).toBe(30)
    },
  )

  it('ignores unknown markets and out-of-scope dates', () => {
    const { result } = renderHook(() => useDeskParams(meta), {
      wrapper: at('/?market=nope&date=2027-01-01'),
    })
    expect(result.current.market).toBe('epex-hourly')
    expect(result.current.deliveryDate).toBe('2026-01-02')
  })

  it('accepts lead 0 when explicitly set', () => {
    const { result } = renderHook(() => useDeskParams(meta), { wrapper: at('/?lead=0') })
    expect(result.current.bidLeadMinutes).toBe(0)
  })
})
