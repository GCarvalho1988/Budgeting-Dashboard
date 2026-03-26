import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import KpiCard from '../components/KpiCard'
import CategoryBarChart from '../components/CategoryBarChart'
import MonthlyTrendChart from '../components/MonthlyTrendChart'

function formatGBP(n) {
  return `£${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Returns the ISO date string for the first day of the month after `period` (YYYY-MM)
export function nextPeriodBoundary(period) {
  const [y, m] = period.split('-')
  const d = new Date(Number(y), Number(m), 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export default function Overview() {
  const [periods, setPeriods] = useState([])
  const [periodIndex, setPeriodIndex] = useState(null) // index into periods[] — null = loading
  const [kpis, setKpis] = useState(null)
  const [categoryData, setCategoryData] = useState([])
  const [trendData, setTrendData] = useState([])
  const [loading, setLoading] = useState(true)

  // Load available periods once on mount
  useEffect(() => {
    supabase
      .from('uploads')
      .select('period')
      .order('period', { ascending: true })
      .then(({ data }) => {
        const ps = data?.map(r => r.period) ?? []
        setPeriods(ps)
        setPeriodIndex(ps.length - 1) // default to most recent
      })
  }, [])

  // Load KPIs and category data whenever the selected period changes
  useEffect(() => {
    if (periodIndex === null || periods.length === 0) return

    async function load() {
      setLoading(true)
      const period = periods[periodIndex]
      const [y, m] = period.split('-')
      const lastYearPeriod = `${Number(y) - 1}-${m.padStart(2, '0')}`
      const boundary = nextPeriodBoundary(period)
      const lastYearBoundary = nextPeriodBoundary(lastYearPeriod)

      // Current period transactions
      const { data: currentTx } = await supabase
        .from('transactions')
        .select('amount, category')
        .gte('date', `${period}-01`)
        .lt('date', boundary)

      const currentTotal = currentTx?.reduce((s, t) => s + Number(t.amount), 0) ?? 0

      // Same period last year
      const { data: lastYearTx } = await supabase
        .from('transactions')
        .select('amount')
        .gte('date', `${lastYearPeriod}-01`)
        .lt('date', lastYearBoundary)

      const lastYearTotal = lastYearTx?.reduce((s, t) => s + Number(t.amount), 0) ?? 0
      const yoyDelta = lastYearTotal > 0
        ? Math.round(((currentTotal - lastYearTotal) / lastYearTotal) * 100)
        : null

      // Category breakdown
      const catMap = {}
      currentTx?.forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + Number(t.amount) })
      const sortedCats = Object.entries(catMap)
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount)
      const topCat = sortedCats[0]?.category ?? '—'

      // Flag count
      const { count: flagCount } = await supabase
        .from('flags')
        .select('id', { count: 'exact', head: true })

      // Monthly trend via RPC (no row limit)
      const { data: monthly } = await supabase.rpc('get_monthly_totals')
      const trend = (monthly ?? []).slice(-12).map(({ period: mo, total }) => {
        const [ty, tm] = mo.split('-')
        const label = new Date(Number(ty), Number(tm) - 1)
          .toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
        return { month: label, amount: Math.round(Number(total)) }
      })

      setKpis({ currentTotal, yoyDelta, topCat, flagCount: flagCount ?? 0 })
      setCategoryData(sortedCats)
      setTrendData(trend)
      setLoading(false)
    }

    load()
  }, [periodIndex, periods])

  const period = periodIndex !== null ? periods[periodIndex] : null

  function formatPeriodLabel(p) {
    if (!p) return ''
    const [y, m] = p.split('-')
    return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  }

  if (periodIndex === null) return <div className="text-[#B6A596] py-8">Loading…</div>
  if (periods.length === 0) return <div className="text-[#B6A596] py-8">No data yet. Upload a CSV to get started.</div>

  return (
    <div className="space-y-6">
      {/* Month picker */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setPeriodIndex(i => Math.max(0, i - 1))}
          disabled={periodIndex === 0}
          className="text-[#DC9F85] disabled:text-[#35211A] text-lg leading-none px-1 transition-colors"
        >
          ‹
        </button>
        <span
          className="text-[#EBDCC4] text-sm uppercase tracking-widest font-semibold"
          style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
        >
          {formatPeriodLabel(period)}
        </span>
        <button
          onClick={() => setPeriodIndex(i => Math.min(periods.length - 1, i + 1))}
          disabled={periodIndex === periods.length - 1}
          className="text-[#DC9F85] disabled:text-[#35211A] text-lg leading-none px-1 transition-colors"
        >
          ›
        </button>
      </div>

      {loading ? (
        <div className="text-[#B6A596] py-4">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Total Spent" value={formatGBP(kpis.currentTotal)} />
            <KpiCard
              label="vs Last Year"
              value={kpis.yoyDelta !== null ? `${kpis.yoyDelta > 0 ? '+' : ''}${kpis.yoyDelta}%` : '—'}
              delta={kpis.yoyDelta}
              deltaLabel="YoY"
            />
            <KpiCard label="Top Category" value={kpis.topCat} />
            <KpiCard label="Flagged" value={kpis.flagCount} />
          </div>

          <div className="border border-[#66473B] rounded p-5">
            <h2
              className="text-xs font-semibold text-[#B6A596] uppercase tracking-widest mb-4"
              style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
            >
              Spend by Category
            </h2>
            <CategoryBarChart data={categoryData} />
          </div>

          <div className="border border-[#66473B] rounded p-5">
            <h2
              className="text-xs font-semibold text-[#B6A596] uppercase tracking-widest mb-4"
              style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
            >
              Monthly Trend
            </h2>
            <MonthlyTrendChart data={trendData} />
          </div>
        </>
      )}
    </div>
  )
}
