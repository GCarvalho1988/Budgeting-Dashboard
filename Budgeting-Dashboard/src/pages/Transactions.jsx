import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import CommentButton from '../components/CommentButton'

function formatGBP(n) {
  return `£${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Inline category select — shown when a category chip is clicked
function CategorySelect({ value, allCategories, txId, onSave, onCancel }) {
  const [selected, setSelected] = useState(value)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function save() {
    if (selected === value) { onCancel(); return }
    setSaving(true)
    const { error: err } = await supabase
      .from('transactions')
      .update({ category: selected })
      .eq('id', txId)
    if (err) {
      setError('Save failed')
      setSaving(false)
    } else {
      onSave(selected)
    }
  }

  return (
    <div className="flex items-center gap-1">
      <select
        value={selected}
        onChange={e => setSelected(e.target.value)}
        className="bg-[#181818] border border-[#DC9F85] text-[#EBDCC4] text-xs rounded px-2 py-1 focus:outline-none"
        autoFocus
      >
        {allCategories.map(c => (
          <option key={c} value={c} className="bg-[#181818]">{c}</option>
        ))}
      </select>
      <button
        onClick={save}
        disabled={saving}
        className="text-xs bg-[#DC9F85] text-[#181818] font-bold px-2 py-1 rounded disabled:opacity-50"
      >
        {saving ? '…' : '✓'}
      </button>
      <button onClick={onCancel} className="text-xs text-[#B6A596] hover:text-[#EBDCC4] px-1">✕</button>
      {error && <span className="text-xs text-[#DC9F85]">{error}</span>}
    </div>
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

export default function Transactions() {
  const [transactions, setTransactions] = useState([])
  const [flags, setFlags] = useState({})
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ month: '', category: '', minAmount: '', maxAmount: '' })
  const [allCategories, setAllCategories] = useState([])
  const [months, setMonths] = useState([])
  const [editingCategory, setEditingCategory] = useState(null) // txId being edited

  useEffect(() => {
    async function load() {
      const { data: tx } = await supabase
        .from('transactions')
        .select('id, date, description, amount, category')
        .order('date', { ascending: false })
        .limit(10000)

      const { data: flagData } = await supabase
        .from('flags')
        .select('id, transaction_id, comment, created_at')

      const flagMap = {}
      flagData?.forEach(f => {
        if (!flagMap[f.transaction_id]) flagMap[f.transaction_id] = []
        flagMap[f.transaction_id].push(f)
      })

      // Fetch distinct categories from RPC (may differ from transaction sample)
      const { data: catData } = await supabase.rpc('get_distinct_categories')

      setTransactions(tx || [])
      setFlags(flagMap)
      setAllCategories(catData?.map(r => r.category) ?? [...new Set(tx?.map(t => t.category))].sort())
      setMonths([...new Set(tx?.map(t => t.date.slice(0, 7)))].sort().reverse())
      setLoading(false)
    }
    load()
  }, [])

  function handleCategorySaved(txId, newCategory) {
    setTransactions(txs => txs.map(t => t.id === txId ? { ...t, category: newCategory } : t))
    setEditingCategory(null)
  }

  const filtered = transactions.filter(tx => {
    if (filters.month && !tx.date.startsWith(filters.month)) return false
    if (filters.category && tx.category !== filters.category) return false
    if (filters.minAmount !== '' && Number(tx.amount) < filters.minAmount) return false
    if (filters.maxAmount !== '' && Number(tx.amount) > filters.maxAmount) return false
    return true
  })

  if (loading) return <div className="text-[#B6A596] py-8">Loading…</div>

  const selectClass = "bg-[#181818] border border-[#66473B] text-[#B6A596] text-xs rounded px-3 py-2 focus:outline-none focus:border-[#DC9F85] transition-colors"
  const inputClass = "w-20 bg-[#181818] border border-[#66473B] text-[#B6A596] text-xs rounded px-2 py-2 placeholder-[#66473B] focus:outline-none focus:border-[#DC9F85] transition-colors"

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={filters.month}
          onChange={e => setFilters(f => ({ ...f, month: e.target.value }))}
          className={selectClass}
        >
          <option value="">All months</option>
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select
          value={filters.category}
          onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}
          className={selectClass}
        >
          <option value="">All categories</option>
          {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input
          type="number"
          placeholder="Min £"
          onChange={e => setFilters(f => ({ ...f, minAmount: e.target.value ? Number(e.target.value) : '' }))}
          className={inputClass}
        />
        <input
          type="number"
          placeholder="Max £"
          onChange={e => setFilters(f => ({ ...f, maxAmount: e.target.value ? Number(e.target.value) : '' }))}
          className={inputClass}
        />
        <span
          className="text-xs text-[#B6A596] uppercase tracking-widest"
          style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
        >
          {filtered.length} transactions
        </span>
      </div>

      {/* Table */}
      <div className="border border-[#66473B] rounded">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#1a1a1a]">
              <tr>
                <TH>Date</TH>
                <TH>Description</TH>
                <TH>Category</TH>
                <TH right>Amount</TH>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((tx, idx) => (
                <tr
                  key={tx.id}
                  className={`border-b border-[#35211A] last:border-0 ${
                    flags[tx.id]?.length ? 'bg-[#DC9F85]/5' : idx % 2 === 1 ? 'bg-white/[0.02]' : ''
                  }`}
                >
                  <td className="px-5 py-3 text-[#B6A596] whitespace-nowrap text-xs">{tx.date}</td>
                  <td className="px-5 py-3 text-[#EBDCC4] max-w-xs truncate">{tx.description}</td>
                  <td className="px-5 py-3">
                    {editingCategory === tx.id ? (
                      <CategorySelect
                        value={tx.category}
                        allCategories={allCategories}
                        txId={tx.id}
                        onSave={cat => handleCategorySaved(tx.id, cat)}
                        onCancel={() => setEditingCategory(null)}
                      />
                    ) : (
                      <button
                        onClick={() => setEditingCategory(tx.id)}
                        className="text-xs border border-[#66473B] text-[#B6A596] rounded px-2 py-1 hover:border-[#DC9F85] hover:text-[#DC9F85] transition-colors"
                        title="Click to reassign category"
                      >
                        {tx.category}
                      </button>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right text-[#EBDCC4] font-medium">{formatGBP(tx.amount)}</td>
                  <td className="px-5 py-3 text-right">
                    <CommentButton transactionId={tx.id} existingFlags={flags[tx.id] || []} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
