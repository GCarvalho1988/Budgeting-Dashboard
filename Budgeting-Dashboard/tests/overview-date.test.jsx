import { describe, it, expect, vi } from 'vitest'

// Mock supabase so the Overview module can be imported without network calls
vi.mock('../src/lib/supabase', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}))

import { nextPeriodBoundary } from '../src/pages/Overview.jsx'

describe('nextPeriodBoundary', () => {
  it('returns first day of next month for February', () => {
    expect(nextPeriodBoundary('2026-02')).toBe('2026-03-01')
  })

  it('rolls over to January of next year in December', () => {
    expect(nextPeriodBoundary('2025-12')).toBe('2026-01-01')
  })

  it('handles standard mid-year month', () => {
    expect(nextPeriodBoundary('2025-06')).toBe('2025-07-01')
  })
})
