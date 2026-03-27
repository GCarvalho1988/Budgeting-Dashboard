import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Review from '../src/pages/Review'

const mockFrom = vi.fn()
vi.mock('../src/lib/supabase', () => ({
  supabase: {
    from: (...args) => mockFrom(...args),
  },
}))

function makeChain(overrides = {}) {
  const base = {
    select: vi.fn().mockReturnThis(),
    order:  vi.fn().mockReturnThis(),
    eq:     vi.fn().mockReturnThis(),
    not:    vi.fn().mockReturnThis(),
    gte:    vi.fn().mockReturnThis(),
    lt:     vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockResolvedValue({ error: null }),
    then:   vi.fn(cb => Promise.resolve(cb({ data: [], error: null }))),
  }
  return { ...base, ...overrides }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReturnValue(makeChain())
})

describe('Review', () => {
  it('renders without crashing in empty state', () => {
    render(<Review />)
  })

  it('shows Personal, Work, and Done buttons per transaction', async () => {
    mockFrom.mockImplementation(table => {
      if (table === 'uploads') {
        return makeChain({
          then: vi.fn(cb => Promise.resolve(cb({ data: [{ period: '2025-03' }], error: null }))),
        })
      }
      if (table === 'expense_claims') {
        return makeChain({
          then: vi.fn(cb => Promise.resolve(cb({ data: [], error: null }))),
        })
      }
      return makeChain({
        then: vi.fn(cb => Promise.resolve(cb({
          data: [{ id: '1', date: '2025-03-05', description: 'Dinner', amount: 45, category: 'Dining' }],
          error: null,
        }))),
      })
    })
    render(<Review />)
    await waitFor(() => expect(screen.getByText('Dinner')).toBeInTheDocument())
    expect(screen.getByText('Personal')).toBeInTheDocument()
    expect(screen.getByText('Work')).toBeInTheDocument()
    expect(screen.getByText('Done')).toBeInTheDocument()
  })

  it('shows "Tag all as reviewed" button in header', async () => {
    mockFrom.mockImplementation(table => {
      if (table === 'uploads') return makeChain({ then: vi.fn(cb => Promise.resolve(cb({ data: [{ period: '2025-03' }], error: null }))) })
      if (table === 'expense_claims') return makeChain({ then: vi.fn(cb => Promise.resolve(cb({ data: [], error: null }))) })
      return makeChain({ then: vi.fn(cb => Promise.resolve(cb({ data: [], error: null }))) })
    })
    render(<Review />)
    await waitFor(() => expect(screen.getByText(/tag all as reviewed/i)).toBeInTheDocument())
  })
})
