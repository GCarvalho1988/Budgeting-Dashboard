import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { bucketCategory } from '../lib/categories'
import { fetchCpiRates, cpiAdjust } from '../lib/ons'

function formatGBP(n) {
  return `£${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function DeltaCell({ delta }) {
  if (delta === null) return <td className="px-5 py-2.5 text-right text-[#35211A]">—</td>
  return (
    <td className={`px-5 py-2.5 text-right font-medium ${delta > 0 ? 'text-[#DC9F85]' : 'text-[#B6A596]'}`}>
      {delta > 0 ? '+' : ''}{delta}%
    </td>
  )
}

const TH = ({ children, right }) => (
  <th
    className={`px-5 py-3 text-xs font-semibold text-[#B6A596] uppercase tracking-widest ${right ? 'text-right' : 'text-left'}`}
    style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
  >
    {children}
  </th>
)

export default function YearVsYear() {
  const [loading, setLoading]           = useState(true)
  const [allData, setAllData]           = useState([])
  const [years, setYears]               = useState([])
  const [basisYear, setBasisYear]       = useState(null)
  const [inflationAdj, setInflationAdj] = useState(false)
  const [cpiRates, setCpiRates]         = useState({})

  useEffect(() => {
    async function load() {
      const [{ data, error }, rates] = await Promise.all([
        supabase.rpc('get_monthly_category_totals'),
        fetchCpiRates().catch(() => ({})),
      ])
      if (error) {
        console.error('get_monthly_category_totals failed:', error.message)
        setLoading(false)
        return
      }
      const filtered = (data ?? []).filter(r => bucketCategory(r.category) !== 'transient')
      setAllData(filtered)
      setCpiRates(rates)
      const ys = [...new Set(filtered.map(r => r.period.slice(0, 4)))].sort()
      setYears(ys)
      setBasisYear(ys.length >= 2 ? Number(ys[ys.length - 2]) : Number(ys[0]))
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="text-[#B6A596] py-8">Loading…</div>

  const cy = years.length > 0 ? Number(years[years.length - 1]) : null
  const py = basisYear

  const byYearMonth = {}
  allData.forEach(({ period, total }) => {
    const [y, m] = period.split('-')
    const yr = Number(y), mo = Number(m)
    if (!byYearMonth[yr]) byYearMonth[yr] = {}
    byYearMonth[yr][mo] = (byYearMonth[yr][mo] || 0) + Number(total)
  })

  // Months present in current year (for fair category comparison)
  const cyMonths = new Set(
    allData
      .filter(r => Number(r.period.slice(0, 4)) === cy)
      .map(r => r.period.split('-')[1])
  )

  // Build byCatYear — prev year only counted for months also in current year
  const byCatYear = {}
  allData.forEach(({ period, category, total }) => {
    const [y, m] = period.split('-')
    const yr = Number(y)
    if (yr === py && !cyMonths.has(m)) return
    const key = `${category}|${yr}`
    byCatYear[key] = (byCatYear[key] || 0) + Number(total)
  })

  const monthRows = MONTHS.map((label, i) => {
    const mo       = i + 1
    const cur      = byYearMonth[cy]?.[mo] ?? null
    const rawPrev  = byYearMonth[py]?.[mo] ?? null
    const prev     = inflationAdj && rawPrev !== null ? Math.round(cpiAdjust(rawPrev, py, cy, cpiRates)) : rawPrev
    const delta    = cur !== null && prev !== null ? Math.round(((cur - prev) / prev) * 100) : null
    return { label, cur, prev, delta }
  })

  const completedMonths = monthRows.filter(r => r.cur !== null)
  const monthAvg = completedMonths.length > 0
    ? Math.round(completedMonths.reduce((s, r) => s + r.cur, 0) / completedMonths.length)
    : null
  const forecast = monthAvg ? Math.round(monthAvg * 12) : null

  const categories = [...new Set(Object.keys(byCatYear).map(k => k.split('|')[0]))].sort()

  const catRows = categories.map(cat => {
    const cur     = byCatYear[`${cat}|${cy}`] ?? null
    const rawPrev = byCatYear[`${cat}|${py}`] ?? null
    const prev    = inflationAdj && rawPrev !== null ? Math.round(cpiAdjust(rawPrev, py, cy, cpiRates)) : rawPrev
    const delta   = prev !== null && prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null
    return { cat, cur, prev, delta }
  }).sort((a, b) => (b.cur ?? 0) - (a.cur ?? 0))

  const basisYearOptions = years.slice(0, -1)

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center gap-6 flex-wrap">
        <div className="flex items-center gap-3">
          <label
            className="text-xs text-[#B6A596] uppercase tracking-widest"
            style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
          >
            Basis year
          </label>
          <select
            value={basisYear ?? ''}
            onChange={e => setBasisYear(Number(e.target.value))}
            className="bg-[#181818] border border-[#66473B] text-[#EBDCC4] text-sm rounded px-3 py-1.5 focus:border-[#DC9F85] focus:outline-none"
          >
            {basisYearOptions.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={inflationAdj}
            onChange={e => setInflationAdj(e.target.checked)}
            aria-label="inflation adjusted"
            className="accent-[#DC9F85]"
          />
          <span
            className="text-xs text-[#B6A596] uppercase tracking-widest"
            style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
          >
            CPI adjusted
          </span>
        </label>
      </div>

      {/* Monthly table */}
      <div className="border border-[#66473B] rounded">
        <div className="px-5 py-4 border-b border-[#35211A] flex items-center justify-between">
          <h2
            className="text-xs font-semibold text-[#B6A596] uppercase tracking-widest"
            style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
          >
            Monthly: {py} vs {cy}
          </h2>
          {forecast && (
            <span className="text-xs text-[#B6A596]">
              {cy} forecast:{' '}
              <span className="text-[#EBDCC4] font-semibold">{formatGBP(forecast)}</span>
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#1a1a1a]">
              <tr>
                <TH>Month</TH>
                <TH right>{py}{inflationAdj ? ' (adj)' : ''}</TH>
                <TH right>{cy}</TH>
                <TH right>Change</TH>
              </tr>
            </thead>
            <tbody>
              {monthRows.map((r, idx) => (
                <tr key={r.label} className={`border-b border-[#35211A] last:border-0 ${idx % 2 === 1 ? 'bg-white/[0.02]' : ''}`}>
                  <td className="px-5 py-2.5 text-[#EBDCC4]">{r.label}</td>
                  <td className="px-5 py-2.5 text-right text-[#B6A596]">
                    {r.prev !== null ? formatGBP(r.prev) : <span className="text-[#35211A]">—</span>}
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    {r.cur !== null ? (
                      <span className="text-[#EBDCC4] font-medium">{formatGBP(r.cur)}</span>
                    ) : monthAvg !== null ? (
                      <span className="text-[#66473B]">~{formatGBP(monthAvg)}</span>
                    ) : (
                      <span className="text-[#35211A]">—</span>
                    )}
                  </td>
                  <DeltaCell delta={r.delta} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Category table */}
      <div className="border border-[#66473B] rounded">
        <div className="px-5 py-4 border-b border-[#35211A]">
          <h2
            className="text-xs font-semibold text-[#B6A596] uppercase tracking-widest"
            style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
          >
            By Category: {py}{inflationAdj ? ' (adj)' : ''} vs {cy}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#1a1a1a]">
              <tr>
                <TH>Category</TH>
                <TH right>{py}{inflationAdj ? ' (adj)' : ''}</TH>
                <TH right>{cy}</TH>
                <TH right>Change</TH>
              </tr>
            </thead>
            <tbody>
              {catRows.map((r, idx) => (
                <tr key={r.cat} className={`border-b border-[#35211A] last:border-0 ${idx % 2 === 1 ? 'bg-white/[0.02]' : ''}`}>
                  <td className="px-5 py-2.5 text-[#EBDCC4]">{r.cat}</td>
                  <td className="px-5 py-2.5 text-right text-[#B6A596]">
                    {r.prev !== null ? formatGBP(r.prev) : <span className="text-[#35211A]">—</span>}
                  </td>
                  <td className="px-5 py-2.5 text-right text-[#EBDCC4] font-medium">
                    {r.cur !== null ? formatGBP(r.cur) : <span className="text-[#35211A]">—</span>}
                  </td>
                  <DeltaCell delta={r.delta} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
