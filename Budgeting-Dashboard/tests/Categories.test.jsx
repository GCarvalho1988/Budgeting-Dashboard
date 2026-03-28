import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

beforeAll(() => {
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
})

vi.mock('../src/lib/supabase', () => {
  const makeChain = (data = []) => ({
    select: vi.fn().mockReturnThis(),
    eq:     vi.fn().mockReturnThis(),
    order:  vi.fn().mockReturnThis(),
    limit:  vi.fn().mockReturnThis(),
    then:   vi.fn(cb => Promise.resolve(cb({ data }))),
  })
  const supabase = {
    rpc: vi.fn(),
    from: vi.fn(),
    _makeChain: makeChain,
  }
  return { supabase }
})

import Categories from '../src/pages/Categories'
import { supabase } from '../src/lib/supabase'

beforeEach(() => {
  vi.clearAllMocks()
  supabase.from.mockReturnValue(supabase._makeChain())
})

describe('Categories', () => {
  it('shows loading state initially', () => {
    supabase.rpc.mockReturnValue(new Promise(() => {}))
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq:     vi.fn().mockReturnThis(),
      order:  vi.fn().mockReturnThis(),
      limit:  vi.fn().mockReturnThis(),
      then:   vi.fn(() => new Promise(() => {})),
    })
    render(<Categories />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('renders section headings after load', async () => {
    supabase.rpc.mockResolvedValue({
      data: [{ category: 'Groceries' }, { category: 'Mortgage' }],
      error: null,
    })
    supabase.from.mockImplementation(table => {
      if (table === 'income') {
        return supabase._makeChain([{ category: 'Salary' }])
      }
      return supabase._makeChain([])
    })
    render(<Categories />)
    await waitFor(() => expect(screen.getByText('Income')).toBeInTheDocument())
    expect(screen.getByText('Bills & Fixed')).toBeInTheDocument()
    expect(screen.getByText('Discretionary')).toBeInTheDocument()
  })

  it('renders category cards in the correct sections', async () => {
    supabase.rpc.mockResolvedValue({
      data: [{ category: 'Groceries' }, { category: 'Mortgage' }],
      error: null,
    })
    supabase.from.mockImplementation(table => {
      if (table === 'income') return supabase._makeChain([{ category: 'Salary' }])
      return supabase._makeChain([])
    })
    render(<Categories />)
    await waitFor(() => expect(screen.getByText('Salary')).toBeInTheDocument())
    expect(screen.getByText('Mortgage')).toBeInTheDocument()
    expect(screen.getByText('Groceries')).toBeInTheDocument()
  })
})
