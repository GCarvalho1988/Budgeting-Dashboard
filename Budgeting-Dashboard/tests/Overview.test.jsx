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

beforeEach(() => {
  vi.clearAllMocks()
  supabase.rpc.mockReturnValue(new Promise(() => {}))
  supabase.from.mockReturnValue({
    select: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    then: vi.fn().mockImplementation(cb => { cb({ data: [] }); return Promise.resolve() }),
  })
})

describe('Overview', () => {
  it('shows loading state initially', () => {
    render(<Overview />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('shows empty state when no category data', async () => {
    supabase.rpc.mockResolvedValue({ data: [], error: null })
    render(<Overview />)
    await waitFor(() =>
      expect(screen.getByText(/no data yet/i)).toBeInTheDocument()
    )
  })

  it('renders Bills, Discretionary, Income, Cashflow cards — no Transfers', async () => {
    supabase.rpc.mockImplementation((name) => {
      if (name === 'get_monthly_category_totals') {
        return Promise.resolve({
          data: [
            { period: '2025-01', category: 'Mortgage', total: 1200 },
            { period: '2025-01', category: 'Groceries', total: 300 },
          ],
          error: null,
        })
      }
      if (name === 'get_monthly_income') {
        return Promise.resolve({ data: [{ period: '2025-01', total: 4000 }], error: null })
      }
      return Promise.resolve({ data: [], error: null })
    })
    render(<Overview />)
    await waitFor(() => expect(screen.getByText('Bills & Fixed')).toBeInTheDocument())
    expect(screen.getByText('Discretionary')).toBeInTheDocument()
    expect(screen.getByText('Income')).toBeInTheDocument()
    expect(screen.getByText('Cashflow')).toBeInTheDocument()
    expect(screen.queryByText('Transfers')).not.toBeInTheDocument()
  })
})
