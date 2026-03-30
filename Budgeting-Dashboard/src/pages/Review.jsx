// src/pages/Review.jsx
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { nextPeriodBoundary, formatPeriodLabel } from '../lib/dateUtils'

function formatGBP(n) {
  return `£${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Only these categories are shown in Review
const REVIEW_CATEGORIES = [
  'Clothing & shoes',
  'General merchandise',
  'Dulce Personal Purchases',
  'Dulce Work Expenses',
]

// Categories that arrive pre-tagged — pre-populate tagged list on load
const ALREADY_TAGGED = ['Dulce Personal Purchases', 'Dulce Work Expenses']

const SORT_ORDER = [
  'Clothing & shoes',
  'General merchandise',
  'Dulce Personal Purchases',
  'Dulce Work Expenses',
]

function sortTransactions(txs) {
  const result = []
  for (const cat of SORT_ORDER) {
    result.push(...txs.filter(t => t.category === cat).sort((a, b) => b.date.localeCompare(a.date)))
  }
  const rest = txs
    .filter(t => !SORT_ORDER.includes(t.category))
    .sort((a, b) => a.category.localeCompare(b.category) || b.date.localeCompare(a.date))
  return [...result, ...rest]
}

export default function Review() {
  const [periods, setPeriods]         = useState([])
  const [periodIndex, setPeriodIndex] = useState(null)
  const [pending, setPending]         = useState([])
  const [tagged, setTagged]           = useState([]) // { tx, tag: 'personal' | 'work' }
  const [claim, setClaim]             = useState(null)
  const [loading, setLoading]         = useState(true)
  const [expandedTagId, setExpandedTagId] = useState(null)
  const [allCategories, setAllCategories] = useState([])

  // Load all distinct categories for the retag dropdown
  useEffect(() => {
    supabase.rpc('get_distinct_categories').then(({ data }) => {
      const cats = (data ?? []).map(r => r.category).sort()
      setAllCategories(cats)
    })
  }, [])

  useEffect(() => {
    supabase
      .from('uploads')
      .select('period')
      .order('period', { ascending: true })
      .then(({ data, error }) => {
        if (error) { console.error('uploads query failed:', error.message); return }
        const ps = data?.map(r => r.period) ?? []
        setPeriods(ps)
        setPeriodIndex(ps.length - 1)
      })
  }, [])

  const period = periodIndex !== null ? periods[periodIndex] : null

  useEffect(() => {
    if (!period) return
    setLoading(true)
    setPending([])
    setTagged([])
    setClaim(null)
    setExpandedTagId(null)

    Promise.all([
      supabase
        .from('expense_claims')
        .select('*')
        .eq('period', period)
        .then(({ data, error }) => {
          if (error) console.error('expense_claims query failed:', error.message)
          return data?.[0] ?? null
        }),
      supabase
        .from('transactions')
        .select('id, date, description, amount, category')
        .gte('date', `${period}-01`)
        .lt('date', nextPeriodBoundary(period))
        .in('category', REVIEW_CATEGORIES)
        .then(({ data, error }) => {
          if (error) { console.error('transactions query failed:', error.message); return [] }
          return data ?? []
        }),
    ]).then(([existingClaim, txs]) => {
      setClaim(existingClaim)

      const preTagged = txs
        .filter(t => ALREADY_TAGGED.includes(t.category))
        .map(t => ({
          tx: t,
          tag: t.category === 'Dulce Personal Purchases' ? 'personal' : 'work',
        }))

      const pendingTxs = txs.filter(t => !ALREADY_TAGGED.includes(t.category))

      setPending(sortTransactions(pendingTxs))
      setTagged(preTagged)
      setLoading(false)
    })
  }, [period])

  function dismiss(tx) {
    setPending(prev => prev.filter(t => t.id !== tx.id))
  }

  async function tagAs(tx, tag) {
    const newCat = tag === 'personal' ? 'Dulce Personal Purchases' : 'Dulce Work Expenses'
    const { error } = await supabase
      .from('transactions')
      .update({ category: newCat })
      .eq('id', tx.id)
    if (!error) {
      setPending(prev => prev.filter(t => t.id !== tx.id))
      setTagged(prev => [...prev, { tx: { ...tx, category: newCat }, tag }])
    }
  }

  async function retag(tx, newCategory) {
    const { error } = await supabase
      .from('transactions')
      .update({ category: newCategory })
      .eq('id', tx.id)
    if (!error) {
      const newTag = newCategory === 'Dulce Personal Purchases'
        ? 'personal'
        : newCategory === 'Dulce Work Expenses'
          ? 'work'
          : null

      if (newTag) {
        // Stay in tagged list with updated tag
        setTagged(prev => prev.map(t =>
          t.tx.id === tx.id ? { tx: { ...t.tx, category: newCategory }, tag: newTag } : t
        ))
      } else {
        // Move back to pending
        setTagged(prev => prev.filter(t => t.tx.id !== tx.id))
        setPending(prev => sortTransactions([...prev, { ...tx, category: newCategory }]))
      }
      setExpandedTagId(null)
    }
  }

  // Summary stats — split by spend (positive) and credits (negative)
  const personalTxs  = tagged.filter(t => t.tag === 'personal')
  const personalSpend = personalTxs.filter(t => Number(t.tx.amount) > 0).reduce((s, t) => s + Number(t.tx.amount), 0)
  const personalIn    = personalTxs.filter(t => Number(t.tx.amount) < 0).reduce((s, t) => s + Math.abs(Number(t.tx.amount)), 0)

  const workTxs   = tagged.filter(t => t.tag === 'work')
  const workSpend = workTxs.filter(t => Number(t.tx.amount) > 0).reduce((s, t) => s + Number(t.tx.amount), 0)
  const workIn    = workTxs.filter(t => Number(t.tx.amount) < 0).reduce((s, t) => s + Math.abs(Number(t.tx.amount)), 0)

  async function markPersonalActioned() {
    const { error } = await supabase
      .from('expense_claims')
      .upsert(
        { period, total_personal: personalSpend, total_work: claim?.total_work ?? workSpend, personal_actioned_at: new Date().toISOString() },
        { onConflict: 'period' }
      )
    if (!error) setClaim(prev => ({
      ...(prev ?? { period, total_personal: personalSpend, total_work: workSpend }),
      personal_actioned_at: new Date().toISOString(),
    }))
  }

  async function markWorkActioned() {
    const { error } = await supabase
      .from('expense_claims')
      .upsert(
        { period, total_personal: claim?.total_personal ?? personalSpend, total_work: workSpend, work_actioned_at: new Date().toISOString() },
        { onConflict: 'period' }
      )
    if (!error) setClaim(prev => ({
      ...(prev ?? { period, total_personal: personalSpend, total_work: workSpend }),
      work_actioned_at: new Date().toISOString(),
    }))
  }

  if (periodIndex === null) return <div className="text-[#B6A596] py-8">Loading…</div>
  if (periods.length === 0) return <div className="text-[#B6A596] py-8">No data yet.</div>

  return (
    <div className="space-y-6">
      {/* Period selector */}
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

      {/* Transaction list */}
      <div className="border border-[#66473B] rounded">
        {loading ? (
          <div className="px-5 py-8 text-[#B6A596] text-sm">Loading…</div>
        ) : pending.length === 0 && tagged.length === 0 ? (
          <div className="px-5 py-8 text-[#B6A596] text-sm">Nothing to review this period.</div>
        ) : (
          <>
            {/* Already-tagged items */}
            {tagged.map(({ tx, tag }) => (
              <div
                key={`tagged-${tx.id}`}
                className="px-5 py-3 flex items-center gap-4 border-b border-[#35211A] bg-white/[0.03]"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#EBDCC4] truncate">{tx.description}</p>
                  <p className="text-xs text-[#66473B] mt-0.5">{tx.date} · <span className="text-[#B6A596]">{tx.category}</span></p>
                </div>
                <p className={`text-sm font-medium shrink-0 ${Number(tx.amount) < 0 ? 'text-[#B6A596]' : 'text-[#EBDCC4]'}`}>
                  {Number(tx.amount) < 0 ? '+' : ''}{formatGBP(Math.abs(Number(tx.amount)))}
                </p>
                <div className="relative shrink-0">
                  <button
                    onClick={() => setExpandedTagId(id => id === tx.id ? null : tx.id)}
                    className={`text-xs font-bold uppercase tracking-widest px-3 py-1 rounded hover:opacity-80 transition-opacity ${
                      tag === 'personal' ? 'bg-[#DC9F85] text-[#181818]' : 'border border-[#DC9F85] text-[#DC9F85]'
                    }`}
                    style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
                  >
                    {tag === 'personal' ? 'Personal' : 'Work'} ▾
                  </button>
                  {expandedTagId === tx.id && (
                    <div className="absolute right-0 top-full mt-1 z-10 bg-[#1F1410] border border-[#66473B] rounded shadow-lg flex flex-col min-w-max max-h-64 overflow-y-auto">
                      {tag !== 'personal' && (
                        <button
                          onClick={() => retag(tx, 'Dulce Personal Purchases')}
                          className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-left bg-[#DC9F85]/10 text-[#DC9F85] hover:bg-[#DC9F85]/20 border-b border-[#35211A]"
                          style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
                        >Personal</button>
                      )}
                      {tag !== 'work' && (
                        <button
                          onClick={() => retag(tx, 'Dulce Work Expenses')}
                          className="px-4 py-2 text-xs font-medium uppercase tracking-widest text-left text-[#DC9F85] hover:bg-[#DC9F85]/10 border-b border-[#35211A]"
                          style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
                        >Work</button>
                      )}
                      {allCategories
                        .filter(c => c !== 'Dulce Personal Purchases' && c !== 'Dulce Work Expenses' && c !== tx.category)
                        .map(cat => (
                          <button
                            key={cat}
                            onClick={() => retag(tx, cat)}
                            className="px-4 py-2 text-xs text-left text-[#B6A596] hover:bg-white/[0.05] border-b border-[#35211A] last:border-0"
                            style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
                          >↩ {cat}</button>
                        ))
                      }
                      <button
                        onClick={() => setExpandedTagId(null)}
                        className="px-4 py-2 text-xs text-left text-[#66473B] hover:bg-white/[0.05]"
                      >✕ Close</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {/* Pending items */}
            {pending.map((tx, idx) => (
              <div
                key={tx.id}
                className={`px-5 py-3 flex items-center gap-4 border-b border-[#35211A] last:border-0 ${idx % 2 === 1 ? 'bg-white/[0.02]' : ''}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#EBDCC4] truncate">{tx.description}</p>
                  <p className="text-xs text-[#66473B] mt-0.5">{tx.date} · <span className="text-[#B6A596]">{tx.category}</span></p>
                </div>
                <p className={`text-sm font-medium shrink-0 ${Number(tx.amount) < 0 ? 'text-[#B6A596]' : 'text-[#EBDCC4]'}`}>
                  {Number(tx.amount) < 0 ? '+' : ''}{formatGBP(Math.abs(Number(tx.amount)))}
                </p>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => tagAs(tx, 'personal')}
                    className="text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded bg-[#DC9F85] text-[#181818] hover:opacity-90 transition-opacity"
                    style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
                  >Personal</button>
                  <button
                    onClick={() => tagAs(tx, 'work')}
                    className="text-xs font-medium uppercase tracking-widest px-3 py-1.5 rounded border border-[#DC9F85] text-[#DC9F85] hover:bg-[#DC9F85]/10 transition-colors"
                    style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
                  >Work</button>
                  <button
                    onClick={() => dismiss(tx)}
                    className="text-xs font-medium px-3 py-1.5 rounded border border-[#66473B] text-[#B6A596] hover:border-[#B6A596] transition-colors"
                    style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
                  >Dismiss</button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Summary table */}
      {(personalSpend > 0 || personalIn > 0 || workSpend > 0 || workIn > 0) && (
        <div className="border border-[#66473B] rounded p-5">
          <h2
            className="text-xs font-semibold text-[#B6A596] uppercase tracking-widest mb-4"
            style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
          >
            Transfers this period
          </h2>
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#35211A]">
                <th className="pb-2 text-xs text-[#66473B] text-left font-normal"></th>
                <th className="pb-2 text-xs text-[#66473B] text-right font-normal">Spend</th>
                <th className="pb-2 text-xs text-[#66473B] text-right font-normal pl-4">Transferred in</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(personalSpend > 0 || personalIn > 0) && (
                <tr className="border-b border-[#35211A] last:border-0">
                  <td className="py-2 text-xs text-[#B6A596]">Personal</td>
                  <td className="py-2 text-xs text-right font-medium text-[#EBDCC4] tabular-nums">
                    {personalSpend > 0 ? formatGBP(personalSpend) : <span className="text-[#35211A]">—</span>}
                  </td>
                  <td className="py-2 text-xs text-right font-medium text-[#B6A596] tabular-nums pl-4">
                    {personalIn > 0 ? formatGBP(personalIn) : <span className="text-[#35211A]">—</span>}
                  </td>
                  <td className="py-2 text-right pl-4">
                    {claim?.personal_actioned_at ? (
                      <span className="text-xs text-[#66473B] uppercase tracking-widest">✓ Done</span>
                    ) : (
                      <button
                        onClick={markPersonalActioned}
                        className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded bg-[#DC9F85] text-[#181818] hover:opacity-90 transition-opacity"
                        style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
                      >Mark done</button>
                    )}
                  </td>
                </tr>
              )}
              {(workSpend > 0 || workIn > 0) && (
                <tr className="border-b border-[#35211A] last:border-0">
                  <td className="py-2 text-xs text-[#B6A596]">Work claim</td>
                  <td className="py-2 text-xs text-right font-medium text-[#EBDCC4] tabular-nums">
                    {workSpend > 0 ? formatGBP(workSpend) : <span className="text-[#35211A]">—</span>}
                  </td>
                  <td className="py-2 text-xs text-right font-medium text-[#B6A596] tabular-nums pl-4">
                    {workIn > 0 ? formatGBP(workIn) : <span className="text-[#35211A]">—</span>}
                  </td>
                  <td className="py-2 text-right pl-4">
                    {claim?.work_actioned_at ? (
                      <span className="text-xs text-[#66473B] uppercase tracking-widest">✓ Done</span>
                    ) : (
                      <button
                        onClick={markWorkActioned}
                        className="text-xs font-medium uppercase tracking-widest px-3 py-1 rounded border border-[#DC9F85] text-[#DC9F85] hover:bg-[#DC9F85]/10 transition-colors"
                        style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
                      >Mark done</button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
