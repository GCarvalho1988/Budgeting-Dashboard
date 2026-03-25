import { describe, it, expect } from 'vitest'
import { normaliseExcelRow } from '../scripts/seed-historical.js'

describe('normaliseExcelRow', () => {
  it('converts Excel serial date to ISO date string', () => {
    // Excel serial 45566 = 2024-10-02
    const row = { DATE: 45566, DESCRIPTION: 'TESCO', AMOUNT: -45.67, CATEGORY: 'Groceries' }
    const result = normaliseExcelRow(row)
    expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(result.date).toBe('2024-10-01')
  })

  it('converts amount to positive absolute value', () => {
    const row = { DATE: 45566, DESCRIPTION: 'TESCO', AMOUNT: -45.67, CATEGORY: 'Groceries' }
    const result = normaliseExcelRow(row)
    expect(result.amount).toBe(45.67)
  })

  it('trims whitespace from description and category', () => {
    const row = { DATE: 45566, DESCRIPTION: '  TESCO METRO  ', AMOUNT: -10, CATEGORY: '  Groceries  ' }
    const result = normaliseExcelRow(row)
    expect(result.description).toBe('TESCO METRO')
    expect(result.category).toBe('Groceries')
  })

  it('skips rows with positive amount (income/refund)', () => {
    const row = { DATE: 45566, DESCRIPTION: 'SALARY', AMOUNT: 2000, CATEGORY: 'Income' }
    expect(() => normaliseExcelRow(row)).toThrow('income')
  })

  it('skips rows with zero amount', () => {
    const row = { DATE: 45566, DESCRIPTION: 'TRANSFER', AMOUNT: 0, CATEGORY: 'Transfer' }
    expect(() => normaliseExcelRow(row)).toThrow('zero')
  })

  it('throws on missing required columns', () => {
    const row = { DATE: 45566, AMOUNT: -10 }
    expect(() => normaliseExcelRow(row)).toThrow('Missing')
  })
})
