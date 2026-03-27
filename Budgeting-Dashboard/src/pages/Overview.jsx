import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import KpiCard from '../components/KpiCard'
import MonthlyTrendChart from '../components/MonthlyTrendChart'
import DiscretionaryTreemap from '../components/DiscretionaryTreemap'
import { bucketCategory } from '../lib/categories'
import { nextPeriodBoundary, formatPeriodLabel } from '../lib/dateUtils'
export { nextPeriodBoundary } from '../lib/dateUtils'

function formatGBP(n) {
  return `£${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export default function Overview() {
  const [allCatData, setAllCatData]       = useState(null)
  const [allIncomeData, setAllIncomeData] = useState(null)
  const [periods, setPeriods]             = useState([])
  const [periodIndex, setPeriodIndex]     = useState(null)

  useEffect(() => {
    async function load() {
      const [{ data: catData, error: catErr }, { data: incomeData, error: incomeErr }] = await Promise.all([
        supabase.rpc('get_monthly_category_totals'),
        supabase.rpc('get_monthly_income'),
      ])
      if (catErr)    console.error('get_monthly_category_totals failed:', catErr.message)
      if (incomeErr) console.error('get_monthly_income failed:', incomeErr.message)
      const ps = [...new Set((catData ?? []).map(r => r.period))].sort()
      setAllCatData(catData ?? [])
      setAllIncomeData(incomeData ?? [])
      setPeriods(ps)
      setPeriodIndex(ps.length > 0 ? ps.length - 1 : null)
    }
    load()
  }, [])

  const loading = allCatData === null || allIncomeData === null
  if (loading) return <div className="text-[#B6A596] py-8">Loading…</div>
  if (periods.length === 0) return <div className="text-[#B6A596] py-8">No data yet. Upload a CSV to get started.</div>

  const period     = periodIndex !== null ? periods[periodIndex] : null
  const prevPeriod = periodIndex > 0 ? periods[periodIndex - 1] : null

  const periodRows = allCatData.filter(r => r.period === period)
  const prevRows   = prevPeriod ? allCatData.filter(r => r.period === prevPeriod) : []

  function sumBucket(rows, bucket) {
    return rows.filter(r => bucketCategory(r.category) === bucket).reduce((s, r) => s + Number(r.total), 0)
  }

  const bills         = sumBucket(periodRows, 'bills')
  const discretionary = sumBucket(periodRows, 'discretionary')
  const income        = Number(allIncomeData.find(r => r.period === period)?.total ?? 0)
  const cashflow      = income - bills - discretionary

  const prevBills         = sumBucket(prevRows, 'bills')
  const prevDiscretionary = sumBucket(prevRows, 'discretionary')
  const prevIncome        = Number(allIncomeData.find(r => r.period === prevPeriod)?.total ?? 0)

  function pctDelta(cur, prev) {
    if (!prev) return undefined
    return Math.round(((cur - prev) / prev) * 100)
  }

  const discretionaryItems = periodRows
    .filter(r => bucketCategory(r.category) === 'discretionary')
    .map(r => ({ name: r.category, size: Math.round(Number(r.total)) }))
    .sort((a, b) => b.size - a.size)

  const discretionaryTotal = discretionaryItems.reduce((s, i) => s + i.size, 0)

  // Cumulative cashflow trend across all periods
  let cumulative = 0
  const cashflowTrend = periods.map(p => {
    const rows  = allCatData.filter(r => r.period === p)
    const spend = sumBucket(rows, 'bills') + sumBucket(rows, 'discretionary')
    const inc   = Number(allIncomeData.find(r => r.period === p)?.total ?? 0)
    cumulative += inc - spend
    const [y, m] = p.split('-')
    const label  = new Date(Number(y), Number(m) - 1).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
    return { month: label, amount: Math.round(cumulative) }
  })

  return (
    <div className="space-y-6">
      {/* Month picker */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setPeriodIndex(i => Math.max(0, i - 1))}
          disabled={periodIndex === 0}
          className="text-[#DC9F85] disabled:text-[#35211A] text-lg leading-none px-1 transition-colors"
        >‹</button>
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
        >›</button>
      </div>

      {/* 4 KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Bills & Fixed"
          value={formatGBP(bills)}
          delta={pctDelta(bills, prevBills)}
          deltaLabel="vs last month"
        />
        <KpiCard
          label="Discretionary"
          value={formatGBP(discretionary)}
          delta={pctDelta(discretionary, prevDiscretionary)}
          deltaLabel="vs last month"
        />
        <KpiCard
          label="Income"
          value={income > 0 ? formatGBP(income) : '—'}
          delta={pctDelta(income, prevIncome)}
          deltaLabel="vs last month"
        />
        <KpiCard
          label="Cashflow"
          value={formatGBP(cashflow)}
          muted={cashflow < 0}
        />
      </div>

      {/* Discretionary Breakdown: total + treemap + sorted list */}
      {discretionaryItems.length > 0 && (
        <div className="border border-[#66473B] rounded p-5">
          <div className="flex items-baseline justify-between mb-4">
            <h2
              className="text-xs font-semibold text-[#B6A596] uppercase tracking-widest"
              style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
            >
              Discretionary Breakdown
            </h2>
            <span className="text-sm font-bold text-[#EBDCC4]" style={{ fontFamily: "'Clash Grotesk', sans-serif" }}>
              {formatGBP(discretionaryTotal)}
            </span>
          </div>
          <DiscretionaryTreemap data={discretionaryItems} />
          <div className="mt-4 space-y-1.5">
            {discretionaryItems.map(item => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <span className="text-[#B6A596]">{item.name}</span>
                <span className="text-[#EBDCC4] tabular-nums">{formatGBP(item.size)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cumulative Cashflow chart */}
      <div className="border border-[#66473B] rounded p-5">
        <h2
          className="text-xs font-semibold text-[#B6A596] uppercase tracking-widest mb-4"
          style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
        >
          Cumulative Cashflow
        </h2>
        <MonthlyTrendChart data={cashflowTrend} />
      </div>
    </div>
  )
}
