import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { INCOME_CATEGORIES, BILLS_CATEGORIES, TRANSIENT_CATEGORIES, bucketCategory } from '../lib/categories'
import MonthlyTrendChart from '../components/MonthlyTrendChart'

function formatGBP(n) {
  return `£${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export default function Categories() {
  const [sections, setSections]         = useState([])
  const [selected, setSelected]         = useState(null)
  const [monthData, setMonthData]       = useState([])
  const [yoy, setYoy]                   = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading]           = useState(true)

  // Load and bucket categories from transactions table
  useEffect(() => {
    async function loadCategories() {
      const { data, error } = await supabase.rpc('get_distinct_categories')
      if (error) { console.error('get_distinct_categories failed:', error.message); setLoading(false); return }
      const txCats = (data ?? []).map(r => r.category)

      const built = [
        { key: 'income',        label: 'Income',        categories: txCats.filter(c => INCOME_CATEGORIES.has(c)).sort() },
        { key: 'bills',         label: 'Bills & Fixed', categories: txCats.filter(c => !INCOME_CATEGORIES.has(c) && BILLS_CATEGORIES.has(c)).sort() },
        { key: 'discretionary', label: 'Discretionary', categories: txCats.filter(c => !INCOME_CATEGORIES.has(c) && bucketCategory(c) === 'discretionary').sort() },
        { key: 'transfers',     label: 'Transfers',     categories: txCats.filter(c => !INCOME_CATEGORIES.has(c) && TRANSIENT_CATEGORIES.has(c)).sort() },
      ].filter(s => s.categories.length > 0)

      setSections(built)
      const incomeCategories = built.find(s => s.key === 'income')?.categories ?? []
      setSelected(incomeCategories[0] ?? built[0]?.categories[0] ?? null)
      setLoading(false)
    }
    loadCategories()
  }, [])

  // Load transactions for selected category
  useEffect(() => {
    if (!selected) return
    async function load() {
      const { data } = await supabase
        .from('transactions')
        .select('date, amount, description')
        .eq('category', selected)
        .order('date', { ascending: false })
        .limit(10000)

      const combined = (data ?? []).sort((a, b) => b.date.localeCompare(a.date))
      setTransactions(combined)

      const monthMap = {}
      combined.forEach(t => {
        const mo = t.date.slice(0, 7)
        monthMap[mo] = (monthMap[mo] || 0) + Number(t.amount)
      })
      const trend = Object.entries(monthMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([mo, amount]) => {
          const [y, m] = mo.split('-')
          const label = new Date(Number(y), Number(m) - 1)
            .toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
          return { month: label, amount: Math.round(amount) }
        })

      const byYear = {}
      combined.forEach(t => {
        const yr = t.date.slice(0, 4)
        byYear[yr] = (byYear[yr] || 0) + Number(t.amount)
      })
      const years = Object.keys(byYear).sort()
      const cy = years[years.length - 1]
      const py = String(Number(cy) - 1)
      const yoyDelta = byYear[py]
        ? Math.round(((byYear[cy] - byYear[py]) / byYear[py]) * 100)
        : null

      setYoy({ cy, py, cyTotal: byYear[cy] ?? 0, pyTotal: byYear[py] ?? 0, delta: yoyDelta })
      setMonthData(trend)
    }
    load()
  }, [selected])

  if (loading) return <div className="text-[#B6A596] py-8">Loading…</div>

  return (
    <div className="space-y-6">
      {/* Grouped category cards */}
      <div className="space-y-4">
        {sections.map(section => (
          <div key={section.key}>
            <p
              className="text-xs font-semibold text-[#66473B] uppercase tracking-widest mb-2"
              style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
            >
              {section.label}
            </p>
            <div className="flex flex-wrap gap-2">
              {section.categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelected(cat)}
                  className={`px-3 py-1.5 rounded text-xs font-medium tracking-wide border transition-colors ${
                    selected === cat
                      ? 'border-[#DC9F85] text-[#DC9F85]'
                      : 'border-[#66473B] text-[#B6A596] hover:border-[#B6A596]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Detail panel */}
      {selected && (
        <>
          {yoy && (
            <div className="flex gap-4">
              <div className="flex-1 border border-[#66473B] rounded p-5">
                <p className="text-xs text-[#B6A596] uppercase tracking-widest">{yoy.py} Total</p>
                <p className="text-xl font-bold text-[#EBDCC4] mt-1" style={{ fontFamily: "'Clash Grotesk', sans-serif" }}>
                  {formatGBP(yoy.pyTotal)}
                </p>
              </div>
              <div className="flex-1 border border-[#66473B] rounded p-5">
                <p className="text-xs text-[#B6A596] uppercase tracking-widest">{yoy.cy} Total</p>
                <p className="text-xl font-bold text-[#EBDCC4] mt-1" style={{ fontFamily: "'Clash Grotesk', sans-serif" }}>
                  {formatGBP(yoy.cyTotal)}
                </p>
                {yoy.delta !== null && yoy.delta !== 0 && (
                  <p className={`text-xs mt-1 ${yoy.delta > 0 ? 'text-[#DC9F85]' : 'text-[#B6A596]'}`}>
                    {yoy.delta > 0 ? '↑' : '↓'} {Math.abs(yoy.delta)}% YoY
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="border border-[#66473B] rounded p-5">
            <h2 className="text-xs font-semibold text-[#B6A596] uppercase tracking-widest mb-4" style={{ fontFamily: "'Clash Grotesk', sans-serif" }}>
              {selected} — Monthly
            </h2>
            <MonthlyTrendChart data={monthData} />
          </div>

          <div className="border border-[#66473B] rounded">
            <div className="px-5 py-4 border-b border-[#35211A]">
              <h2 className="text-xs font-semibold text-[#B6A596] uppercase tracking-widest" style={{ fontFamily: "'Clash Grotesk', sans-serif" }}>
                Transactions in {selected}
              </h2>
            </div>
            <div>
              {transactions.map(tx => (
                <div
                  key={tx.date + tx.description + tx.amount}
                  className="px-5 py-3 flex justify-between text-sm border-b border-[#35211A] last:border-0"
                >
                  <div>
                    <p className="text-[#EBDCC4]">{tx.description}</p>
                    <p className="text-[#B6A596] text-xs mt-0.5">{tx.date}</p>
                  </div>
                  <p className={`font-medium ${Number(tx.amount) < 0 ? 'text-[#DC9F85]' : 'text-[#EBDCC4]'}`}>
                    {formatGBP(tx.amount)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
