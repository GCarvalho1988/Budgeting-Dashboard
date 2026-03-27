import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import KpiCard from '../components/KpiCard'
import MonthlyTrendChart from '../components/MonthlyTrendChart'
import DiscretionaryTreemap from '../components/DiscretionaryTreemap'
import { bucketCategory } from '../lib/categories'

function formatGBP(n) {
  return `£${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

// Returns ISO date string for first day of month after period (YYYY-MM)
export function nextPeriodBoundary(period) {
  const [y, m] = period.split('-')
  const d = new Date(Number(y), Number(m), 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

// Rolling average of trueSpend over a sliding window
// monthlyData: [{period: string, trueSpend: number}] sorted ascending
export function computeRollingAverage(monthlyData, window = 6) {
  return monthlyData.map((_, i) => {
    const start = Math.max(0, i - window + 1)
    const slice = monthlyData.slice(start, i + 1)
    const avg = slice.reduce((s, x) => s + x.trueSpend, 0) / slice.length
    return { period: monthlyData[i].period, avg: Math.round(avg) }
  })
}

function formatPeriodLabel(p) {
  if (!p) return ''
  const [y, m] = p.split('-')
  return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

export default function Overview() {
  const [allCatData, setAllCatData] = useState(null)  // [{period, category, total}]
  const [allIncomeData, setAllIncomeData] = useState(null)  // [{period, total}]
  const [periods, setPeriods] = useState([])
  const [periodIndex, setPeriodIndex] = useState(null)
  const [nurseryTotal, setNurseryTotal] = useState(0)

  // Load all data once on mount
  useEffect(() => {
    async function load() {
      const [{ data: catData, error: catErr }, { data: incomeData, error: incomeErr }] = await Promise.all([
        supabase.rpc('get_monthly_category_totals'),
        supabase.rpc('get_monthly_income'),
      ])
      if (catErr) console.error('get_monthly_category_totals failed:', catErr.message)
      if (incomeErr) console.error('get_monthly_income failed:', incomeErr.message)
      const ps = [...new Set((catData ?? []).map(r => r.period))].sort()
      setAllCatData(catData ?? [])
      setAllIncomeData(incomeData ?? [])
      setPeriods(ps)
      setPeriodIndex(ps.length > 0 ? ps.length - 1 : null)
    }
    load()
  }, [])

  const period = periodIndex !== null && periods.length > 0 ? periods[periodIndex] : null

  // Fetch nursery sub-total for selected period (the only per-period re-fetch)
  useEffect(() => {
    if (!period) return
    supabase
      .from('transactions')
      .select('amount')
      // Nursery sub-total: hardcoded description prefix matching production data
      .ilike('description', 'Vasco Nursery%')
      .gte('date', `${period}-01`)
      .lt('date', nextPeriodBoundary(period))
      .then(({ data }) => {
        setNurseryTotal(data?.reduce((s, t) => s + Number(t.amount), 0) ?? 0)
      })
  }, [period])

  // Derive KPIs for selected period from cached data
  const periodRows = period && allCatData
    ? allCatData.filter(r => r.period === period)
    : []

  const bills = periodRows
    .filter(r => bucketCategory(r.category) === 'bills')
    .reduce((s, r) => s + Number(r.total), 0)

  const discretionary = periodRows
    .filter(r => bucketCategory(r.category) === 'discretionary')
    .reduce((s, r) => s + Number(r.total), 0)

  const transient = periodRows
    .filter(r => bucketCategory(r.category) === 'transient')
    .reduce((s, r) => s + Number(r.total), 0)

  const income = allIncomeData
    ? Number(allIncomeData.find(r => r.period === period)?.total ?? 0)
    : 0

  // Discretionary treemap: categories for selected period, sorted by total
  const discretionaryItems = periodRows
    .filter(r => bucketCategory(r.category) === 'discretionary')
    .map(r => ({ name: r.category, size: Math.round(Number(r.total)) }))
    .sort((a, b) => b.size - a.size)

  // Monthly trend: true spend (bills + discretionary only) + 6-month rolling average
  const monthlyTrueSpend = periods.map(p => {
    const rows = allCatData.filter(r => r.period === p)
    const trueSpend = rows
      .filter(r => bucketCategory(r.category) !== 'transient')
      .reduce((s, r) => s + Number(r.total), 0)
    return { period: p, trueSpend: Math.round(trueSpend) }
  })

  const rollingAvg = computeRollingAverage(monthlyTrueSpend)

  const trendData = monthlyTrueSpend.slice(-12).map((item, i) => {
    const [y, m] = item.period.split('-')
    const label = new Date(Number(y), Number(m) - 1)
      .toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
    const offset = monthlyTrueSpend.length - Math.min(12, monthlyTrueSpend.length)
    return {
      month: label,
      amount: item.trueSpend,
      avg: rollingAvg[offset + i]?.avg,
    }
  })

  const loading = allCatData === null || allIncomeData === null

  if (loading) return <div className="text-[#B6A596] py-8">Loading…</div>
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

      {/* 4 KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Bills & Fixed"
          value={formatGBP(bills)}
          subLine={nurseryTotal > 0 ? `Nursery ${formatGBP(nurseryTotal)}` : undefined}
        />
        <KpiCard label="Discretionary" value={formatGBP(discretionary)} />
        <KpiCard label="Transfers" value={formatGBP(transient)} muted />
        <KpiCard label="Income" value={income > 0 ? formatGBP(income) : '—'} />
      </div>

      {/* Discretionary treemap */}
      {discretionaryItems.length > 0 && (
        <div className="border border-[#66473B] rounded p-5">
          <h2
            className="text-xs font-semibold text-[#B6A596] uppercase tracking-widest mb-4"
            style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
          >
            Discretionary Breakdown
          </h2>
          <DiscretionaryTreemap data={discretionaryItems} />
        </div>
      )}

      {/* Monthly trend with rolling average */}
      <div className="border border-[#66473B] rounded p-5">
        <h2
          className="text-xs font-semibold text-[#B6A596] uppercase tracking-widest mb-4"
          style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
        >
          Monthly Trend
        </h2>
        <MonthlyTrendChart data={trendData} />
      </div>
    </div>
  )
}
