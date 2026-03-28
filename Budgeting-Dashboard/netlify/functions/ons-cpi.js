// netlify/functions/ons-cpi.js
const ONS_API_URL = 'https://api.ons.gov.uk/v1/datasets/cpih01/timeseries/l522/data'

// Hardcoded CPIH 12-month annual rates — used when ONS API is unreachable.
// Source: ONS CPIH timeseries L522. Update annually.
const FALLBACK = {
  annual: [
    { date: '2015', value: '0.0' },
    { date: '2016', value: '1.0' },
    { date: '2017', value: '2.6' },
    { date: '2018', value: '2.3' },
    { date: '2019', value: '1.8' },
    { date: '2020', value: '0.8' },
    { date: '2021', value: '2.5' },
    { date: '2022', value: '9.6' },
    { date: '2023', value: '6.7' },
    { date: '2024', value: '3.0' },
  ],
}

export const handler = async () => {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(ONS_API_URL, { signal: controller.signal })
    clearTimeout(timeout)
    if (!res.ok) throw new Error(`ONS returned ${res.status}`)
    const data = await res.json()
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' },
      body: JSON.stringify(data),
    }
  } catch {
    // ONS unreachable (geo-block, timeout, network) — serve hardcoded fallback
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
      body: JSON.stringify(FALLBACK),
    }
  }
}
