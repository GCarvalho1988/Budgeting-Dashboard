// tests/seed-income.test.js
import { describe, it, expect } from 'vitest'
import { normaliseIncomeRow } from '../scripts/seed-income.js'

// Excel serial date 45292 = 2024-01-15
const BASE_ROW = {
  DATE: 45292,
  DESCRIPTION: 'SALARY PAYMENT',
  AMOUNT: 3500,
  CATEGORY: 'Salary',
}

describe('normaliseIncomeRow', () => {
  it('returns a normalised income row for positive non-transient amount', () => {
    const result = normaliseIncomeRow(BASE_ROW)
    expect(result.description).toBe('SALARY PAYMENT')
    expect(result.amount).toBe(3500)
    expect(result.category).toBe('Salary')
    expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('throws for negative amount (expense)', () => {
    expect(() => normaliseIncomeRow({ ...BASE_ROW, AMOUNT: -100 })).toThrow()
  })

  it('throws for zero amount', () => {
    expect(() => normaliseIncomeRow({ ...BASE_ROW, AMOUNT: 0 })).toThrow()
  })

  it('throws for Transfers (transient)', () => {
    expect(() => normaliseIncomeRow({ ...BASE_ROW, CATEGORY: 'Transfers' })).toThrow()
  })

  it('throws for Credit card payments (transient)', () => {
    expect(() => normaliseIncomeRow({ ...BASE_ROW, CATEGORY: 'Credit card payments' })).toThrow()
  })

  it('throws for Dulce Personal Purchases (transient)', () => {
    expect(() => normaliseIncomeRow({ ...BASE_ROW, CATEGORY: 'Dulce Personal Purchases' })).toThrow()
  })

  it('throws for missing required columns', () => {
    expect(() => normaliseIncomeRow({ DATE: 45292, DESCRIPTION: 'X' })).toThrow()
  })

  it('converts Excel serial date to ISO string', () => {
    const result = normaliseIncomeRow(BASE_ROW)
    // serial 45292 should resolve to a date in 2024
    expect(result.date.startsWith('2024')).toBe(true)
  })
})
