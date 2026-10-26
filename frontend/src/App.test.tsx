import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import App from './App'
import { accuracy, decision, meta } from './test/fixtures'

beforeAll(() => {
  // Recharts' ResponsiveContainer needs ResizeObserver, which jsdom lacks.
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

afterEach(() => vi.restoreAllMocks())

function mockApi() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input)
    const body = url.startsWith('/api/meta')
      ? meta
      : url.startsWith('/api/decision')
        ? decision()
        : url.startsWith('/api/accuracy')
          ? accuracy
          : null
    return body
      ? new Response(JSON.stringify(body), { status: 200 })
      : new Response(JSON.stringify({ detail: 'Not found' }), { status: 404 })
  })
}

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('App', () => {
  it('renders the decision desk with the bid-time story and tiles', async () => {
    mockApi()
    renderAt('/?date=2026-01-03')
    expect(await screen.findByText(/Bids for EPEX GB Day-Ahead \(hourly\) closed at 09:20/)).toBeInTheDocument()
    expect(screen.getByText('Plan-to wind (P50)')).toBeInTheDocument()
    expect(screen.getByText('30.0 GWh')).toBeInTheDocument()
    const context = screen.getByLabelText('Decision context')
    expect(within(context).getByText('08:50')).toBeInTheDocument()
  })

  it('requests the selected market when the auction changes', async () => {
    const fetchMock = mockApi()
    renderAt('/')
    const select = await screen.findByLabelText('Auction')
    await userEvent.selectOptions(select, 'epex-half-hourly')
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('market=epex-half-hourly'))).toBe(true)
  })

  it('hides outturn when toggled off', async () => {
    mockApi()
    renderAt('/?date=2026-01-03')
    await screen.findByText('Outturn (hindsight)')
    await userEvent.click(screen.getByLabelText('Show outturn'))
    expect(screen.queryByText('Outturn (hindsight)')).not.toBeInTheDocument()
  })

  it('renders accuracy insights', async () => {
    mockApi()
    renderAt('/accuracy')
    expect(await screen.findByText(/Bias-adjusting cuts error 28%/)).toBeInTheDocument()
    expect(screen.getByText(/Later auction, 7% less error/)).toBeInTheDocument()
    expect(screen.getByText('Auction comparison')).toBeInTheDocument()
  })

  it('shows an error panel when the API fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Service unavailable' }), { status: 503 }),
    )
    renderAt('/')
    expect(await screen.findByRole('alert')).toHaveTextContent('Service unavailable')
  })

  it('renders the methodology page', async () => {
    mockApi()
    renderAt('/methodology')
    expect(await screen.findByText(/Which forecast was available at decision time/)).toBeInTheDocument()
  })
})
