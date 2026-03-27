// src/pages/Review.jsx
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { BILLS_CATEGORIES, TRANSIENT_CATEGORIES } from '../lib/categories'
import { nextPeriodBoundary, formatPeriodLabel } from '../lib/dateUtils'

function formatGBP(n) {
  return `£${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const SORT_PRIORITY = ['Clothing & shoes', 'General Merchandise']

function sortTransactions(txs) {
  const result = []
  for (const cat of SORT_PRIORITY) {
    result.push(...txs.filter(t => t.category === cat).sort((a, b) => b.date.localeCompare(a.date)))
  }
  const rest = txs
    .filter(t => !SORT_PRIORITY.includes(t.category))
    .sort((a, b) => a.category.localeCompare(b.category) || b.date.localeCompare(a.date))
  return [...result, ...rest]
}

export default function Review() {
  const [periods, setPeriods]         = useState([])
  const [periodIndex, setPeriodIndex] = useState(null)
  const [pending, setPending]         = useState([])
  const [tagged, setTagged]           = useState([])
  const [claim, setClaim]             = useState(null)
  const [loading, setLoading]         = useState(true)

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

    const excluded = [...BILLS_CATEGORIES, ...TRANSIENT_CATEGORIES]

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
        .not('category', 'in', `(${excluded.map(c => `"${c}"`).join(',')})`)
        .then(({ data, error }) => {
          if (error) { console.error('transactions query failed:', error.message); return [] }
          return data ?? []
        }),
    ]).then(([existingClaim, txs]) => {
      setClaim(existingClaim)
      if (!existingClaim) setPending(sortTransactions(txs))
      setLoading(false)
    })
  }, [period])

  async function tagPersonal(tx) {
    const { error } = await supabase.from('transactions').update({ category: 'Dulce Personal Purchases' }).eq('id', tx.id)
    if (!error) {
      setPending(prev => prev.filter(t => t.id !== tx.id))
      setTagged(prev => [...prev, { tx, tag: 'personal' }])
    }
  }

  async function tagWork(tx) {
    const { error } = await supabase.from('transactions').update({ category: 'Dulce Work Expenses' }).eq('id', tx.id)
    if (!error) {
      setPending(prev => prev.filter(t => t.id !== tx.id))
      setTagged(prev => [...prev, { tx, tag: 'work' }])
    }
  }

  function markDone(txId) {
    setPending(prev => prev.filter(t => t.id !== txId))
  }

  async function tagAllReviewed() {
    const totalPersonal = tagged.filter(t => t.tag === 'personal').reduce((s, t) => s + Number(t.tx.amount), 0)
    const totalWork     = tagged.filter(t => t.tag === 'work').reduce((s, t) => s + Number(t.tx.amount), 0)
    const { error } = await supabase
      .from('expense_claims')
      .upsert({ period, total_personal: totalPersonal, total_work: totalWork }, { onConflict: 'period' })
    if (!error) {
      setPending([])
      setClaim({ period, total_personal: totalPersonal, total_work: totalWork })
    }
  }

  async function markPersonalActioned() {
    const { error } = await supabase
      .from('expense_claims')
      .update({ personal_actioned_at: new Date().toISOString() })
      .eq('period', period)
    if (!error) setClaim(prev => ({ ...prev, personal_actioned_at: new Date().toISOString() }))
  }

  async function markWorkActioned() {
    const { error } = await supabase
      .from('expense_claims')
      .update({ work_actioned_at: new Date().toISOString() })
      .eq('period', period)
    if (!error) setClaim(prev => ({ ...prev, work_actioned_at: new Date().toISOString() }))
  }

  const taggedPersonal = tagged.filter(t => t.tag === 'personal')
  const taggedWork     = tagged.filter(t => t.tag === 'work')
  const totalPending   = pending.length + tagged.length

  if (periodIndex === null) return <div className="text-[#B6A596] py-8">Loading…</div>
  if (periods.length === 0) return <div className="text-[#B6A596] py-8">No data yet.</div>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setPeriodIndex(i => Math.max(0, i - 1))}
            disabled={periodIndex === 0}
            className="text-[#DC9F85] disabled:text-[#35211A] text-lg leading-none px-1 transition-colors"
          >‹</button>
          <span className="text-[#EBDCC4] text-sm uppercase tracking-widest font-semibold" style={{ fontFamily: "'Clash Grotesk', sans-serif" }}>
            {formatPeriodLabel(period)}
          </span>
          <button
            onClick={() => setPeriodIndex(i => Math.min(periods.length - 1, i + 1))}
            disabled={periodIndex === periods.length - 1}
            className="text-[#DC9F85] disabled:text-[#35211A] text-lg leading-none px-1 transition-colors"
          >›</button>
        </div>
        <div className="flex items-center gap-4">
          {!loading && !claim && (
            <span className="text-xs text-[#B6A596]">
              <span className="text-[#EBDCC4] font-semibold">{totalPending}</span> to review
            </span>
          )}
          {!claim && (
            <button
              onClick={tagAllReviewed}
              className="text-xs font-bold uppercase tracking-widest px-4 py-2 rounded border border-[#66473B] text-[#B6A596] hover:border-[#B6A596] transition-colors"
              style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
            >
              Tag all as reviewed
            </button>
          )}
        </div>
      </div>

      {/* Actioning view */}
      {claim && (
        <div className="space-y-4">
          {Number(claim.total_personal) > 0 && !claim.personal_actioned_at && (
            <div className="border border-[#66473B] rounded p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold text-[#B6A596] uppercase tracking-widest" style={{ fontFamily: "'Clash Grotesk', sans-serif" }}>
                  Personal — to transfer
                </h2>
                <span className="text-sm font-bold text-[#EBDCC4]" style={{ fontFamily: "'Clash Grotesk', sans-serif" }}>
                  {formatGBP(Number(claim.total_personal))}
                </span>
              </div>
              {taggedPersonal.map(({ tx }) => (
                <div key={tx.id} className="flex justify-between text-xs py-1.5 border-b border-[#35211A] last:border-0">
                  <div>
                    <p className="text-[#EBDCC4]">{tx.description}</p>
                    <p className="text-[#66473B] mt-0.5">{tx.date}</p>
                  </div>
                  <p className="text-[#EBDCC4]">{formatGBP(tx.amount)}</p>
                </div>
              ))}
              <button
                onClick={markPersonalActioned}
                className="mt-4 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded bg-[#DC9F85] text-[#181818] hover:opacity-90 transition-opacity"
                style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
              >
                I've done it — Personal
              </button>
            </div>
          )}
          {claim.personal_actioned_at && Number(claim.total_personal) > 0 && (
            <div className="border border-[#35211A] rounded p-5 flex justify-between items-center">
              <span className="text-xs text-[#66473B] uppercase tracking-widest">Personal transfer — done</span>
              <span className="text-sm text-[#66473B]">{formatGBP(Number(claim.total_personal))}</span>
            </div>
          )}

          {Number(claim.total_work) > 0 && !claim.work_actioned_at && (
            <div className="border border-[#66473B] rounded p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold text-[#B6A596] uppercase tracking-widest" style={{ fontFamily: "'Clash Grotesk', sans-serif" }}>
                  Work — to claim
                </h2>
                <span className="text-sm font-bold text-[#EBDCC4]" style={{ fontFamily: "'Clash Grotesk', sans-serif" }}>
                  {formatGBP(Number(claim.total_work))}
                </span>
              </div>
              {taggedWork.map(({ tx }) => (
                <div key={tx.id} className="flex justify-between text-xs py-1.5 border-b border-[#35211A] last:border-0">
                  <div>
                    <p className="text-[#EBDCC4]">{tx.description}</p>
                    <p className="text-[#66473B] mt-0.5">{tx.date}</p>
                  </div>
                  <p className="text-[#EBDCC4]">{formatGBP(tx.amount)}</p>
                </div>
              ))}
              <button
                onClick={markWorkActioned}
                className="mt-4 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded border border-[#DC9F85] text-[#DC9F85] hover:bg-[#DC9F85]/10 transition-colors"
                style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
              >
                I've done it — Work
              </button>
            </div>
          )}
          {claim.work_actioned_at && Number(claim.total_work) > 0 && (
            <div className="border border-[#35211A] rounded p-5 flex justify-between items-center">
              <span className="text-xs text-[#66473B] uppercase tracking-widest">Work claim — done</span>
              <span className="text-sm text-[#66473B]">{formatGBP(Number(claim.total_work))}</span>
            </div>
          )}

          {(!Number(claim.total_personal) || claim.personal_actioned_at) &&
           (!Number(claim.total_work)     || claim.work_actioned_at) && (
            <div className="px-5 py-8 text-center text-[#66473B] text-sm border border-[#35211A] rounded">
              All done for {formatPeriodLabel(period)}.
            </div>
          )}
        </div>
      )}

      {/* Active review list */}
      {!claim && (
        <div className="border border-[#66473B] rounded">
          {loading ? (
            <div className="px-5 py-8 text-[#B6A596] text-sm">Loading…</div>
          ) : pending.length === 0 && tagged.length === 0 ? (
            <div className="px-5 py-8 text-[#B6A596] text-sm">All done — nothing left to review.</div>
          ) : (
            <>
              {tagged.map(({ tx, tag }) => (
                <div key={`tagged-${tx.id}`} className="px-5 py-3 flex items-center gap-4 border-b border-[#35211A] bg-white/[0.03]">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#EBDCC4] truncate">{tx.description}</p>
                    <p className="text-xs text-[#66473B] mt-0.5">{tx.date} · <span className="text-[#B6A596]">{tx.category}</span></p>
                  </div>
                  <p className="text-sm font-medium text-[#EBDCC4] shrink-0">{formatGBP(tx.amount)}</p>
                  <span
                    className={`text-xs font-bold uppercase tracking-widest px-3 py-1 rounded shrink-0 ${
                      tag === 'personal' ? 'bg-[#DC9F85] text-[#181818]' : 'border border-[#DC9F85] text-[#DC9F85]'
                    }`}
                    style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
                  >
                    {tag === 'personal' ? 'Personal' : 'Work'}
                  </span>
                </div>
              ))}
              {pending.map((tx, idx) => (
                <div
                  key={tx.id}
                  className={`px-5 py-3 flex items-center gap-4 border-b border-[#35211A] last:border-0 ${idx % 2 === 1 ? 'bg-white/[0.02]' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#EBDCC4] truncate">{tx.description}</p>
                    <p className="text-xs text-[#66473B] mt-0.5">{tx.date} · <span className="text-[#B6A596]">{tx.category}</span></p>
                  </div>
                  <p className="text-sm font-medium text-[#EBDCC4] shrink-0">{formatGBP(tx.amount)}</p>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => tagPersonal(tx)}
                      className="text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded bg-[#DC9F85] text-[#181818] hover:opacity-90 transition-opacity"
                      style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
                    >Personal</button>
                    <button
                      onClick={() => tagWork(tx)}
                      className="text-xs font-medium uppercase tracking-widest px-3 py-1.5 rounded border border-[#DC9F85] text-[#DC9F85] hover:bg-[#DC9F85]/10 transition-colors"
                      style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
                    >Work</button>
                    <button
                      onClick={() => markDone(tx.id)}
                      className="text-xs font-medium uppercase tracking-widest px-3 py-1.5 rounded border border-[#66473B] text-[#B6A596] hover:border-[#B6A596] transition-colors"
                      style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
                    >Done</button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
