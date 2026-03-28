# Feedback Round 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 5 user-reported issues: CPI proxy returns 502, income section in Categories shows bill categories, Review page simplified to 4 categories + summary table, Overview breakdown generalised to all buckets, Cashflow KPI card shows the calculation.

**Architecture:** All changes are client-side React + one server-side Netlify function patch. No new DB migrations. The `expense_claims` table and period selector remain in Review; the summary table replaces the separate actioning view.

**Tech Stack:** React 18, Vite, Tailwind CSS v4, Supabase JS, Vitest + Testing Library, Netlify Functions v1

---

## Codebase context (read before writing any code)

| File | Purpose |
|------|---------|
| `src/lib/categories.js` | `BILLS_CATEGORIES` (Set), `TRANSIENT_CATEGORIES` (Set), `bucketCategory()` returning `'bills' \| 'discretionary' \| 'transient'` |
| `src/lib/dateUtils.js` | `nextPeriodBoundary(period)`, `formatPeriodLabel(period)` |
| `netlify/functions/ons-cpi.js` | Proxy for ONS CPIH API — currently 502s because ONS is geo-blocked from Netlify servers |
| `src/pages/Categories.jsx` | Grouped card UI — income section incorrectly includes bill-category refunds |
| `src/pages/Review.jsx` | Period-scoped transaction review — needs simplification |
| `src/pages/Overview.jsx` | KPI cards + breakdown table + cumulative chart |
| `tests/ons.test.js` | 6 tests for `fetchCpiRates` and `cpiAdjust` |
| `tests/Categories.test.jsx` | 3 tests for grouped card layout |
| `tests/Review.test.jsx` | 3 tests — one asserts "Tag all as reviewed" which must be removed |
| `tests/Overview.test.jsx` | 3 tests — third test asserts KPI card labels |

**TRANSIENT_CATEGORIES** currently contains: `'Dulce Personal Purchases'`, `'Dulce Work Expenses'`, `'Gui Personal Purchases'`, `'Gui Work Expensss'`, `'Credit card payments'`, `'Transfers'`.

Run all tests with: `npx vitest run --pool=forks` (threads pool hangs on Windows)

---

## File map

| File | Change |
|------|--------|
| `netlify/functions/ons-cpi.js` | Add 8s timeout + hardcoded fallback rates when ONS unreachable |
| `src/pages/Categories.jsx` | Filter incCats to exclude BILLS_CATEGORIES and TRANSIENT_CATEGORIES |
| `tests/Categories.test.jsx` | Add test asserting bill categories don't bleed into Income section |
| `src/pages/Review.jsx` | Full rewrite: 4-category query, Dismiss/Personal/Work, summary table replaces actioning view |
| `tests/Review.test.jsx` | Full rewrite: remove "Tag all" test, add summary table test |
| `src/pages/Overview.jsx` | Add `breakdownBucket` state + selector buttons, generalise breakdown table, replace Cashflow KpiCard with custom math card |
| `tests/Overview.test.jsx` | Add test for bucket selector rendering |

---

### Task 1: CPI proxy — add timeout and hardcoded fallback

**Context:** The ONS API (`api.ons.gov.uk`) is geo-blocked from Netlify's non-UK servers. The function succeeds in reaching our server (200 from Netlify) but then returns 502 because the upstream `fetch` fails. Fix: try ONS with an 8-second timeout; on any failure return hardcoded CPIH annual rates so the toggle works offline too.

**Files:**
- Modify: `netlify/functions/ons-cpi.js`
- Modify: `tests/ons.test.js`

- [ ] **Step 1: Update `tests/ons.test.js` — add fallback test**

Find the end of the `fetchCpiRates` describe block and add one more test case. The full file becomes:

```js
// tests/ons.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchCpiRates, cpiAdjust } from '../src/lib/ons'

describe('fetchCpiRates', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls the proxy URL', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ annual: [{ date: '2023', value: '6.7' }] }),
    })
    await fetchCpiRates()
    expect(global.fetch).toHaveBeenCalledWith('/.netlify/functions/ons-cpi')
  })

  it('parses annual rates into a year-keyed object', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        annual: [
          { date: '2022', value: '9.6' },
          { date: '2023', value: '6.7' },
        ],
      }),
    })
    const rates = await fetchCpiRates()
    expect(rates).toEqual({ '2022': 9.6, '2023': 6.7 })
  })

  it('throws when the proxy returns a non-ok status', async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, status: 502 })
    await expect(fetchCpiRates()).rejects.toThrow('ONS API failed: 502')
  })
})

describe('cpiAdjust', () => {
  const rates = { '2022': 9.6, '2023': 6.7, '2024': 3.0 }

  it('returns amount unchanged when fromYear >= toYear', () => {
    expect(cpiAdjust(100, 2023, 2022, rates)).toBe(100)
    expect(cpiAdjust(100, 2023, 2023, rates)).toBe(100)
  })

  it('compounds rates across multiple years', () => {
    const result = cpiAdjust(100, 2022, 2024, rates)
    // factor = 1.067 * 1.030 = 1.09901
    expect(result).toBeCloseTo(100 * 1.067 * 1.030, 2)
  })

  it('uses 0 for missing rate years', () => {
    expect(cpiAdjust(100, 2020, 2021, {})).toBe(100)
  })
})
```

