import { describe, it, expect } from 'vitest'
import { parseRow, detectPeriod } from '../netlify/functions/ingest-csv.js'

const SAMPLE_ROW = {
  DATE: '2025-10-01',
  DESCRIPTION: 'Tesco',
  AMOUNT: '-45.67',
  CATEGORY: 'Groceries',
}

describe('parseRow', () => {
  it('maps CSV row to transaction object', () => {
    const result = parseRow(SAMPLE_ROW)
    expect(result.date).toBe('2025-10-01')
    expect(result.description).toBe('Tesco')
    expect(result.amount).toBe(45.67)
    expect(result.category).toBe('Groceries')
  })

  it('throws on missing required field', () => {
    expect(() => parseRow({ DATE: '2025-10-01' })).toThrow()
  })

  it('excludes positive amounts (income/refunds)', () => {
    expect(() => parseRow({ DATE: '2025-10-01', DESCRIPTION: 'Refund', AMOUNT: '10.00', CATEGORY: 'Income' })).toThrow()
  })
})

describe('detectPeriod', () => {
  it('returns YYYY-MM from a list of transaction dates', () => {
    const rows = [{ date: '2025-10-01' }, { date: '2025-10-15' }]
    expect(detectPeriod(rows)).toBe('2025-10')
  })

  it('throws if rows span multiple months', () => {
    const rows = [{ date: '2025-10-01' }, { date: '2025-11-01' }]
    expect(() => detectPeriod(rows)).toThrow()
  })
})
