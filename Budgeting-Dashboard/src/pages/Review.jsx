// src/pages/Review.jsx
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { nextPeriodBoundary, formatPeriodLabel } from '../lib/dateUtils'
import CategorySelect from '../components/CategorySelect'
import CommentButton from '../components/CommentButton'
import { useAuth } from '../context/AuthContext'

function formatGBP(n) {
  return `£${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const REVIEW_CATEGORIES = [
  'Clothing & shoes',
  'General merchandise',
  'Dulce Personal Purchases',
  'Dulce Work Expenses',
]

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

const PencilIcon = () => (
  <svg width="8" height="8" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
    <path d="M8.5 1.5a1.5 1.5 0 0 1 2.12 2.12L4 10.24l-2.5.5.5-2.5L8.5 1.5z"/>
  </svg>
)

export default function Review() {
  const { user } = useAuth()
  const [periods, setPeriods]         = useState([])
  const [periodIndex, setPeriodIndex] = useState(null)
  const [pending, setPending]         = useState([])
  const [tagged, setTagged]           = useState([])
  const [flags, setFlags]             = useState({})
  const [claim, setClaim]             = useState(null)
  const [loading, setLoading]         = useState(true)
  const [editingChipId, setEditingChipId] = useState(null)
  const [expandedTagId, setExpandedTagId] = useState(null)
  const [allCategories, setAllCategories] = useState([])

  useEffect(() => {
    supabase.rpc('get_distinct_categories').then(({ data }) => {
      setAllCategories((data ?? []).map(r => r.category).sort())
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
    let ignore = false
    setLoading(true)
    setEditingChipId(null)
    setExpandedTagId(null)

    async function load() {
      const [{ data: claimData }, { data: txData, error: txError }] = await Promise.all([
        supabase.from('expense_claims').select('*').eq('period', period),
        supabase.from('transactions')
          .select('id, date, description, amount, category')
          .gte('date', `${period}-01`)
          .lt('date', nextPeriodBoundary(period))
          .in('category', REVIEW_CATEGORIES),
      ])

      if (txError) {
        console.error('transactions query failed:', txError.message)
        if (!ignore) setLoading(false)
        return
      }

      const txs = txData ?? []
      const ids = txs.map(t => t.id)

      const { data: flagData } = ids.length > 0
        ? await supabase.from('flags').select('id, transaction_id, type, comment, created_at').in('transaction_id', ids)
        : { data: [] }

      const allFlags = flagData ?? []
      const dismissedIds = new Set(allFlags.filter(f => f.type === 'dismiss').map(f => f.transaction_id))

      const flagMap = {}
      allFlags.filter(f => f.type === 'comment').forEach(f => {
        if (!flagMap[f.transaction_id]) flagMap[f.transaction_id] = []
        flagMap[f.transaction_id].push(f)
      })

      const preTagged = txs
        .filter(t => ALREADY_TAGGED.includes(t.category))
        .map(t => ({ tx: t, tag: t.category === 'Dulce Personal Purchases' ? 'personal' : 'work' }))

      const pendingTxs = txs.filter(t => !ALREADY_TAGGED.includes(t.category) && !dismissedIds.has(t.id))

      if (!ignore) {
        setClaim(claimData?.[0] ?? null)
        setFlags(flagMap)
        setPending(sortTransactions(pendingTxs))
        setTagged(preTagged)
        setLoading(false)
      }
    }

    load()
    return () => { ignore = true }
  }, [period])

  async function dismiss(tx) {
    const { error } = await supabase.from('flags').insert({
      transaction_id: tx.id,
      user_id: user.id,
      comment: null,
      type: 'dismiss',
    })
    if (!error) {
      setPending(prev => prev.filter(t => t.id !== tx.id))
    }
  }

  async function tagAs(tx, tag) {
    const newCat = tag === 'personal' ? 'Dulce Personal Purchases' : 'Dulce Work Expenses'
    const { error } = await supabase.from('transactions').update({ category: newCat }).eq('id', tx.id)
    if (!error) {
      setPending(prev => prev.filter(t => t.id !== tx.id))
      setTagged(prev => [...prev, { tx: { ...tx, category: newCat }, tag }])
    }
  }

  // Called when the category chip is saved on a PENDING row
  function handlePendingChipSaved(txId, newCategory) {
    setEditingChipId(null)
    if (REVIEW_CATEGORIES.includes(newCategory)) {
      // Update chip in place — stay in pending
      setPending(prev => sortTransactions(prev.map(t => t.id === txId ? { ...t, category: newCategory } : t)))
    } else {
      // Category moved outside review — drop from pending
      setPending(prev => prev.filter(t => t.id !== txId))
    }
  }

  // Called when the category chip is saved on a TAGGED row
  function handleTaggedChipSaved(txId, newCategory) {
    setEditingChipId(null)
    const newTag = newCategory === 'Dulce Personal Purchases'
      ? 'personal'
      : newCategory === 'Dulce Work Expenses'
        ? 'work'
        : null

    if (newTag) {
      // Stay in tagged with updated category/tag
      setTagged(prev => prev.map(t =>
        t.tx.id === txId ? { tx: { ...t.tx, category: newCategory }, tag: newTag } : t
      ))
    } else if (REVIEW_CATEGORIES.includes(newCategory)) {
      // Moved to a non-tagged review category — back to pending
      setTagged(prev => {
        const item = prev.find(t => t.tx.id === txId)
        if (item) setPending(p => sortTransactions([...p, { ...item.tx, category: newCategory }]))
        return prev.filter(t => t.tx.id !== txId)
      })
    } else {
      // Moved outside review entirely — remove from both
      setTagged(prev => prev.filter(t => t.tx.id !== txId))
    }
  }

  async function retag(tx, newCategory) {
    const { error } = await supabase.from('transactions').update({ category: newCategory }).eq('id', tx.id)
    if (!error) {
      handleTaggedChipSaved(tx.id, newCategory)
      setExpandedTagId(null)
    }
  }

  // Summary stats
  const personalTxs   = tagged.filter(t => t.tag === 'personal')
  const personalSpend = personalTxs.filter(t => Number(t.tx.amount) > 0).reduce((s, t) => s + Number(t.tx.amount), 0)
  const personalIn    = personalTxs.filter(t => Number(t.tx.amount) < 0).reduce((s, t) => s + Math.abs(Number(t.tx.amount)), 0)
  const workTxs       = tagged.filter(t => t.tag === 'work')
  const workSpend     = workTxs.filter(t => Number(t.tx.amount) > 0).reduce((s, t) => s + Number(t.tx.amount), 0)
  const workIn        = workTxs.filter(t => Number(t.tx.amount) < 0).reduce((s, t) => s + Math.abs(Number(t.tx.amount)), 0)

  async function markPersonalActioned() {
    const { error } = await supabase.from('expense_claims').upsert(
      { period, total_personal: personalSpend, total_work: claim?.total_work ?? workSpend, personal_actioned_at: new Date().toISOString() },
      { onConflict: 'period' }
    )
    if (!error) setClaim(prev => ({
      ...(prev ?? { period, total_personal: personalSpend, total_work: workSpend }),
      personal_actioned_at: new Date().toISOString(),
    }))
  }

  async function markWorkActioned() {
    const { error } = await supabase.from('expense_claims').upsert(
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
          aria-label="Previous period"
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
          aria-label="Next period"
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
            {/* Pending section */}
            {pending.length > 0 && (
              <>
                <div
                  className="px-5 py-1.5 text-[9px] font-bold tracking-[0.14em] uppercase text-[#35211A] bg-[#0c0704] border-b border-[#1e110c]"
                  style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
                >
                  To review · {pending.length} remaining
                </div>
                {pending.map((tx, idx) => (
                  <div
                    key={`pending-${tx.id}`}
                    className={`px-5 py-3 flex items-center gap-3 border-b border-[#35211A] ${idx % 2 === 1 ? 'bg-white/[0.02]' : ''}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#EBDCC4] truncate">{tx.description}</p>
                      <p className="text-xs text-[#66473B] mt-0.5 flex items-center gap-1 flex-wrap">
                        {tx.date} ·{' '}
                        {editingChipId === tx.id ? (
                          <CategorySelect
                            value={tx.category}
                            allCategories={allCategories}
                            txId={tx.id}
                            onSave={cat => handlePendingChipSaved(tx.id, cat)}
                            onCancel={() => setEditingChipId(null)}
                          />
                        ) : (
                          <button
                            onClick={() => setEditingChipId(tx.id)}
                            className="inline-flex items-center gap-1 border border-[#35211A] text-[#B6A596] rounded px-1.5 py-0.5 hover:border-[#DC9F85] hover:text-[#DC9F85] transition-colors text-[10px]"
                          >
                            {tx.category}
                            <PencilIcon />
                          </button>
                        )}
                      </p>
                    </div>
                    <p className={`text-sm font-medium shrink-0 ${Number(tx.amount) < 0 ? 'text-[#B6A596]' : 'text-[#EBDCC4]'}`}>
                      {Number(tx.amount) < 0 ? '+' : '−'}{formatGBP(Math.abs(Number(tx.amount)))}
                    </p>
                    <div className="flex gap-1.5 shrink-0 items-center">
                      <button
                        onClick={() => tagAs(tx, 'personal')}
                        className="text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded bg-[#DC9F85] text-[#181818] hover:opacity-90 transition-opacity"
                        style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
                      >Personal</button>
                      <button
                        onClick={() => tagAs(tx, 'work')}
                        className="text-xs font-semibold uppercase tracking-widest px-3 py-1.5 rounded border border-[#DC9F85] text-[#DC9F85] bg-[#DC9F85]/[0.08] hover:bg-[#DC9F85]/20 transition-colors"
                        style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
                      >Work</button>
                      <button
                        onClick={() => dismiss(tx)}
                        className="text-xs font-medium uppercase tracking-widest px-3 py-1.5 rounded border border-[#35211A] text-[#66473B] hover:border-[#B6A596] hover:text-[#B6A596] transition-colors"
                        style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
                      >Dismiss</button>
                      <CommentButton transactionId={tx.id} existingFlags={flags[tx.id] || []} />
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Tagged section */}
            {tagged.length > 0 && (
              <>
                <div
                  className="px-5 py-1.5 text-[9px] font-bold tracking-[0.14em] uppercase text-[#66473B] bg-[#0c0704] border-b border-[#1e110c]"
                  style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
                >
                  Tagged this period · {tagged.length} {tagged.length === 1 ? 'item' : 'items'}
                </div>
                {tagged.map(({ tx, tag }) => (
                  <div
                    key={`tagged-${tx.id}`}
                    className="px-5 py-3 flex items-center gap-3 border-b border-[#35211A] last:border-0 bg-white/[0.03]"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#EBDCC4] truncate">{tx.description}</p>
                      <p className="text-xs text-[#66473B] mt-0.5 flex items-center gap-1 flex-wrap">
                        {tx.date} ·{' '}
                        {editingChipId === tx.id ? (
                          <CategorySelect
                            value={tx.category}
                            allCategories={allCategories}
                            txId={tx.id}
                            onSave={cat => handleTaggedChipSaved(tx.id, cat)}
                            onCancel={() => setEditingChipId(null)}
                          />
                        ) : (
                          <button
                            onClick={() => setEditingChipId(tx.id)}
                            className="inline-flex items-center gap-1 border border-[#35211A] text-[#B6A596] rounded px-1.5 py-0.5 hover:border-[#DC9F85] hover:text-[#DC9F85] transition-colors text-[10px]"
                          >
                            {tx.category}
                            <PencilIcon />
                          </button>
                        )}
                      </p>
                    </div>
                    <p className={`text-sm font-medium shrink-0 ${Number(tx.amount) < 0 ? 'text-[#B6A596]' : 'text-[#EBDCC4]'}`}>
                      {Number(tx.amount) < 0 ? '+' : '−'}{formatGBP(Math.abs(Number(tx.amount)))}
                    </p>
                    <div className="flex gap-1.5 shrink-0 items-center">
                      <div className="relative">
                        <button
                          onClick={() => setExpandedTagId(id => id === tx.id ? null : tx.id)}
                          className={`text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded hover:opacity-80 transition-opacity ${
                            tag === 'personal' ? 'bg-[#DC9F85] text-[#181818]' : 'border border-[#DC9F85] text-[#DC9F85] bg-[#DC9F85]/[0.08]'
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
                                className="px-4 py-2 text-xs font-semibold uppercase tracking-widest text-left text-[#DC9F85] hover:bg-[#DC9F85]/10 border-b border-[#35211A]"
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
                      <CommentButton transactionId={tx.id} existingFlags={flags[tx.id] || []} />
                    </div>
                  </div>
                ))}
              </>
            )}
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
                <th className="pb-2 text-xs text-[#66473B] text-right font-normal pl-4">Delta</th>
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
                  <td className="py-2 text-xs text-right font-medium tabular-nums pl-4">
                    {(() => { const d = personalSpend - personalIn; return d === 0 ? <span className="text-[#66473B]">—</span> : <span className={d > 0 ? 'text-[#DC9F85]' : 'text-[#B6A596]'}>{d > 0 ? '−' : '+'}{formatGBP(Math.abs(d))}</span> })()}
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
                  <td className="py-2 text-xs text-right font-medium tabular-nums pl-4">
                    {(() => { const d = workSpend - workIn; return d === 0 ? <span className="text-[#66473B]">—</span> : <span className={d > 0 ? 'text-[#DC9F85]' : 'text-[#B6A596]'}>{d > 0 ? '−' : '+'}{formatGBP(Math.abs(d))}</span> })()}
                  </td>
                  <td className="py-2 text-right pl-4">
                    {claim?.work_actioned_at ? (
                      <span className="text-xs text-[#66473B] uppercase tracking-widest">✓ Done</span>
                    ) : (
                      <button
                        onClick={markWorkActioned}
                        className="text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded border border-[#DC9F85] text-[#DC9F85] bg-[#DC9F85]/[0.08] hover:bg-[#DC9F85]/20 transition-colors"
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