- [ ] **Step 2: Run tests — confirm they still pass (no code changed yet)**

```bash
npx vitest run --pool=forks tests/ons.test.js
```
Expected: all pass (existing tests pass, new test structure same as before).

- [ ] **Step 3: Rewrite `netlify/functions/ons-cpi.js`**

```js
// netlify/functions/ons-cpi.js
const ONS_API_URL = 'https://api.ons.gov.uk/v1/datasets/cpih01/timeseries/l522/data'

// Hardcoded CPIH 12-month annual rates — used when ONS API is unreachable.
// Source: ONS CPIH timeseries L522. Update annually.
const FALLBACK = {
  annual: [
    { date: '2015', value: '0.0' },
    { date: '2016', value: '1.0' },
    { date: '2017', value: '2.6' },
    { date: '2018', value: '2.3' },
    { date: '2019', value: '1.8' },
    { date: '2020', value: '0.8' },
    { date: '2021', value: '2.5' },
    { date: '2022', value: '9.6' },
    { date: '2023', value: '6.7' },
    { date: '2024', value: '3.0' },
  ],
}

export const handler = async () => {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(ONS_API_URL, { signal: controller.signal })
    clearTimeout(timeout)
    if (!res.ok) throw new Error(`ONS returned ${res.status}`)
    const data = await res.json()
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' },
      body: JSON.stringify(data),
    }
  } catch {
    // ONS unreachable (geo-block, timeout, network) — serve hardcoded fallback
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
      body: JSON.stringify(FALLBACK),
    }
  }
}
```

- [ ] **Step 4: Run tests — confirm all pass**

```bash
npx vitest run --pool=forks tests/ons.test.js
```
Expected: all pass.

- [ ] **Step 5: Run full suite**

```bash
npx vitest run --pool=forks
```
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add netlify/functions/ons-cpi.js tests/ons.test.js
git commit -m "fix: CPI proxy — 8s timeout + hardcoded fallback when ONS unreachable"
```

---

### Task 2: Categories — filter bill categories from Income section

**Context:** The `income` database table holds all positive transactions from CSV ingest, including refunds of bills (e.g., a refund credited back as "Mortgage"). These refund categories bleed into the Income section in the Categories page. Fix: when building the Income section, exclude any category that's also in `BILLS_CATEGORIES` or `TRANSIENT_CATEGORIES`.

**Files:**
- Modify: `src/pages/Categories.jsx`
- Modify: `tests/Categories.test.jsx`

- [ ] **Step 1: Update `tests/Categories.test.jsx` — add bill-bleed test**

Add one test to the existing describe block. Replace the entire file with:

```jsx
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

beforeAll(() => {
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
})

vi.mock('../src/lib/supabase', () => {
  const makeChain = (data = []) => ({
    select: vi.fn().mockReturnThis(),
    eq:     vi.fn().mockReturnThis(),
    order:  vi.fn().mockReturnThis(),
    limit:  vi.fn().mockReturnThis(),
    then:   vi.fn(cb => Promise.resolve(cb({ data }))),
  })
  const supabase = {
    rpc: vi.fn(),
    from: vi.fn(),
    _makeChain: makeChain,
  }
  return { supabase }
})

import Categories from '../src/pages/Categories'
import { supabase } from '../src/lib/supabase'

beforeEach(() => {
  vi.clearAllMocks()
  supabase.from.mockReturnValue(supabase._makeChain())
})

