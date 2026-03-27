import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

// Recharts needs ResizeObserver
beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

vi.mock('../src/lib/supabase', () => {
  const fromChain = {
    select: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    then: vi.fn().mockImplementation(cb => {
      cb({ data: [] })
      return Promise.resolve()
    }),
  }
  return {
    supabase: {
      rpc: vi.fn(),
      from: vi.fn().mockReturnValue(fromChain),
    },
  }
})

import Overview from '../src/pages/Overview'
import { supabase } from '../src/lib/supabase'

beforeEach(() => {
  vi.clearAllMocks()
  // Default: rpc never resolves (loading state)
  supabase.rpc.mockReturnValue(new Promise(() => {}))
  // Restore from chain
  const fromChain = {
    select: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    then: vi.fn().mockImplementation(cb => { cb({ data: [] }); return Promise.resolve() }),
  }
  supabase.from.mockReturnValue(fromChain)
})

describe('Overview', () => {
  it('shows loading state initially', () => {
    // rpc() never resolves — stays in loading
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
})
