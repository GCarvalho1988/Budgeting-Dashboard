import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import KpiCard from '../components/KpiCard'
import CategoryBarChart from '../components/CategoryBarChart'
import MonthlyTrendChart from '../components/MonthlyTrendChart'

function formatGBP(n) {
  return `£${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function Overview() {
  const [loading, setLoading] = useState(true)
  const [kpis, setKpis] = useState(null)
  const [categoryData, setCategoryData] = useState([])
  const [trendData, setTrendData] = useState([])

  useEffect(() => {
    async function load() {
      // Get latest period
      const { data: latest } = await supabase
        .from('uploads')
        .select('period')
        .order('period', { ascending: false })
        .limit(1)
        .single()

      if (!latest) { setLoading(false); return }
      const period = latest.period
      const [y, m] = period.split('-')
      const lastYearPeriod = `${Number(y) - 1}-${m}`

      // Current month transactions
      const { data: currentTx } = await supabase
        .from('transactions')
        .select('amount, category')
        .gte('date', `${period}-01`)
        .lt('date', `${period}-32`)

      const currentTotal = currentTx?.reduce((s, t) => s + Number(t.amount), 0) ?? 0

      // Same month last year
      const { data: lastYearTx } = await supabase
        .from('transactions')
        .select('amount')
        .gte('date', `${lastYearPeriod}-01`)
        .lt('date', `${lastYearPeriod}-32`)

      const lastYearTotal = lastYearTx?.reduce((s, t) => s + Number(t.amount), 0) ?? 0
      const yoyDelta = lastYearTotal > 0
        ? Math.round(((currentTotal - lastYearTotal) / lastYearTotal) * 100)
        : null

      // Category breakdown for current month
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

      // Monthly trend (all months)
      const { data: allTx } = await supabase
        .from('transactions')
        .select('date, amount')
        .order('date', { ascending: true })

      const monthMap = {}
      allTx?.forEach(t => {
        const mo = t.date.slice(0, 7)
        monthMap[mo] = (monthMap[mo] || 0) + Number(t.amount)
      })
      const trend = Object.entries(monthMap).slice(-12).map(([mo, amount]) => {
        const [ty, tm] = mo.split('-')
        const label = new Date(Number(ty), Number(tm) - 1)
          .toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
        return { month: label, amount: Math.round(amount) }
      })

      setKpis({ currentTotal, yoyDelta, topCat, flagCount: flagCount ?? 0 })
      setCategoryData(sortedCats)
      setTrendData(trend)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="text-gray-400 py-8">Loading…</div>
  if (!kpis) return <div className="text-gray-400 py-8">No data yet. Upload a CSV to get started.</div>

  return (
    <div className="space-y-6">
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
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Spend by Category</h2>
        <CategoryBarChart data={categoryData} />
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Monthly Trend</h2>
        <MonthlyTrendChart data={trendData} />
      </div>
    </div>
  )
}
