// src/lib/ons.js
const ONS_URL = '/.netlify/functions/ons-cpi'

const MONTH_ABBR = {
  JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
  JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12',
}

/**
 * Fetches CPIH monthly 12-month rates from ONS API.
 * Returns { "2026-02": 3.5, "2025-12": 3.2, ... }
 */
export async function fetchCpiRates() {
  const res = await fetch(ONS_URL)
  if (!res.ok) throw new Error(`ONS API failed: ${res.status}`)
  const json = await res.json()
  const rates = {}
  json.months?.forEach(({ date, value }) => {
    // ONS date format: "2026 JAN"
    const [year, mon] = date.split(' ')
    const mm = MONTH_ABBR[mon]
    if (mm) rates[`${year}-${mm}`] = parseFloat(value)
  })
  return rates
}

/**
 * Adjusts `amount` from `pyYear` prices to the latest available CPI reference month.
 * Uses the same calendar month's rate for each intervening year (e.g. if latest is
 * "2026-02", applies the Feb rate for 2025 and Feb for 2026, compounded).
 * Every historical amount ends up expressed in the same reference month's purchasing power.
 */
export function cpiAdjustToLatest(amount, pyYear, rates) {
  const sortedKeys = Object.keys(rates).sort()
  if (sortedKeys.length === 0) return amount

  const latestKey = sortedKeys[sortedKeys.length - 1] // e.g. "2026-02"
  const [latestYearStr, latestMonth] = latestKey.split('-')
  const latestYear = Number(latestYearStr)

  if (pyYear >= latestYear) return amount

  let factor = 1
  for (let y = pyYear + 1; y <= latestYear; y++) {
    const key = `${y}-${latestMonth}`
    factor *= 1 + (rates[key] ?? 0) / 100
  }
  return amount * factor
}
