import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { bucketCategory } from '../lib/categories'

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
  const [loading, setLoading] = useState(true)
  const [currentYear, setCurrentYear] = useState(null)
  const [prevYear, setPrevYear] = useState(null)
  const [rows, setRows] = useState([])
  const [catRows, setCatRows] = useState([])
  const [forecast, setForecast] = useState(null)
  const [monthAvg, setMonthAvg] = useState(null)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.rpc('get_monthly_category_totals')
      if (error) {
        console.error('get_monthly_category_totals failed:', error.message)
        setLoading(false)
        return
      }

      const byYearMonth = {}
      const byCatYear = {}

      data?.forEach(({ period, category, total }) => {
        // Exclude transient categories from all calculations
        if (bucketCategory(category) === 'transient') return

        const [y, m] = period.split('-')
        const yr = Number(y), mo = Number(m)
        const amt = Number(total)

        if (!byYearMonth[yr]) byYearMonth[yr] = {}
        byYearMonth[yr][mo] = (byYearMonth[yr][mo] || 0) + amt

        const key = `${category}|${yr}`
        byCatYear[key] = (byCatYear[key] || 0) + amt
      })

      const years = Object.keys(byYearMonth).map(Number).sort()
      const cy = years[years.length - 1]
      const py = cy - 1
      setCurrentYear(cy)
      setPrevYear(py)

      const monthRows = MONTHS.map((label, i) => {
        const mo = i + 1
        const cur = byYearMonth[cy]?.[mo] ?? null
        const prev = byYearMonth[py]?.[mo] ?? null
        const delta = cur !== null && prev !== null ? Math.round(((cur - prev) / prev) * 100) : null
        return { label, cur, prev, delta }
      })
      setRows(monthRows)

      // Forecast: average of completed months in the current year
      const completedMonths = monthRows.filter(r => r.cur !== null)
      if (completedMonths.length > 0) {
        const avg = completedMonths.reduce((s, r) => s + r.cur, 0) / completedMonths.length
        setMonthAvg(Math.round(avg))
        setForecast(Math.round(avg * 12))
      }

      // Category rows: use all categories that appear in either year
      const categories = [
        ...new Set(
          Object.keys(byCatYear)
            .map(key => key.split('|')[0])
        ),
      ].sort()

      setCatRows(
        categories.map(cat => {
          const cur = byCatYear[`${cat}|${cy}`] ?? null
          const prev = byCatYear[`${cat}|${py}`] ?? null
          const delta = prev !== null && prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null
          return { cat, cur, prev, delta }
        }).sort((a, b) => (b.cur ?? 0) - (a.cur ?? 0))
      )

      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="text-[#B6A596] py-8">Loading…</div>

  return (
    <div className="space-y-6">
      {/* Monthly table */}
      <div className="border border-[#66473B] rounded">
        <div className="px-5 py-4 border-b border-[#35211A] flex items-center justify-between">
          <h2
            className="text-xs font-semibold text-[#B6A596] uppercase tracking-widest"
            style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
          >
            Monthly: {prevYear} vs {currentYear}
          </h2>
          {forecast && (
            <span className="text-xs text-[#B6A596]">
              {currentYear} forecast:{' '}
              <span className="text-[#EBDCC4] font-semibold">{formatGBP(forecast)}</span>
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#1a1a1a]">
              <tr>
                <TH>Month</TH>
                <TH right>{prevYear}</TH>
                <TH right>{currentYear}</TH>
                <TH right>Change</TH>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr
                  key={r.label}
                  className={`border-b border-[#35211A] last:border-0 ${idx % 2 === 1 ? 'bg-white/[0.02]' : ''}`}
                >
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
            By Category: {prevYear} vs {currentYear}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#1a1a1a]">
              <tr>
                <TH>Category</TH>
                <TH right>{prevYear}</TH>
                <TH right>{currentYear}</TH>
                <TH right>Change</TH>
              </tr>
            </thead>
            <tbody>
              {catRows.map((r, idx) => (
                <tr
                  key={r.cat}
                  className={`border-b border-[#35211A] last:border-0 ${idx % 2 === 1 ? 'bg-white/[0.02]' : ''}`}
                >
                  <td className="px-5 py-2.5 text-[#EBDCC4]">{r.cat}</td>
                  <td className="px-5 py-2.5 text-right text-[#B6A596]">
                    {r.prev !== null ? formatGBP(r.prev) : <span className="text-[#35211A]">—</span>}
                  </td>
                  <td className="px-5 py-2.5 text-right text-[#EBDCC4] font-medium">
                    {r.cur !== null ? formatGBP(r.cur) : <span className="text-[#66473B]">~{formatGBP(monthAvg ?? 0)}</span>}
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
