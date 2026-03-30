// src/lib/categories.js

export const INCOME_CATEGORIES = new Set(['Income', 'Interest Earnings'])

export const BILLS_CATEGORIES = new Set([
  'Car Repayments',
  'Child & dependent expenses',
  'House Cleaning',
  'Household insurance',
  'Mortgage',
  'Online services',
  'Subscriptions',
  'Telephone & mobile',
  'TV & internet',
  'Utilities',
  '0% Credit Card Repayment',
])

export const TRANSIENT_CATEGORIES = new Set([
  'Credit card payments',
  'Dulce Personal Purchases',
  'Dulce Work Expenses',
  'Gui Personal Purchases',
  'Gui Work Expensss', // sic — matches the typo as it exists in production data
  'Transfers',
])

/**
 * @param {string} category
 * @returns {'bills' | 'discretionary' | 'transient'}
 */
export function bucketCategory(category) {
  if (TRANSIENT_CATEGORIES.has(category)) return 'transient'
  if (BILLS_CATEGORIES.has(category)) return 'bills'
  return 'discretionary'
}
