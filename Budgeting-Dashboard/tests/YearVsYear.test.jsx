import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('../src/lib/supabase', () => ({ supabase: { rpc: vi.fn() } }))
vi.mock('../src/lib/ons', () => ({
  fetchCpiRates: vi.fn().mockResolvedValue({ '2025': 2.6, '2026': 3.0 }),
  cpiAdjust: vi.fn((amount) => amount),
}))

import YearVsYear from '../src/pages/YearVsYear'
import { supabase } from '../src/lib/supabase'

beforeEach(() => { vi.clearAllMocks() })

// Data spans 3 years: 2024, 2025, 2026
const rpcData = [
  { period: '2024-01', category: 'Groceries', total: 100 },
  { period: '2025-01', category: 'Groceries', total: 130 },
  { period: '2026-01', category: 'Groceries', total: 150 },
]

describe('YearVsYear', () => {
  it('shows loading state initially', () => {
    supabase.rpc.mockReturnValue(new Promise(() => {}))
    render(<YearVsYear />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('renders basis year selector and monthly table', async () => {
    supabase.rpc.mockResolvedValue({ data: rpcData, error: null })
    render(<YearVsYear />)
    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument())
    expect(screen.getByText('Jan')).toBeInTheDocument()
  })

  it('default basis year is second-to-last; cy is always latest year (2026)', async () => {
    supabase.rpc.mockResolvedValue({ data: rpcData, error: null })
    render(<YearVsYear />)
    // Default: basisYear = 2025, cy = 2026 — heading should say "2025 vs 2026"
    await waitFor(() => expect(screen.getAllByText(/2025 vs 2026/i).length).toBeGreaterThan(0))
  })

  it('selecting basis 2024 compares 2024 vs 2026 (always latest)', async () => {
    supabase.rpc.mockResolvedValue({ data: rpcData, error: null })
    render(<YearVsYear />)
    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument())
    // Change basis to 2024
    const select = screen.getByRole('combobox')
    select.value = '2024'
    select.dispatchEvent(new Event('change', { bubbles: true }))
    await waitFor(() => expect(screen.getAllByText(/2024 vs 2026/i).length).toBeGreaterThan(0))
  })

  it('shows CPI toggle', async () => {
    supabase.rpc.mockResolvedValue({ data: rpcData, error: null })
    render(<YearVsYear />)
    await waitFor(() => expect(screen.getByLabelText(/inflation/i)).toBeInTheDocument())
  })
})
