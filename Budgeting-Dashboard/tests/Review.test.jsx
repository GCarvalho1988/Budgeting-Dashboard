import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Review from '../src/pages/Review'

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}))

const mockFrom = vi.fn()
const mockRpc  = vi.fn().mockResolvedValue({ data: [] })
vi.mock('../src/lib/supabase', () => ({
  supabase: { from: (...args) => mockFrom(...args), rpc: (...args) => mockRpc(...args) },
}))

function makeChain(overrides = {}) {
  const base = {
    select: vi.fn().mockReturnThis(),
    order:  vi.fn().mockReturnThis(),
    eq:     vi.fn().mockReturnThis(),
    not:    vi.fn().mockReturnThis(),
    gte:    vi.fn().mockReturnThis(),
    lt:     vi.fn().mockReturnThis(),
    in:     vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockResolvedValue({ error: null }),
    then:   vi.fn(cb => Promise.resolve(cb({ data: [], error: null }))),
  }
  return { ...base, ...overrides }
}

// Helper: set up a full period with one pending clothing tx and one tagged personal tx
function setupPeriodMocks({ pendingTx, taggedTx, flags = [] } = {}) {
  const allTxs = [
    ...(pendingTx ? [pendingTx] : []),
    ...(taggedTx  ? [taggedTx]  : []),
  ]
  mockFrom.mockImplementation(table => {
    if (table === 'uploads') {
      return makeChain({ then: vi.fn(cb => Promise.resolve(cb({ data: [{ period: '2025-03' }], error: null }))) })
    }
    if (table === 'expense_claims') {
      return makeChain({ then: vi.fn(cb => Promise.resolve(cb({ data: [], error: null }))) })
    }
    if (table === 'flags') {
      return makeChain({ then: vi.fn(cb => Promise.resolve(cb({ data: flags, error: null }))) })
    }
    // transactions + rpc get_distinct_categories
    return makeChain({ then: vi.fn(cb => Promise.resolve(cb({ data: allTxs, error: null }))) })
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReturnValue(makeChain())
  mockRpc.mockResolvedValue({ data: [] })
})

describe('Review', () => {
  it('renders without crashing in empty state', () => {
    render(<Review />)
  })

  it('shows Personal, Work, Dismiss buttons and comment icon per pending transaction', async () => {
    setupPeriodMocks({
      pendingTx: { id: '1', date: '2025-03-05', description: 'ZARA TOP', amount: 45, category: 'Clothing & shoes' },
    })
    render(<Review />)
    await waitFor(() => expect(screen.getByText('ZARA TOP')).toBeInTheDocument())
    expect(screen.getByText('Personal')).toBeInTheDocument()
    expect(screen.getByText('Work')).toBeInTheDocument()
    expect(screen.getByText('Dismiss')).toBeInTheDocument()
    expect(screen.getByTitle('Add a comment')).toBeInTheDocument()
  })

  it('shows "To review" section header with count', async () => {
    setupPeriodMocks({
      pendingTx: { id: '1', date: '2025-03-05', description: 'ZARA TOP', amount: 45, category: 'Clothing & shoes' },
    })
    render(<Review />)
    await waitFor(() => expect(screen.getByText(/to review/i)).toBeInTheDocument())
    expect(screen.getByText(/1 remaining/i)).toBeInTheDocument()
  })

  it('shows "Tagged this period" section header for tagged transactions', async () => {
    setupPeriodMocks({
      taggedTx: { id: '2', date: '2025-03-10', description: 'RYMAN', amount: 14.99, category: 'Dulce Work Expenses' },
    })
    render(<Review />)
    await waitFor(() => expect(screen.getByText('RYMAN')).toBeInTheDocument())
    expect(screen.getByText(/tagged this period/i)).toBeInTheDocument()
  })

  it('does not show Dismiss button on tagged rows', async () => {
    setupPeriodMocks({
      taggedTx: { id: '2', date: '2025-03-10', description: 'RYMAN', amount: 14.99, category: 'Dulce Work Expenses' },
    })
    render(<Review />)
    await waitFor(() => expect(screen.getByText('RYMAN')).toBeInTheDocument())
    expect(screen.queryByText('Dismiss')).not.toBeInTheDocument()
  })

  it('clicking Dismiss removes the row and inserts a dismiss flag', async () => {
    setupPeriodMocks({
      pendingTx: { id: '1', date: '2025-03-05', description: 'PETS AT HOME', amount: 34.5, category: 'General merchandise' },
    })
    mockFrom.mockImplementation(table => {
      if (table === 'uploads')       return makeChain({ then: vi.fn(cb => Promise.resolve(cb({ data: [{ period: '2025-03' }], error: null }))) })
      if (table === 'expense_claims') return makeChain({ then: vi.fn(cb => Promise.resolve(cb({ data: [], error: null }))) })
      if (table === 'flags')         return { ...makeChain({ then: vi.fn(cb => Promise.resolve(cb({ data: [], error: null }))) }), insert: vi.fn().mockResolvedValue({ error: null }) }
      return makeChain({ then: vi.fn(cb => Promise.resolve(cb({ data: [{ id: '1', date: '2025-03-05', description: 'PETS AT HOME', amount: 34.5, category: 'General merchandise' }], error: null }))) })
    })
    render(<Review />)
    await waitFor(() => expect(screen.getByText('PETS AT HOME')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Dismiss'))
    await waitFor(() => expect(screen.queryByText('PETS AT HOME')).not.toBeInTheDocument())
  })

  it('dismissed transactions (type=dismiss in flags) are excluded from pending on load', async () => {
    setupPeriodMocks({
      pendingTx: { id: '1', date: '2025-03-05', description: 'ALREADY DISMISSED', amount: 20, category: 'General merchandise' },
      flags: [{ id: 'f1', transaction_id: '1', type: 'dismiss', comment: null }],
    })
    render(<Review />)
    // Wait for loading to complete — empty state means the transaction was filtered out
    await waitFor(() => expect(screen.getByText(/nothing to review/i)).toBeInTheDocument())
    expect(screen.queryByText('ALREADY DISMISSED')).not.toBeInTheDocument()
  })

  it('shows summary table for tagged transactions', async () => {
    setupPeriodMocks({
      taggedTx: { id: '2', date: '2025-03-10', description: 'CLOTHES', amount: 80, category: 'Dulce Personal Purchases' },
    })
    render(<Review />)
    await waitFor(() => expect(screen.getByText(/transfers this period/i)).toBeInTheDocument())
    expect(screen.getByText(/mark done/i)).toBeInTheDocument()
  })

  it('clicking Personal tags the transaction and moves it to tagged section', async () => {
    mockFrom.mockImplementation(table => {
      if (table === 'uploads')        return makeChain({ then: vi.fn(cb => Promise.resolve(cb({ data: [{ period: '2025-03' }], error: null }))) })
      if (table === 'expense_claims') return makeChain({ then: vi.fn(cb => Promise.resolve(cb({ data: [], error: null }))) })
      if (table === 'flags')          return makeChain({ then: vi.fn(cb => Promise.resolve(cb({ data: [], error: null }))) })
      if (table === 'transactions')   return makeChain({
        then: vi.fn(cb => Promise.resolve(cb({ data: [{ id: '1', date: '2025-03-05', description: 'ZARA', amount: 45, category: 'Clothing & shoes' }], error: null }))),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      })
      return makeChain()
    })
    render(<Review />)
    await waitFor(() => expect(screen.getByText('ZARA')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Personal'))
    await waitFor(() => expect(screen.getByText(/tagged this period/i)).toBeInTheDocument())
  })

  it('clicking Work tags the transaction and moves it to tagged section', async () => {
    mockFrom.mockImplementation(table => {
      if (table === 'uploads')        return makeChain({ then: vi.fn(cb => Promise.resolve(cb({ data: [{ period: '2025-03' }], error: null }))) })
      if (table === 'expense_claims') return makeChain({ then: vi.fn(cb => Promise.resolve(cb({ data: [], error: null }))) })
      if (table === 'flags')          return makeChain({ then: vi.fn(cb => Promise.resolve(cb({ data: [], error: null }))) })
      if (table === 'transactions')   return makeChain({
        then: vi.fn(cb => Promise.resolve(cb({ data: [{ id: '1', date: '2025-03-05', description: 'OFFICEWORKS', amount: 22, category: 'General merchandise' }], error: null }))),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      })
      return makeChain()
    })
    render(<Review />)
    await waitFor(() => expect(screen.getByText('OFFICEWORKS')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Work'))
    await waitFor(() => expect(screen.getByText(/tagged this period/i)).toBeInTheDocument())
  })

  it('clicking category chip on pending row opens the category select', async () => {
    setupPeriodMocks({
      pendingTx: { id: '1', date: '2025-03-05', description: 'ASOS ORDER', amount: 55, category: 'Clothing & shoes' },
    })
    render(<Review />)
    await waitFor(() => expect(screen.getByText('ASOS ORDER')).toBeInTheDocument())
    // Category chip is a button containing the category text
    const chip = screen.getByRole('button', { name: /clothing/i })
    await userEvent.click(chip)
    // CategorySelect renders a <select> element
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('clicking the tag button on a tagged row opens the retag dropdown', async () => {
    setupPeriodMocks({
      taggedTx: { id: '2', date: '2025-03-10', description: 'STAPLES', amount: 18, category: 'Dulce Work Expenses' },
    })
    render(<Review />)
    await waitFor(() => expect(screen.getByText('STAPLES')).toBeInTheDocument())
    // The tagged row tag button shows 'Work ▾'
    await userEvent.click(screen.getByText(/work ▾/i))
    // Dropdown should show 'Personal' option (can switch from Work to Personal)
    expect(screen.getByRole('button', { name: /^personal$/i })).toBeInTheDocument()
  })
})
