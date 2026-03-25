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

// Mock supabase — we'll configure per-test via mockImplementation
vi.mock('../src/lib/supabase', () => {
  const chain = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
  }
  return {
    supabase: {
      from: vi.fn().mockReturnValue(chain),
      _chain: chain,
    },
  }
})

import Overview from '../src/pages/Overview'
import { supabase } from '../src/lib/supabase'

beforeEach(() => {
  vi.clearAllMocks()
  supabase.from.mockReturnValue(supabase._chain)
  Object.values(supabase._chain).forEach(fn => {
    if (fn.mockReturnThis) fn.mockReturnThis()
  })
})

describe('Overview', () => {
  it('shows loading state initially', () => {
    // single() never resolves — stays in loading
    supabase._chain.single.mockReturnValue(new Promise(() => {}))
    render(<Overview />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('shows empty state when no uploads exist', async () => {
    supabase._chain.single.mockResolvedValue({ data: null, error: null })
    render(<Overview />)
    await waitFor(() =>
      expect(screen.getByText(/no data yet/i)).toBeInTheDocument()
    )
  })
})
