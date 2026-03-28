import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

beforeAll(() => {
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
})

vi.mock('../src/lib/supabase', () => {
  return { supabase: { rpc: vi.fn(), from: vi.fn() } }
})

import Overview from '../src/pages/Overview'
import { supabase } from '../src/lib/supabase'

function makeFromChain(resolveData = []) {
  return {
    select: vi.fn().mockReturnThis(),
    eq:     vi.fn().mockReturnThis(),
    not:    vi.fn().mockReturnThis(),
    gte:    vi.fn().mockReturnThis(),
    lt:     vi.fn().mockReturnThis(),
    then:   vi.fn(cb => Promise.resolve(cb({ data: resolveData }))),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  supabase.rpc.mockReturnValue(new Promise(() => {}))
  supabase.from.mockReturnValue(makeFromChain())
})

describe('Overview', () => {
  it('shows loading state initially', () => {
    render(<Overview />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('shows empty state when no category data', async () => {
    supabase.rpc.mockResolvedValue({ data: [], error: null })
    supabase.from.mockReturnValue(makeFromChain([]))
    render(<Overview />)
    await waitFor(() =>
      expect(screen.getByText(/no data yet/i)).toBeInTheDocument()
    )
  })

  it('renders Bills, Discretionary, Income, Cashflow sections after load', async () => {
    supabase.rpc.mockResolvedValue({
      data: [
        { period: '2025-01', category: 'Mortgage', total: 1200 },
        { period: '2025-01', category: 'Groceries', total: 300 },
      ],
      error: null,
    })
    supabase.from.mockReturnValue(
      makeFromChain([{ date: '2025-01-25', amount: 4000 }])
    )
    render(<Overview />)
    await waitFor(() => expect(screen.getByText('Bills & Fixed')).toBeInTheDocument())
    expect(screen.getByText('Discretionary')).toBeInTheDocument()
    expect(screen.getByText('Income')).toBeInTheDocument()
    expect(screen.getByText('Cashflow')).toBeInTheDocument()
    expect(screen.queryByText('Transfers')).not.toBeInTheDocument()
  })

  it('renders breakdown bucket selector buttons', async () => {
    supabase.rpc.mockResolvedValue({
      data: [{ period: '2025-01', category: 'Groceries', total: 300 }],
      error: null,
    })
    supabase.from.mockReturnValue(makeFromChain([{ date: '2025-01-25', amount: 4000 }]))
    render(<Overview />)
    await waitFor(() => expect(screen.getByText('Discretionary')).toBeInTheDocument())
    // Bucket selector buttons should be present
    expect(screen.getByRole('button', { name: /bills & fixed/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /transients/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /income/i })).toBeInTheDocument()
  })

  it('shows cashflow math breakdown (Income, Bills & Fixed, Discretionary lines)', async () => {
    supabase.rpc.mockResolvedValue({
      data: [
        { period: '2025-01', category: 'Mortgage', total: 1200 },
        { period: '2025-01', category: 'Groceries', total: 300 },
      ],
      error: null,
    })
    supabase.from.mockReturnValue(makeFromChain([{ date: '2025-01-25', amount: 4000 }]))
    render(<Overview />)
    await waitFor(() => expect(screen.getByText('Cashflow')).toBeInTheDocument())
    expect(screen.getByText('= Cashflow')).toBeInTheDocument()
  })
})
