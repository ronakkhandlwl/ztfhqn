import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { Explorer } from '../../api/types'
import { stats, tooltipProps } from '../../test/fixtures'
import { ExplorerPage, ExplorerTooltip } from './ExplorerPage'
import { buildExplorerRows } from './explorerModel'

const payload: Explorer = {
  start: '2026-01-01T00:00:00Z',
  end: '2026-02-01T00:00:00Z',
  minHorizonH: 24,
  actuals: [
    { startTime: '2026-01-02T00:00:00Z', generation: 9000 },
    { startTime: '2026-01-02T00:30:00Z', generation: 9100 },
  ],
  forecasts: [
    { startTime: '2026-01-02T00:00:00Z', publishTime: '2026-01-01T00:00:00Z', horizonH: 24, generation: 10000, actual: 9000 },
  ],
  stats: stats({ n: 1, mae: 1000, bias: 1000 }),
}

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

afterEach(() => vi.restoreAllMocks())

describe('explorer', () => {
  it('merges outturn and forecast rows by time', () => {
    const rows = buildExplorerRows(payload)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ actual: 9000, forecast: 10000, horizonH: 24 })
    expect(rows[1].forecast).toBeUndefined()
  })

  it('renders a tooltip for a hovered row', () => {
    const row = buildExplorerRows(payload)[0]
    render(<ExplorerTooltip {...tooltipProps([row])} />)
    expect(screen.getByText('10,000 MW')).toBeInTheDocument()
    expect(screen.getByText('24.0 h')).toBeInTheDocument()
  })

  it('requests a new minimum lead time when the slider moves', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => new Response(JSON.stringify(payload), { status: 200 }))
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <ExplorerPage />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    expect(await screen.findByText('Hours compared')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('slider'), { target: { value: '6' } })
    await screen.findByText(/Minimum forecast lead time: 6 h/)
    await vi.waitFor(() =>
      expect(fetchMock.mock.calls.some(([u]) => String(u).includes('minHorizonH=6'))).toBe(true),
    )
  })

  it('does not query the API for an invalid range', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => new Response(JSON.stringify(payload), { status: 200 }))
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <ExplorerPage />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    await screen.findByText('Hours compared')
    fetchMock.mockClear()
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2025-12-01' } })
    expect(await screen.findByText(/Choose a range within/)).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
