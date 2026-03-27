// tests/ingest-csv.test.js
import { describe, it, expect } from 'vitest'
import { parseRow, detectPeriod } from '../netlify/functions/ingest-csv.js'

const EXPENSE_ROW = {
  DATE: '2025-10-01',
  DESCRIPTION: 'Tesco',
  AMOUNT: '-45.67',
  CATEGORY: 'Groceries',
}

describe('parseRow — expenses', () => {
  it('maps negative CSV row to expense object', () => {
    const result = parseRow(EXPENSE_ROW)
    expect(result.type).toBe('expense')
    expect(result.date).toBe('2025-10-01')
    expect(result.description).toBe('Tesco')
    expect(result.amount).toBe(45.67)
    expect(result.category).toBe('Groceries')
  })

  it('throws on missing required field', () => {
    expect(() => parseRow({ DATE: '2025-10-01' })).toThrow()
  })

  it('throws on zero-amount row', () => {
    expect(() => parseRow({ DATE: '2025-10-01', DESCRIPTION: 'Free', AMOUNT: '0.00', CATEGORY: 'Other' })).toThrow('zero-amount')
  })

  it('applies PLATINUM M/C override — forces category to 0% Credit Card Repayment', () => {
    const result = parseRow({
      DATE: '2025-10-01',
      DESCRIPTION: 'BARCLAYCARD PLATINUM M/C',
      AMOUNT: '-400.00',
      CATEGORY: 'Credit card payments',
    })
    expect(result.type).toBe('expense')
    expect(result.category).toBe('0% Credit Card Repayment')
    expect(result.amount).toBe(400)
  })

  it('PLATINUM M/C override is case-insensitive', () => {
    const result = parseRow({
      DATE: '2025-10-01',
      DESCRIPTION: 'barclaycard platinum m/c direct debit',
      AMOUNT: '-400.00',
      CATEGORY: 'Credit card payments',
    })
    expect(result.category).toBe('0% Credit Card Repayment')
  })
})

describe('parseRow — income', () => {
  it('returns income type for positive non-transient amount', () => {
    const result = parseRow({
      DATE: '2025-10-01',
      DESCRIPTION: 'EMPLOYER SALARY',
      AMOUNT: '3500.00',
      CATEGORY: 'Salary',
    })
    expect(result.type).toBe('income')
    expect(result.amount).toBe(3500)
    expect(result.description).toBe('EMPLOYER SALARY')
  })

  it('throws for positive amount with transient category', () => {
    expect(() => parseRow({
      DATE: '2025-10-01',
      DESCRIPTION: 'TRANSFER IN',
      AMOUNT: '500.00',
      CATEGORY: 'Transfers',
    })).toThrow()
  })

  it('throws for positive amount with Credit card payments', () => {
    expect(() => parseRow({
      DATE: '2025-10-01',
      DESCRIPTION: 'CC REFUND',
      AMOUNT: '10.00',
      CATEGORY: 'Credit card payments',
    })).toThrow()
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
