import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

beforeAll(() => {
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
})

vi.mock('../src/lib/supabase', () => {
  const fromChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then: vi.fn(),
  }
  return {
    supabase: {
      rpc: vi.fn(),
      from: vi.fn().mockReturnValue(fromChain),
      _fromChain: fromChain,
    },
  }
})

import Categories from '../src/pages/Categories'
import { supabase } from '../src/lib/supabase'

beforeEach(() => {
  vi.clearAllMocks()
  supabase.from.mockReturnValue(supabase._fromChain)
  Object.values(supabase._fromChain).forEach(fn => { if (fn.mockReturnThis) fn.mockReturnThis() })
})

describe('Categories', () => {
  it('shows loading state initially', () => {
    supabase.rpc.mockReturnValue(new Promise(() => {}))
    render(<Categories />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('renders category pills after load', async () => {
    const catData = [{ category: 'Groceries' }, { category: 'Transport' }]
    // rpc() resolves with category list
    supabase.rpc.mockResolvedValue({ data: catData, error: null })
    // from() chain for per-category transactions returns empty
    supabase._fromChain.then.mockImplementation(cb => Promise.resolve(cb({ data: [] })))
    render(<Categories />)
    await waitFor(() => expect(screen.getByText('Groceries')).toBeInTheDocument())
    expect(screen.getByText('Transport')).toBeInTheDocument()
  })
})
