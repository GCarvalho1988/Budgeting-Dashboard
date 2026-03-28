// tests/ons.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchCpiRates, cpiAdjust } from '../src/lib/ons'

describe('fetchCpiRates', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls the proxy URL', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ annual: [{ date: '2023', value: '6.7' }] }),
    })
    await fetchCpiRates()
    expect(global.fetch).toHaveBeenCalledWith('/.netlify/functions/ons-cpi')
  })

  it('parses annual rates into a year-keyed object', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        annual: [
          { date: '2022', value: '9.6' },
          { date: '2023', value: '6.7' },
        ],
      }),
    })
    const rates = await fetchCpiRates()
    expect(rates).toEqual({ '2022': 9.6, '2023': 6.7 })
  })

  it('throws when the proxy returns a non-ok status', async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, status: 502 })
    await expect(fetchCpiRates()).rejects.toThrow('ONS API failed: 502')
  })
})

describe('cpiAdjust', () => {
  const rates = { '2022': 9.6, '2023': 6.7, '2024': 3.0 }

  it('returns amount unchanged when fromYear >= toYear', () => {
    expect(cpiAdjust(100, 2023, 2022, rates)).toBe(100)
    expect(cpiAdjust(100, 2023, 2023, rates)).toBe(100)
  })

  it('compounds rates across multiple years', () => {
    const result = cpiAdjust(100, 2022, 2024, rates)
    expect(result).toBeCloseTo(100 * 1.067 * 1.030, 2)
  })

  it('uses 0 for missing rate years', () => {
    expect(cpiAdjust(100, 2020, 2021, {})).toBe(100)
  })
})