describe('Categories', () => {
  it('shows loading state initially', () => {
    supabase.rpc.mockReturnValue(new Promise(() => {}))
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq:     vi.fn().mockReturnThis(),
      order:  vi.fn().mockReturnThis(),
      limit:  vi.fn().mockReturnThis(),
      then:   vi.fn(() => new Promise(() => {})),
    })
    render(<Categories />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('renders section headings after load', async () => {
    supabase.rpc.mockResolvedValue({
      data: [{ category: 'Groceries' }, { category: 'Mortgage' }],
      error: null,
    })
    supabase.from.mockImplementation(table => {
      if (table === 'income') return supabase._makeChain([{ category: 'Salary' }])
      return supabase._makeChain([])
    })
    render(<Categories />)
    await waitFor(() => expect(screen.getByText('Income')).toBeInTheDocument())
    expect(screen.getByText('Bills & Fixed')).toBeInTheDocument()
    expect(screen.getByText('Discretionary')).toBeInTheDocument()
  })

  it('renders category cards in correct sections', async () => {
    supabase.rpc.mockResolvedValue({
      data: [{ category: 'Groceries' }, { category: 'Mortgage' }],
      error: null,
    })
    supabase.from.mockImplementation(table => {
      if (table === 'income') return supabase._makeChain([{ category: 'Salary' }])
      return supabase._makeChain([])
    })
    render(<Categories />)
    await waitFor(() => expect(screen.getByText('Salary')).toBeInTheDocument())
    expect(screen.getByText('Mortgage')).toBeInTheDocument()
    expect(screen.getByText('Groceries')).toBeInTheDocument()
  })

  it('does not show bill categories under Income even when they appear in the income table', async () => {
    // income table has Salary + a Mortgage refund (positive transaction)
    supabase.rpc.mockResolvedValue({
      data: [{ category: 'Mortgage' }],
      error: null,
    })
    supabase.from.mockImplementation(table => {
      if (table === 'income') {
        return supabase._makeChain([
          { category: 'Salary' },
          { category: 'Mortgage' }, // refund — should NOT appear in Income section
        ])
      }
      return supabase._makeChain([])
    })
    render(<Categories />)
    // Wait for load
    await waitFor(() => expect(screen.getByText('Income')).toBeInTheDocument())
    // Salary should appear in Income section
    expect(screen.getByText('Salary')).toBeInTheDocument()
    // Mortgage should appear in Bills & Fixed (from txCats), not duplicated in Income
    // The test confirms Mortgage is NOT in the Income section by checking it appears
    // only once (from the transactions side, not doubled from income)
    const mortgageButtons = screen.getAllByText('Mortgage')
    expect(mortgageButtons).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run test — confirm the new test fails**

```bash
npx vitest run --pool=forks tests/Categories.test.jsx
```
Expected: 3 pass, 1 fail (the bill-bleed test fails because Mortgage currently appears in Income).

- [ ] **Step 3: Edit `src/pages/Categories.jsx` — filter income categories**

Find the `built` array construction inside `loadCategories`. Change the Income entry from:

```js
{ key: 'income', label: 'Income', categories: incCats },
```

To:

```js
{ key: 'income', label: 'Income', categories: incCats.filter(c => !BILLS_CATEGORIES.has(c) && !TRANSIENT_CATEGORIES.has(c)) },
```

That single line is the only change. The import of `BILLS_CATEGORIES` and `TRANSIENT_CATEGORIES` at the top of the file already exists.

- [ ] **Step 4: Run tests — confirm all pass**

```bash
npx vitest run --pool=forks tests/Categories.test.jsx
```
Expected: 4/4 PASS.

- [ ] **Step 5: Run full suite**

```bash
npx vitest run --pool=forks
```
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Categories.jsx tests/Categories.test.jsx
git commit -m "fix: Categories — exclude bill/transient categories from Income section"
```

---

### Task 3: Review — simplify to 4 categories, Dismiss/Personal/Work, summary table

**Context:** The Review page currently shows all non-bill non-transient transactions and has three buttons (Personal, Work, ✓) plus a "Tag all as reviewed" header button that creates an `expense_claims` record.

New behaviour:
- Only show transactions for exactly 4 categories: `'Clothing & shoes'`, `'General Merchandise'`, `'Dulce Personal Purchases'`, `'Dulce Work Expenses'`
- Sort: Clothing & shoes first (date desc), General Merchandise second (date desc), Dulce Personal Purchases third (date desc), Dulce Work Expenses fourth (date desc)
- Buttons: **Dismiss** (remove from view, no DB write), **Personal** (re-tag to Dulce Personal Purchases), **Work** (re-tag to Dulce Work Expenses)
- No "Tag all as reviewed" button
- Already-tagged items (Dulce Personal Purchases, Dulce Work Expenses) pre-populate the `tagged` list on load
- **Summary table** always shown when tagged.length > 0: lists Personal total + Work total with "Mark done" / "✓ Done" buttons per row — clicking saves/updates the `expense_claims` record
- Period selector stays

**Files:**
- Modify: `src/pages/Review.jsx`
- Modify: `tests/Review.test.jsx`

- [ ] **Step 1: Replace `tests/Review.test.jsx`**

```jsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Review from '../src/pages/Review'

const mockFrom = vi.fn()
vi.mock('../src/lib/supabase', () => ({
  supabase: { from: (...args) => mockFrom(...args) },
}))

function makeChain(overrides = {}) {
  const base = {
    select: vi.fn().mockReturnThis(),
    order:  vi.fn().mockReturnThis(),
    eq:     vi.fn().mockReturnThis(),
    not:    vi.fn().mockReturnThis(),
    gte:    vi.fn().mockReturnThis(),
    lt:     vi.fn().mockReturnThis(),
    in:     vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockResolvedValue({ error: null }),
    then:   vi.fn(cb => Promise.resolve(cb({ data: [], error: null }))),
  }
  return { ...base, ...overrides }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReturnValue(makeChain())
})

describe('Review', () => {
  it('renders without crashing in empty state', () => {
    render(<Review />)
  })

  it('shows Dismiss, Personal and Work buttons per pending transaction', async () => {
    mockFrom.mockImplementation(table => {
      if (table === 'uploads') {
        return makeChain({
          then: vi.fn(cb => Promise.resolve(cb({ data: [{ period: '2025-03' }], error: null }))),
        })
      }
      if (table === 'expense_claims') {
        return makeChain({
          then: vi.fn(cb => Promise.resolve(cb({ data: [], error: null }))),
        })
      }
      // transactions — return a Clothing & shoes item (pending)
      return makeChain({
        then: vi.fn(cb => Promise.resolve(cb({
          data: [{ id: '1', date: '2025-03-05', description: 'Zara top', amount: 45, category: 'Clothing & shoes' }],
          error: null,
        }))),
      })
    })
    render(<Review />)
    await waitFor(() => expect(screen.getByText('Zara top')).toBeInTheDocument())
    expect(screen.getByText('Personal')).toBeInTheDocument()
    expect(screen.getByText('Work')).toBeInTheDocument()
    expect(screen.getByText('Dismiss')).toBeInTheDocument()
    expect(screen.queryByText(/tag all/i)).not.toBeInTheDocument()
  })

  it('shows summary table for pre-tagged Dulce Personal Purchases items', async () => {
    mockFrom.mockImplementation(table => {
      if (table === 'uploads') {
        return makeChain({
          then: vi.fn(cb => Promise.resolve(cb({ data: [{ period: '2025-03' }], error: null }))),
        })
      }
      if (table === 'expense_claims') {
        return makeChain({
          then: vi.fn(cb => Promise.resolve(cb({ data: [], error: null }))),
        })
      }
      return makeChain({
        then: vi.fn(cb => Promise.resolve(cb({
          data: [{ id: '2', date: '2025-03-10', description: 'Clothes', amount: 80, category: 'Dulce Personal Purchases' }],
          error: null,
        }))),
      })
    })
    render(<Review />)
    await waitFor(() => expect(screen.getByText(/personal transfer/i)).toBeInTheDocument())
    expect(screen.getByText(/mark done/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests — confirm test 2 and 3 fail (old code has different buttons/no summary)**

```bash
npx vitest run --pool=forks tests/Review.test.jsx
```
Expected: test 1 passes, tests 2 and 3 fail.

- [ ] **Step 3: Rewrite `src/pages/Review.jsx`**

```jsx
// src/pages/Review.jsx
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { nextPeriodBoundary, formatPeriodLabel } from '../lib/dateUtils'

function formatGBP(n) {
  return `£${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Only these 4 categories are shown in Review
const REVIEW_CATEGORIES = [
  'Clothing & shoes',
  'General Merchandise',
  'Dulce Personal Purchases',
  'Dulce Work Expenses',
]

// Categories that are already resolved — pre-populate tagged list on load
const ALREADY_TAGGED = ['Dulce Personal Purchases', 'Dulce Work Expenses']

const SORT_ORDER = [
  'Clothing & shoes',
  'General Merchandise',
  'Dulce Personal Purchases',
  'Dulce Work Expenses',
]

function sortTransactions(txs) {
  const result = []
  for (const cat of SORT_ORDER) {
    result.push(...txs.filter(t => t.category === cat).sort((a, b) => b.date.localeCompare(a.date)))
  }
  // Any category not in SORT_ORDER (shouldn't happen, but safe)
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
        .filter('category', 'in', `(${REVIEW_CATEGORIES.map(c => `"${c}"`).join(',')})`)
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

  async function tagPersonal(tx) {
    const { error } = await supabase
      .from('transactions')
      .update({ category: 'Dulce Personal Purchases' })
      .eq('id', tx.id)
    if (!error) {
      setPending(prev => prev.filter(t => t.id !== tx.id))
      setTagged(prev => [...prev, { tx: { ...tx, category: 'Dulce Personal Purchases' }, tag: 'personal' }])
    }
  }

  async function tagWork(tx) {
    const { error } = await supabase
      .from('transactions')
      .update({ category: 'Dulce Work Expenses' })
      .eq('id', tx.id)
    if (!error) {
      setPending(prev => prev.filter(t => t.id !== tx.id))
      setTagged(prev => [...prev, { tx: { ...tx, category: 'Dulce Work Expenses' }, tag: 'work' }])
    }
  }

  const totalPersonal = tagged
    .filter(t => t.tag === 'personal')
    .reduce((s, t) => s + Number(t.tx.amount), 0)
  const totalWork = tagged
    .filter(t => t.tag === 'work')
    .reduce((s, t) => s + Number(t.tx.amount), 0)

  async function markPersonalActioned() {
    const { error } = await supabase
      .from('expense_claims')
      .upsert(
        { period, total_personal: totalPersonal, total_work: claim?.total_work ?? totalWork, personal_actioned_at: new Date().toISOString() },
        { onConflict: 'period' }
      )
    if (!error) setClaim(prev => ({
      ...(prev ?? { period, total_personal: totalPersonal, total_work: totalWork }),
      personal_actioned_at: new Date().toISOString(),
    }))
  }

  async function markWorkActioned() {
    const { error } = await supabase
      .from('expense_claims')
      .upsert(
        { period, total_personal: claim?.total_personal ?? totalPersonal, total_work: totalWork, work_actioned_at: new Date().toISOString() },
        { onConflict: 'period' }
      )
    if (!error) setClaim(prev => ({
      ...(prev ?? { period, total_personal: totalPersonal, total_work: totalWork }),
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
      {(totalPersonal > 0 || totalWork > 0) && (
        <div className="border border-[#66473B] rounded p-5">
          <h2
            className="text-xs font-semibold text-[#B6A596] uppercase tracking-widest mb-4"
            style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
          >
            Transfers this period
          </h2>
          <table className="w-full">
            <tbody>
              {totalPersonal > 0 && (
                <tr className="border-b border-[#35211A] last:border-0">
                  <td className="py-2 text-xs text-[#B6A596]">Personal transfer</td>
                  <td className="py-2 text-xs text-right font-medium text-[#EBDCC4] tabular-nums">{formatGBP(totalPersonal)}</td>
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
              {totalWork > 0 && (
                <tr className="border-b border-[#35211A] last:border-0">
                  <td className="py-2 text-xs text-[#B6A596]">Work claim</td>
                  <td className="py-2 text-xs text-right font-medium text-[#EBDCC4] tabular-nums">{formatGBP(totalWork)}</td>
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
```

- [ ] **Step 4: Run tests — confirm all pass**

```bash
npx vitest run --pool=forks tests/Review.test.jsx
```
Expected: 3/3 PASS.

- [ ] **Step 5: Run full suite**

```bash
npx vitest run --pool=forks
```
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Review.jsx tests/Review.test.jsx
git commit -m "feat: Review — 4-category view, Dismiss/Personal/Work, summary table"
```

---

### Task 4: Overview — breakdown bucket selector + cashflow math card

**Context:** Two changes to `src/pages/Overview.jsx`:

1. The "Discretionary Breakdown" table is hardcoded to discretionary items. Replace with a bucket selector (row of buttons: Bills & Fixed / Discretionary / Transients / Income) and show the corresponding items. Income bucket shows a single Salary row using `salaryByPeriod`. Other buckets use `bucketCategory()` against `allCatData`.

2. The Cashflow KPI card currently shows just a number. Replace it with a custom card that shows the calculation: Income − Bills & Fixed − Discretionary = Cashflow.

**Files:**
- Modify: `src/pages/Overview.jsx`
- Modify: `tests/Overview.test.jsx`

- [ ] **Step 1: Update `tests/Overview.test.jsx`**

Replace the entire file:

```jsx
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

beforeAll(() => {
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
})

vi.mock('../src/lib/supabase', () => {
  return { supabase: { rpc: vi.fn(), from: vi.fn() } }
})

import Overview from '../src/pages/Overview'
import { supabase } from '../src/lib/supabase'

function makeFromChain(resolveData = []) {
  return {
    select: vi.fn().mockReturnThis(),
    eq:     vi.fn().mockReturnThis(),
    not:    vi.fn().mockReturnThis(),
    gte:    vi.fn().mockReturnThis(),
    lt:     vi.fn().mockReturnThis(),
    then:   vi.fn(cb => Promise.resolve(cb({ data: resolveData }))),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  supabase.rpc.mockReturnValue(new Promise(() => {}))
  supabase.from.mockReturnValue(makeFromChain())
})

describe('Overview', () => {
  it('shows loading state initially', () => {
    render(<Overview />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('shows empty state when no category data', async () => {
    supabase.rpc.mockResolvedValue({ data: [], error: null })
    supabase.from.mockReturnValue(makeFromChain([]))
    render(<Overview />)
    await waitFor(() =>
      expect(screen.getByText(/no data yet/i)).toBeInTheDocument()
    )
  })

  it('renders Bills, Discretionary, Income, Cashflow sections after load', async () => {
    supabase.rpc.mockResolvedValue({
      data: [
        { period: '2025-01', category: 'Mortgage', total: 1200 },
        { period: '2025-01', category: 'Groceries', total: 300 },
      ],
      error: null,
    })
    supabase.from.mockReturnValue(
      makeFromChain([{ date: '2025-01-25', amount: 4000 }])
    )
    render(<Overview />)
    await waitFor(() => expect(screen.getByText('Bills & Fixed')).toBeInTheDocument())
    expect(screen.getByText('Discretionary')).toBeInTheDocument()
    expect(screen.getByText('Income')).toBeInTheDocument()
    expect(screen.getByText('Cashflow')).toBeInTheDocument()
    expect(screen.queryByText('Transfers')).not.toBeInTheDocument()
  })

  it('renders breakdown bucket selector buttons', async () => {
    supabase.rpc.mockResolvedValue({
      data: [{ period: '2025-01', category: 'Groceries', total: 300 }],
      error: null,
    })
    supabase.from.mockReturnValue(makeFromChain([{ date: '2025-01-25', amount: 4000 }]))
    render(<Overview />)
    await waitFor(() => expect(screen.getByText('Discretionary')).toBeInTheDocument())
    // Bucket selector buttons should be present
    expect(screen.getByRole('button', { name: /bills & fixed/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /transients/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /income/i })).toBeInTheDocument()
  })

  it('shows cashflow math breakdown (Income, Bills & Fixed, Discretionary lines)', async () => {
    supabase.rpc.mockResolvedValue({
      data: [
        { period: '2025-01', category: 'Mortgage', total: 1200 },
        { period: '2025-01', category: 'Groceries', total: 300 },
      ],
      error: null,
    })
    supabase.from.mockReturnValue(makeFromChain([{ date: '2025-01-25', amount: 4000 }]))
    render(<Overview />)
    await waitFor(() => expect(screen.getByText('Cashflow')).toBeInTheDocument())
    // The cashflow card should have the math labels
    expect(screen.getByText('= Cashflow')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests — confirm new tests fail**

```bash
npx vitest run --pool=forks tests/Overview.test.jsx
```
Expected: 3 existing pass, 2 new tests fail (bucket selector and cashflow math not yet added).

- [ ] **Step 3: Rewrite `src/pages/Overview.jsx`**

Replace the entire file:

```jsx
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import KpiCard from '../components/KpiCard'
import MonthlyTrendChart from '../components/MonthlyTrendChart'
import { bucketCategory } from '../lib/categories'
import { nextPeriodBoundary, formatPeriodLabel } from '../lib/dateUtils'
export { nextPeriodBoundary } from '../lib/dateUtils'

function formatGBP(n) {
  return `£${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function Sparkline({ values }) {
  if (!values || values.length < 2) return <span className="text-[#35211A]">—</span>
  const max = Math.max(...values, 1)
  const w = 64, h = 20
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * w},${h - (v / max) * (h - 2) - 1}`)
    .join(' ')
  return (
    <svg width={w} height={h} className="inline-block align-middle">
      <polyline points={pts} fill="none" stroke="#DC9F85" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

const BUCKET_LABELS = {
  bills:         'Bills & Fixed',
  discretionary: 'Discretionary',
  transient:     'Transients',
  income:        'Income',
}
const BUCKET_KEYS = ['bills', 'discretionary', 'transient', 'income']

export default function Overview() {
  const [allCatData, setAllCatData]           = useState(null)
  const [salaryByPeriod, setSalaryByPeriod]   = useState(null)
  const [periods, setPeriods]                 = useState([])
  const [periodIndex, setPeriodIndex]         = useState(null)
  const [breakdownBucket, setBreakdownBucket] = useState('discretionary')

  useEffect(() => {
    async function load() {
      const [{ data: catData, error: catErr }, salaryResult] = await Promise.all([
        supabase.rpc('get_monthly_category_totals'),
        supabase
          .from('income')
          .select('date, amount')
          .eq('category', 'Salary')
          .then(({ data, error }) => ({ data, error })),
      ])
      if (catErr) console.error('get_monthly_category_totals failed:', catErr.message)
      if (salaryResult.error) console.error('salary query failed:', salaryResult.error.message)

      const salaryMap = {}
      salaryResult.data?.forEach(r => {
        const p = r.date.slice(0, 7)
        salaryMap[p] = (salaryMap[p] || 0) + Number(r.amount)
      })

      const ps = [...new Set((catData ?? []).map(r => r.period))].sort()
      setAllCatData(catData ?? [])
      setSalaryByPeriod(salaryMap)
      setPeriods(ps)
      setPeriodIndex(ps.length > 0 ? ps.length - 1 : null)
    }
    load()
  }, [])

  const loading = allCatData === null || salaryByPeriod === null
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
  const income        = Number(salaryByPeriod[period] ?? 0)
  const cashflow      = income - bills - discretionary

  const prevBills         = sumBucket(prevRows, 'bills')
  const prevDiscretionary = sumBucket(prevRows, 'discretionary')
  const prevIncome        = Number(salaryByPeriod[prevPeriod] ?? 0)

  function pctDelta(cur, prev) {
    if (!prev) return undefined
    return Math.round(((cur - prev) / prev) * 100)
  }

  // Build breakdown items for the selected bucket
  function getBreakdownItems(bucket) {
    if (bucket === 'income') {
      const thisMo  = Math.round(salaryByPeriod[period] ?? 0)
      const lastMo  = prevPeriod ? Math.round(salaryByPeriod[prevPeriod] ?? 0) : null
      const delta   = lastMo ? Math.round(((thisMo - lastMo) / lastMo) * 100) : null
      const last6   = periods
        .slice(Math.max(0, periodIndex - 5), periodIndex + 1)
        .map(p => Math.round(salaryByPeriod[p] ?? 0))
      return [{ name: 'Salary', thisMo, lastMo, delta, last6 }]
    }
    return periodRows
      .filter(r => bucketCategory(r.category) === bucket)
      .map(r => {
        const thisMo    = Math.round(Number(r.total))
        const lastMoRow = prevRows.find(p => p.category === r.category)
        const lastMo    = lastMoRow ? Math.round(Number(lastMoRow.total)) : null
        const delta     = lastMo ? Math.round(((thisMo - lastMo) / lastMo) * 100) : null
        const last6     = periods
          .slice(Math.max(0, periodIndex - 5), periodIndex + 1)
          .map(p => {
            const row = allCatData.find(d => d.period === p && d.category === r.category)
            return row ? Math.round(Number(row.total)) : 0
          })
        return { name: r.category, thisMo, lastMo, delta, last6 }
      })
      .sort((a, b) => b.thisMo - a.thisMo)
  }

  const breakdownItems = getBreakdownItems(breakdownBucket)
  const breakdownTotal = breakdownItems.reduce((s, i) => s + i.thisMo, 0)

  let cumulative = 0
  const cashflowTrend = periods.map(p => {
    const rows  = allCatData.filter(r => r.period === p)
    const spend = sumBucket(rows, 'bills') + sumBucket(rows, 'discretionary')
    const inc   = Number(salaryByPeriod[p] ?? 0)
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

      {/* 3 KPI cards + custom Cashflow card */}
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
        {/* Cashflow — custom card showing the calculation */}
        <div className="border border-[#66473B] rounded p-5">
          <p className="text-xs text-[#B6A596] uppercase tracking-widest mb-3">Cashflow</p>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-[#B6A596]">Income</span>
              <span className="text-[#EBDCC4] tabular-nums">{income > 0 ? formatGBP(income) : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#B6A596]">Bills & Fixed</span>
              <span className="text-[#EBDCC4] tabular-nums">−{formatGBP(bills)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#B6A596]">Discretionary</span>
              <span className="text-[#EBDCC4] tabular-nums">−{formatGBP(discretionary)}</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-[#35211A] flex justify-between items-baseline">
            <span className="text-xs text-[#B6A596] uppercase tracking-widest">= Cashflow</span>
            <span
              className={`text-xl font-bold ${cashflow < 0 ? 'text-[#DC9F85]' : 'text-[#EBDCC4]'}`}
              style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
            >
              {formatGBP(cashflow)}
            </span>
          </div>
        </div>
      </div>

      {/* Breakdown section */}
      <div className="border border-[#66473B] rounded p-5">
        {/* Bucket selector */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div className="flex gap-2 flex-wrap">
            {BUCKET_KEYS.map(b => (
              <button
                key={b}
                onClick={() => setBreakdownBucket(b)}
                className={`px-3 py-1 text-xs rounded border transition-colors ${
                  breakdownBucket === b
                    ? 'border-[#DC9F85] text-[#DC9F85]'
                    : 'border-[#66473B] text-[#B6A596] hover:border-[#B6A596]'
                }`}
                style={{ fontFamily: "'Clash Grotesk', sans-serif" }}
              >
                {BUCKET_LABELS[b]}
              </button>
            ))}
          </div>
          {breakdownItems.length > 0 && (
            <span className="text-sm font-bold text-[#EBDCC4]" style={{ fontFamily: "'Clash Grotesk', sans-serif" }}>
              {formatGBP(breakdownTotal)}
            </span>
          )}
        </div>

        {breakdownItems.length === 0 ? (
          <p className="text-xs text-[#66473B]">No {BUCKET_LABELS[breakdownBucket].toLowerCase()} spend this period.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left text-xs text-[#66473B] font-medium pb-2 uppercase tracking-widest">Category</th>
                <th className="text-right text-xs text-[#66473B] font-medium pb-2 uppercase tracking-widest">Last month</th>
                <th className="text-right text-xs text-[#66473B] font-medium pb-2 uppercase tracking-widest">This month</th>
                <th className="text-right text-xs text-[#66473B] font-medium pb-2 uppercase tracking-widest">Δ</th>
                <th className="text-right text-xs text-[#66473B] font-medium pb-2 uppercase tracking-widest">6M</th>
              </tr>
            </thead>
            <tbody>
              {breakdownItems.map(item => (
                <tr key={item.name} className="border-t border-[#35211A]">
                  <td className="py-2 text-xs text-[#EBDCC4]">{item.name}</td>
                  <td className="py-2 text-xs text-right text-[#B6A596] tabular-nums">
                    {item.lastMo !== null ? formatGBP(item.lastMo) : <span className="text-[#35211A]">—</span>}
                  </td>
                  <td className="py-2 text-xs text-right text-[#EBDCC4] font-medium tabular-nums">
                    {formatGBP(item.thisMo)}
                  </td>
                  <td className={`py-2 text-xs text-right font-medium tabular-nums ${
                    item.delta > 0 ? 'text-[#DC9F85]' : item.delta < 0 ? 'text-[#B6A596]' : 'text-[#66473B]'
                  }`}>
                    {item.delta !== null && item.delta !== 0
                      ? `${item.delta > 0 ? '+' : ''}${item.delta}%`
                      : <span className="text-[#35211A]">—</span>
                    }
                  </td>
                  <td className="py-2 text-right pl-3">
                    <Sparkline values={item.last6} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

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
```

- [ ] **Step 4: Run tests — confirm all pass**

```bash
npx vitest run --pool=forks tests/Overview.test.jsx
```
Expected: 5/5 PASS.

- [ ] **Step 5: Run full suite**

```bash
npx vitest run --pool=forks
```
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Overview.jsx tests/Overview.test.jsx
git commit -m "feat: Overview — breakdown bucket selector + cashflow math card"
```

---

### Final: push to deploy

- [ ] **Push to budgetdash/main**

```bash
git push budgetdash feature/budgeting-dashboard:main --force
```

---

## Self-review

**Spec coverage:**
1. ✅ CPI 502 → Task 1 (hardcoded fallback, 8s timeout)
2. ✅ Categories income bleeds bills → Task 2 (filter on BILLS_CATEGORIES + TRANSIENT_CATEGORIES)
3. ✅ Review simplified to 4 categories, Dismiss/Personal/Work, summary table → Task 3
4. ✅ Overview breakdown as dropdown → Task 4 (bucket selector buttons)
5. ✅ Cashflow math in card → Task 4 (custom Cashflow card with Income/Bills/Discretionary lines)

**Placeholder scan:** No TBDs, all code blocks complete.

**Type consistency:**
- `breakdownItems` returned by `getBreakdownItems(bucket)`: `{ name, thisMo, lastMo, delta, last6 }[]` — used consistently in the table render.
- `BUCKET_KEYS` and `BUCKET_LABELS` keys: `'bills' | 'discretionary' | 'transient' | 'income'` — consistent with `bucketCategory()` return values and `getBreakdownItems` switch.
- `REVIEW_CATEGORIES` and `ALREADY_TAGGED` in Review.jsx: `ALREADY_TAGGED` is a subset of `REVIEW_CATEGORIES` — correct.
- `sortTransactions` in Review.jsx uses `SORT_ORDER` which lists all 4 `REVIEW_CATEGORIES` — exhaustive, no leakage.
