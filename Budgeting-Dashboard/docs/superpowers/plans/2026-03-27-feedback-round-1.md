# Feedback Round 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Address 8 user-feedback items across Overview, Categories, YearVsYear, and Review pages.

**Architecture:** All changes are client-side React (Vite + Tailwind) with Supabase queries. One new DB table (`expense_claims`) needs a migration run manually in Supabase SQL editor. ONS CPI data fetched live from `https://api.ons.gov.uk/v1/datasets/cpih01/timeseries/l522/data`.

**Tech Stack:** React 18, Vite, Tailwind CSS v4, Supabase JS, Recharts, Vitest + Testing Library

---

## File Map

| File | Change |
|------|--------|
| `supabase/migrations/004_expense_claims.sql` | Create (new table + RLS) |
| `src/lib/ons.js` | Create (ONS CPI fetch + cpiAdjust util) |
| `src/pages/Overview.jsx` | Modify (KPI overhaul + cashflow chart) |
| `src/pages/Categories.jsx` | Modify (dropdown + combined query) |
| `src/pages/YearVsYear.jsx` | Modify (year selector + bug fix + CPI toggle) |
| `src/pages/Review.jsx` | Modify (third button + sort + tag-all workflow) |
| `tests/Overview.test.jsx` | Modify (update for removed nursery, renamed cards) |
| `tests/Categories.test.jsx` | Modify (update for dropdown + income query) |
| `tests/YearVsYear.test.jsx` | Modify (update for year selector) |
| `tests/Review.test.jsx` | Modify (update for new buttons + workflow) |

---

### Task 1: DB migration — expense_claims table

**Files:**
- Create: `supabase/migrations/004_expense_claims.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/004_expense_claims.sql
-- Tracks monthly personal/work expense totals after Dulce's review session
CREATE TABLE IF NOT EXISTS expense_claims (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  period               text        NOT NULL,
  total_personal       numeric     NOT NULL DEFAULT 0,
  total_work           numeric     NOT NULL DEFAULT 0,
  personal_actioned_at timestamptz,
  work_actioned_at     timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period)
);

ALTER TABLE expense_claims ENABLE ROW LEVEL SECURITY;

-- Both authenticated users can read
CREATE POLICY "authenticated read expense_claims"
  ON expense_claims FOR SELECT TO authenticated USING (true);

-- Both authenticated users can insert (Dulce creates claims during review)
CREATE POLICY "authenticated insert expense_claims"
  ON expense_claims FOR INSERT TO authenticated WITH CHECK (true);

-- Both authenticated users can update (mark actioned)
CREATE POLICY "authenticated update expense_claims"
  ON expense_claims FOR UPDATE TO authenticated USING (true);
```

- [ ] **Step 2: Run in Supabase SQL editor**

Copy the file contents into the Supabase SQL editor and execute. Verify the `expense_claims` table appears in the Table Editor.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/004_expense_claims.sql
git commit -m "feat: add expense_claims table for review workflow"
```

---

### Task 2: ONS CPI utility

**Files:**
- Create: `src/lib/ons.js`

- [ ] **Step 1: Write failing test**

Create `tests/ons.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchCpiRates, cpiAdjust } from '../src/lib/ons'

describe('cpiAdjust', () => {
  it('returns amount unchanged when fromYear >= toYear', () => {
    expect(cpiAdjust(1000, 2025, 2024, { '2025': 3.0 })).toBe(1000)
    expect(cpiAdjust(1000, 2025, 2025, {})).toBe(1000)
  })

  it('adjusts one year forward using CPI rate', () => {
    // 1000 in 2024 money → 2025 money: multiply by (1 + 0.026)
    const result = cpiAdjust(1000, 2024, 2025, { '2025': 2.6 })
    expect(result).toBeCloseTo(1026, 0)
  })

  it('compounds across two years', () => {
    // 1000 in 2023 money → 2025 money: (1+0.067) * (1+0.026)
    const result = cpiAdjust(1000, 2023, 2025, { '2024': 6.7, '2025': 2.6 })
    expect(result).toBeCloseTo(1094.42, 0)
  })

  it('treats missing year as 0% inflation', () => {
    const result = cpiAdjust(1000, 2024, 2025, {})
    expect(result).toBe(1000)
  })
})

describe('fetchCpiRates', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('returns a map of year → rate from ONS annual array', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        annual: [
          { date: '2023', value: '6.7' },
          { date: '2024', value: '2.6' },
        ],
      }),
    })
    const rates = await fetchCpiRates()
    expect(rates).toEqual({ '2023': 6.7, '2024': 2.6 })
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.ons.gov.uk/v1/datasets/cpih01/timeseries/l522/data'
    )
  })

  it('throws on non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 })
    await expect(fetchCpiRates()).rejects.toThrow('ONS API failed: 500')
  })
})
```

- [ ] **Step 2: Run test — confirm it fails**

```bash
npx vitest run --pool=threads tests/ons.test.js
```
Expected: all tests FAIL (module doesn't exist yet).

- [ ] **Step 3: Implement `src/lib/ons.js`**

```js
// src/lib/ons.js
const ONS_URL = 'https://api.ons.gov.uk/v1/datasets/cpih01/timeseries/l522/data'

/**
 * Fetches CPIH 12-month annual rates from ONS API.
 * Returns { "2023": 6.7, "2024": 2.6, ... }
 */
export async function fetchCpiRates() {
  const res = await fetch(ONS_URL)
  if (!res.ok) throw new Error(`ONS API failed: ${res.status}`)
  const json = await res.json()
  const rates = {}
  json.annual?.forEach(({ date, value }) => {
    rates[date] = parseFloat(value)
  })
  return rates
}

/**
 * Adjusts `amount` from `fromYear` to `toYear` using CPI rates.
 * Compounds annual rates: e.g. 2023→2025 = (1+r2024)*(1+r2025)
 * Returns amount unchanged if fromYear >= toYear.
 */
export function cpiAdjust(amount, fromYear, toYear, rates) {
  if (fromYear >= toYear) return amount
  let factor = 1
  for (let y = fromYear + 1; y <= toYear; y++) {
    factor *= 1 + (rates[String(y)] ?? 0) / 100
  }
  return amount * factor
}
```

- [ ] **Step 4: Run test — confirm it passes**

```bash
npx vitest run --pool=threads tests/ons.test.js
```
Expected: 6/6 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ons.js tests/ons.test.js
git commit -m "feat: add ONS CPI fetch utility and cpiAdjust helper"
```

---

### Task 3: Overview page — KPI overhaul + cashflow chart

**Context:** Overview currently shows 4 cards: Bills & Fixed (with Nursery subLine), Discretionary, Transfers (muted), Income. Bottom chart is monthly true-spend trend. Changes: remove Nursery subLine + its useEffect, remove Transfers card, add vs-last-month delta to all 3 remaining cards, add a 4th Cashflow card (income − non-transient spend for selected period), replace bottom chart with cumulative cashflow trend. Add a total to Discretionary Breakdown header, and a sorted category list below the treemap.

**Files:**
- Modify: `src/pages/Overview.jsx`
- Modify: `tests/Overview.test.jsx`

- [ ] **Step 1: Update failing test to match new structure**

Replace `tests/Overview.test.jsx`:

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

beforeEach(() => {
  vi.clearAllMocks()
  supabase.rpc.mockReturnValue(new Promise(() => {}))
  supabase.from.mockReturnValue({
    select: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    then: vi.fn().mockImplementation(cb => { cb({ data: [] }); return Promise.resolve() }),
  })
})

describe('Overview', () => {
  it('shows loading state initially', () => {
    render(<Overview />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('shows empty state when no category data', async () => {
    supabase.rpc.mockResolvedValue({ data: [], error: null })
    render(<Overview />)
    await waitFor(() =>
      expect(screen.getByText(/no data yet/i)).toBeInTheDocument()
    )
  })

  it('renders Bills, Discretionary, Income, Cashflow cards after load', async () => {
    supabase.rpc.mockImplementation((name) => {
      if (name === 'get_monthly_category_totals') {
        return Promise.resolve({
          data: [
            { period: '2025-01', category: 'Mortgage', total: 1200 },
            { period: '2025-01', category: 'Groceries', total: 300 },
          ],
          error: null,
        })
      }
      if (name === 'get_monthly_income') {
        return Promise.resolve({ data: [{ period: '2025-01', total: 4000 }], error: null })
      }
      return Promise.resolve({ data: [], error: null })
    })
    render(<Overview />)
    await waitFor(() => expect(screen.getByText('Bills & Fixed')).toBeInTheDocument())
    expect(screen.getByText('Discretionary')).toBeInTheDocument()
    expect(screen.getByText('Income')).toBeInTheDocument()
    expect(screen.getByText('Cashflow')).toBeInTheDocument()
    // Transfers card should NOT appear
    expect(screen.queryByText('Transfers')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test — confirm it fails**

```bash
npx vitest run --pool=threads tests/Overview.test.jsx
```
Expected: "Cashflow" assertion fails, "Transfers" still present.

- [ ] **Step 3: Rewrite `src/pages/Overview.jsx`**

Replace the entire file:

```jsx
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
  const [allCatData, setAllCatData]     = useState(null)
  const [allIncomeData, setAllIncomeData] = useState(null)
  const [periods, setPeriods]           = useState([])
  const [periodIndex, setPeriodIndex]   = useState(null)

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

  // Current period rows
  const periodRows = allCatData.filter(r => r.period === period)
  const prevRows   = prevPeriod ? allCatData.filter(r => r.period === prevPeriod) : []

  function sumBucket(rows, bucket) {
    return rows.filter(r => bucketCategory(r.category) === bucket).reduce((s, r) => s + Number(r.total), 0)
  }

  const bills          = sumBucket(periodRows, 'bills')
  const discretionary  = sumBucket(periodRows, 'discretionary')
  const income         = Number(allIncomeData.find(r => r.period === period)?.total ?? 0)
  const cashflow       = income - bills - discretionary

  const prevBills         = sumBucket(prevRows, 'bills')
  const prevDiscretionary = sumBucket(prevRows, 'discretionary')
  const prevIncome        = Number(allIncomeData.find(r => r.period === prevPeriod)?.total ?? 0)

  function pctDelta(cur, prev) {
    if (!prev) return undefined
    return Math.round(((cur - prev) / prev) * 100)
  }

  // Discretionary treemap data
  const discretionaryItems = periodRows
    .filter(r => bucketCategory(r.category) === 'discretionary')
    .map(r => ({ name: r.category, size: Math.round(Number(r.total)) }))
    .sort((a, b) => b.size - a.size)

  const discretionaryTotal = discretionaryItems.reduce((s, i) => s + i.size, 0)

  // Cumulative cashflow trend (all periods, starting from 0)
  let cumulative = 0
  const cashflowTrend = periods.map(p => {
    const rows    = allCatData.filter(r => r.period === p)
    const spend   = sumBucket(rows, 'bills') + sumBucket(rows, 'discretionary')
    const inc     = Number(allIncomeData.find(r => r.period === p)?.total ?? 0)
    cumulative   += inc - spend
    const [y, m]  = p.split('-')
    const label   = new Date(Number(y), Number(m) - 1).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
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

      {/* 4 KPI cards: Bills | Discretionary | Income | Cashflow */}
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
          {/* Sorted list for precise figures on smaller categories */}
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

      {/* Cumulative cashflow trend */}
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

- [ ] **Step 4: Run tests — confirm they pass**

```bash
npx vitest run --pool=threads tests/Overview.test.jsx
```
Expected: 3/3 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Overview.jsx tests/Overview.test.jsx
git commit -m "feat: Overview KPI overhaul — vs-last-month deltas, cashflow card, discretionary list, cumulative cashflow chart"
```

---

### Task 4: Categories page — dropdown + combined income/transaction query

**Context:** Categories currently loads distinct categories via `get_distinct_categories` RPC (transactions table only) and queries only the `transactions` table for per-category data. Salary lives in the `income` table, so it either doesn't appear or shows only legacy rows. Changes: replace pills with a `<select>` dropdown, fetch distinct categories from both tables, query both tables for transactions, combine and sort by date.

**Files:**
- Modify: `src/pages/Categories.jsx`
- Modify: `tests/Categories.test.jsx`

- [ ] **Step 1: Update the test**

Replace `tests/Categories.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

beforeAll(() => {
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
})

vi.mock('../src/lib/supabase', () => {
  const makeChain = () => {
    const chain = {}
    const methods = ['select', 'eq', 'order', 'limit', 'not']
    methods.forEach(m => { chain[m] = vi.fn(() => chain) })
    chain.then = vi.fn(cb => Promise.resolve(cb({ data: [] })))
    return chain
  }
  const txChain  = makeChain()
  const incChain = makeChain()
  const supabase = {
    rpc: vi.fn(),
    from: vi.fn(table => table === 'income' ? incChain : txChain),
    _txChain: txChain,
    _incChain: incChain,
  }
  return { supabase }
})

import Categories from '../src/pages/Categories'
import { supabase } from '../src/lib/supabase'

beforeEach(() => {
  vi.clearAllMocks()
  // Restore chains
  ;[supabase._txChain, supabase._incChain].forEach(chain => {
    Object.keys(chain).forEach(k => {
      if (chain[k].mockReset) chain[k].mockReset()
      if (k !== 'then' && chain[k].mockReturnValue) chain[k].mockReturnValue(chain)
    })
    chain.then.mockImplementation(cb => Promise.resolve(cb({ data: [] })))
  })
  supabase.from.mockImplementation(table => table === 'income' ? supabase._incChain : supabase._txChain)
})

describe('Categories', () => {
  it('shows loading state initially', () => {
    supabase.rpc.mockReturnValue(new Promise(() => {}))
    supabase._incChain.then.mockReturnValue(new Promise(() => {}))
    render(<Categories />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('renders a select dropdown with categories from both tables', async () => {
    supabase.rpc.mockResolvedValue({
      data: [{ category: 'Groceries' }, { category: 'Dining' }],
      error: null,
    })
    supabase._incChain.then.mockImplementation(cb =>
      Promise.resolve(cb({ data: [{ category: 'Salary' }] }))
    )
    render(<Categories />)
    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument())
    const options = screen.getAllByRole('option')
    const texts = options.map(o => o.textContent)
    expect(texts).toContain('Dining')
    expect(texts).toContain('Groceries')
    expect(texts).toContain('Salary')
  })
})
```

- [ ] **Step 2: Run test — confirm it fails**

```bash
npx vitest run --pool=threads tests/Categories.test.jsx
```
Expected: "select" assertion fails (pills not a combobox), Salary not found.

- [ ] **Step 3: Rewrite `src/pages/Categories.jsx`**

Replace the entire file:

```jsx
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import MonthlyTrendChart from '../components/MonthlyTrendChart'

function formatGBP(n) {
  return `£${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export default function Categories() {
  const [categories, setCategories] = useState([])
  const [selected, setSelected]     = useState(null)
  const [monthData, setMonthData]   = useState([])
  const [yoy, setYoy]               = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading]       = useState(true)

  // Load distinct categories from both transactions and income tables
  useEffect(() => {
    async function loadCategories() {
      const [rpcResult, incResult] = await Promise.all([
        supabase.rpc('get_distinct_categories'),
        supabase.from('income').select('category').order('category'),
      ])
      const txCats  = (rpcResult.data ?? []).map(r => r.category)
      const incCats = (incResult.data ?? []).map(r => r.category)
      const cats    = [...new Set([...txCats, ...incCats])].sort()
      setCategories(cats)
      if (cats.length) setSelected(cats[0])
      setLoading(false)
    }
    loadCategories()
  }, [])

  // Load transactions (both tables) for selected category
  useEffect(() => {
    if (!selected) return
    async function load() {
      const [txResult, incResult] = await Promise.all([
        supabase.from('transactions').select('date, amount, description').eq('category', selected).order('date', { ascending: false }).limit(10000),
        supabase.from('income').select('date, amount, description').eq('category', selected).order('date', { ascending: false }).limit(10000),
      ])

      const combined = [...(txResult.data ?? []), ...(incResult.data ?? [])]
        .sort((a, b) => b.date.localeCompare(a.date))

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
      const cy  = years[years.length - 1]
      const py  = String(Number(cy) - 1)
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
      {/* Category dropdown */}
      <select
        value={selected ?? ''}
        onChange={e => setSelected(e.target.value)}
        className="bg-[#181818] border border-[#66473B] text-[#EBDCC4] text-sm rounded px-3 py-2 focus:border-[#DC9F85] focus:outline-none w-full max-w-xs"
      >
        {categories.map(cat => (
          <option key={cat} value={cat}>{cat}</option>
        ))}
      </select>

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
                {yoy.delta !== null && (
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
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
npx vitest run --pool=threads tests/Categories.test.jsx
```
Expected: 2/2 PASS.

- [ ] **Step 5: Run full suite — confirm no regressions**

```bash
npx vitest run --pool=threads
```
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Categories.jsx tests/Categories.test.jsx
git commit -m "feat: Categories dropdown + combined income+transactions query"
```

---

### Task 5: YearVsYear — basis year selector + By Category bug fix + CPI toggle

**Context:** YearVsYear currently auto-selects cy = latest year, py = cy−1. This hides 2024 data. The By Category table compares full-year prev totals against partial-year current totals (wrong). When a category has no spend in current year, it shows `~monthAvg` (wrong). Changes: add a basis year selector dropdown, fix byCatYear to only include prev-year months that also appear in the current year, remove wrong placeholder, add CPI inflation toggle.

**Files:**
- Modify: `src/pages/YearVsYear.jsx`
- Create: `src/lib/ons.js` ← already done in Task 2
- Modify: `tests/YearVsYear.test.jsx`

- [ ] **Step 1: Update the test**

Replace `tests/YearVsYear.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../src/lib/supabase', () => ({ supabase: { rpc: vi.fn() } }))
vi.mock('../src/lib/ons', () => ({
  fetchCpiRates: vi.fn().mockResolvedValue({ '2025': 2.6 }),
  cpiAdjust: vi.fn((amount) => amount),
}))

import YearVsYear from '../src/pages/YearVsYear'
import { supabase } from '../src/lib/supabase'

beforeEach(() => { vi.clearAllMocks() })

const rpcData = [
  { period: '2024-01', category: 'Groceries', total: 100 },
  { period: '2024-10', category: 'Groceries', total: 200 },
  { period: '2025-01', category: 'Groceries', total: 130 },
  { period: '2025-10', category: 'Groceries', total: 150 },
]

describe('YearVsYear', () => {
  it('shows loading state initially', () => {
    supabase.rpc.mockReturnValue(new Promise(() => {}))
    render(<YearVsYear />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('renders basis year selector and monthly table', async () => {
    supabase.rpc.mockResolvedValue({ data: rpcData, error: null })
    render(<YearVsYear />)
    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument())
    expect(screen.getByText('Jan')).toBeInTheDocument()
    expect(screen.getByText('Oct')).toBeInTheDocument()
  })

  it('includes 2024 as a selectable basis year', async () => {
    supabase.rpc.mockResolvedValue({ data: rpcData, error: null })
    render(<YearVsYear />)
    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument())
    const options = screen.getAllByRole('option').map(o => o.textContent)
    expect(options).toContain('2024')
  })

  it('shows CPI toggle', async () => {
    supabase.rpc.mockResolvedValue({ data: rpcData, error: null })
    render(<YearVsYear />)
    await waitFor(() => expect(screen.getByLabelText(/inflation/i)).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Run test — confirm it fails**

```bash
npx vitest run --pool=threads tests/YearVsYear.test.jsx
```
Expected: combobox and 2024 option assertions fail.

- [ ] **Step 3: Rewrite `src/pages/YearVsYear.jsx`**

Replace the entire file:

```jsx
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { bucketCategory } from '../lib/categories'
import { fetchCpiRates, cpiAdjust } from '../lib/ons'

function formatGBP(n) {
  return `£${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function DeltaCell({ delta }) {
  if (delta === null) return <td className="px-5 py-2.5 text-right text-[#35211A]">—</td>
  return (
    <td className={`px-5 py-2.5 text-right font-medium ${delta > 0 ? 'text-[#DC9F85]' : 'text-[#B6A596]'}`}>
      {delta > 0 ? '+' : ''}{delta}%
    </td>
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

export default function YearVsYear() {
  const [loading, setLoading]       = useState(true)
  const [allData, setAllData]       = useState([])   // raw RPC rows (non-transient)
  const [years, setYears]           = useState([])   // sorted available years
  const [basisYear, setBasisYear]   = useState(null) // py
  const [inflationAdj, setInflationAdj] = useState(false)
  const [cpiRates, setCpiRates]     = useState({})

  useEffect(() => {
    async function load() {
      const [{ data, error }, rates] = await Promise.all([
        supabase.rpc('get_monthly_category_totals'),
        fetchCpiRates().catch(() => ({})),
      ])
      if (error) { console.error('get_monthly_category_totals failed:', error.message); setLoading(false); return }

      const filtered = (data ?? []).filter(r => bucketCategory(r.category) !== 'transient')
      setAllData(filtered)
      setCpiRates(rates)

      const ys = [...new Set(filtered.map(r => r.period.slice(0, 4)))].sort()
      setYears(ys)
      // Default basis year: second-to-last (so current = latest)
      setBasisYear(ys.length >= 2 ? Number(ys[ys.length - 2]) : Number(ys[0]))
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="text-[#B6A596] py-8">Loading…</div>

  const cy = basisYear ? basisYear + 1 : null
  const py = basisYear

  // Build byYearMonth for monthly table
  const byYearMonth = {}
  allData.forEach(({ period, total }) => {
    const [y, m] = period.split('-')
    const yr = Number(y), mo = Number(m)
    if (!byYearMonth[yr]) byYearMonth[yr] = {}
    byYearMonth[yr][mo] = (byYearMonth[yr][mo] || 0) + Number(total)
  })

  // Months present in current year (for fair category comparison)
  const cyMonths = new Set(
    allData
      .filter(r => Number(r.period.slice(0, 4)) === cy)
      .map(r => r.period.split('-')[1])
  )

  // Build byCatYear — prev year only counted for months also in current year
  const byCatYear = {}
  allData.forEach(({ period, category, total }) => {
    const [y, m] = period.split('-')
    const yr = Number(y)
    if (yr === py && !cyMonths.has(m)) return // fair comparison
    const key = `${category}|${yr}`
    byCatYear[key] = (byCatYear[key] || 0) + Number(total)
  })

  const monthRows = MONTHS.map((label, i) => {
    const mo  = i + 1
    const cur  = byYearMonth[cy]?.[mo] ?? null
    const prev = byYearMonth[py]?.[mo] ?? null
    const adjPrev = inflationAdj && prev !== null ? Math.round(cpiAdjust(prev, py, cy, cpiRates)) : prev
    const delta   = cur !== null && adjPrev !== null ? Math.round(((cur - adjPrev) / adjPrev) * 100) : null
    return { label, cur, prev: adjPrev, delta }
  })

  const completedMonths = monthRows.filter(r => r.cur !== null)
  const monthAvg = completedMonths.length > 0
    ? Math.round(completedMonths.reduce((s, r) => s + r.cur, 0) / completedMonths.length)
    : null
  const forecast = monthAvg ? Math.round(monthAvg * 12) : null

  const categories = [...new Set(Object.keys(byCatYear).map(k => k.split('|')[0]))].sort()

  const catRows = categories.map(cat => {
    const cur  = byCatYear[`${cat}|${cy}`] ?? null
    const prev = byCatYear[`${cat}|${py}`] ?? null
    const adjPrev = inflationAdj && prev !== null ? Math.round(cpiAdjust(prev, py, cy, cpiRates)) : prev
    const delta = adjPrev !== null && adjPrev > 0 ? Math.round(((cur - adjPrev) / adjPrev) * 100) : null
    return { cat, cur, prev: adjPrev, delta }
  }).sort((a, b) => (b.cur ?? 0) - (a.cur ?? 0))

  // Selectable basis years: all except the latest (can't compare current vs future)
  const basisYearOptions = years.slice(0, -1)

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center gap-6 flex-wrap">
        <div className="flex items-center gap-3">
          <label className="text-xs text-[#B6A596] uppercase tracking-widest" style={{ fontFamily: "'Clash Grotesk', sans-serif" }}>
            Basis year
          </label>
          <select
            value={basisYear ?? ''}
            onChange={e => setBasisYear(Number(e.target.value))}
            className="bg-[#181818] border border-[#66473B] text-[#EBDCC4] text-sm rounded px-3 py-1.5 focus:border-[#DC9F85] focus:outline-none"
          >
            {basisYearOptions.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={inflationAdj}
            onChange={e => setInflationAdj(e.target.checked)}
            aria-label="inflation adjusted"
            className="accent-[#DC9F85]"
          />
          <span className="text-xs text-[#B6A596] uppercase tracking-widest" style={{ fontFamily: "'Clash Grotesk', sans-serif" }}>
            CPI adjusted
          </span>
        </label>
      </div>

      {/* Monthly table */}
      <div className="border border-[#66473B] rounded">
        <div className="px-5 py-4 border-b border-[#35211A] flex items-center justify-between">
          <h2 className="text-xs font-semibold text-[#B6A596] uppercase tracking-widest" style={{ fontFamily: "'Clash Grotesk', sans-serif" }}>
            Monthly: {py} vs {cy}
          </h2>
          {forecast && (
            <span className="text-xs text-[#B6A596]">
              {cy} forecast:{' '}
              <span className="text-[#EBDCC4] font-semibold">{formatGBP(forecast)}</span>
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#1a1a1a]">
              <tr>
                <TH>Month</TH>
                <TH right>{py}{inflationAdj ? ' (adj)' : ''}</TH>
                <TH right>{cy}</TH>
                <TH right>Change</TH>
              </tr>
            </thead>
            <tbody>
              {monthRows.map((r, idx) => (
                <tr key={r.label} className={`border-b border-[#35211A] last:border-0 ${idx % 2 === 1 ? 'bg-white/[0.02]' : ''}`}>
                  <td className="px-5 py-2.5 text-[#EBDCC4]">{r.label}</td>
                  <td className="px-5 py-2.5 text-right text-[#B6A596]">
                    {r.prev !== null ? formatGBP(r.prev) : <span className="text-[#35211A]">—</span>}
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    {r.cur !== null ? (
                      <span className="text-[#EBDCC4] font-medium">{formatGBP(r.cur)}</span>
                    ) : monthAvg !== null ? (
                      <span className="text-[#66473B]">~{formatGBP(monthAvg)}</span>
                    ) : (
                      <span className="text-[#35211A]">—</span>
                    )}
                  </td>
                  <DeltaCell delta={r.delta} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Category table */}
      <div className="border border-[#66473B] rounded">
        <div className="px-5 py-4 border-b border-[#35211A]">
          <h2 className="text-xs font-semibold text-[#B6A596] uppercase tracking-widest" style={{ fontFamily: "'Clash Grotesk', sans-serif" }}>
            By Category: {py}{inflationAdj ? ' (adj)' : ''} vs {cy}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#1a1a1a]">
              <tr>
                <TH>Category</TH>
                <TH right>{py}{inflationAdj ? ' (adj)' : ''}</TH>
                <TH right>{cy}</TH>
                <TH right>Change</TH>
              </tr>
            </thead>
            <tbody>
              {catRows.map((r, idx) => (
                <tr key={r.cat} className={`border-b border-[#35211A] last:border-0 ${idx % 2 === 1 ? 'bg-white/[0.02]' : ''}`}>
                  <td className="px-5 py-2.5 text-[#EBDCC4]">{r.cat}</td>
                  <td className="px-5 py-2.5 text-right text-[#B6A596]">
                    {r.prev !== null ? formatGBP(r.prev) : <span className="text-[#35211A]">—</span>}
                  </td>
                  <td className="px-5 py-2.5 text-right text-[#EBDCC4] font-medium">
                    {r.cur !== null ? formatGBP(r.cur) : <span className="text-[#35211A]">—</span>}
                  </td>
                  <DeltaCell delta={r.delta} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
npx vitest run --pool=threads tests/YearVsYear.test.jsx tests/ons.test.js
```
Expected: all PASS.

- [ ] **Step 5: Run full suite**

```bash
npx vitest run --pool=threads
```
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/pages/YearVsYear.jsx tests/YearVsYear.test.jsx
git commit -m "feat: YearVsYear — basis year selector, 2024 data, CPI toggle, fix by-category comparison bug"
```

---

### Task 6: Review page — full workflow (third button, sort, tag-all, expense_claims)

**Context:** Review currently shows Personal / Work buttons per transaction. Changes:
1. Add ✓ Done button (dismisses without re-tagging)
2. Update sort: Clothing & shoes first, General Merchandise second, then alpha
3. Tagged Personal/Work transactions stay visible (not immediately removed)
4. "Tag all as reviewed" button in top banner: saves to expense_claims, clears pending, shows actioning view
5. Actioning view: Personal total + Work total, each with "I've done it" button that records actioned_at
6. On load: check expense_claims; if it exists and is not fully actioned, show actioning view directly

**State model:**
- `pending`: transactions not yet triaged this session
- `tagged`: `[{tx, tag: 'personal'|'work'}]` — triaged this session but held for summary
- `claim`: loaded from expense_claims (null = not yet tagged-all for this period)

**Files:**
- Modify: `src/pages/Review.jsx`
- Modify: `tests/Review.test.jsx`

- [ ] **Step 1: Update the test**

Replace `tests/Review.test.jsx`:

```jsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Review from '../src/pages/Review'

const mockFrom = vi.fn()
vi.mock('../src/lib/supabase', () => ({
  supabase: {
    from: (...args) => mockFrom(...args),
  },
}))

function makeChain(overrides = {}) {
  const base = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    eq:     vi.fn().mockReturnThis(),
    not:    vi.fn().mockReturnThis(),
    gte:    vi.fn().mockReturnThis(),
    lt:     vi.fn().mockReturnThis(),
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

  it('shows "Done" button alongside Personal and Work', async () => {
    // uploads returns one period
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
      // transactions: return one transaction
      return makeChain({
        then: vi.fn(cb => Promise.resolve(cb({
          data: [{ id: '1', date: '2025-03-05', description: 'Dinner', amount: 45, category: 'Dining' }],
          error: null,
        }))),
      })
    })

    render(<Review />)
    await waitFor(() => expect(screen.getByText('Dinner')).toBeInTheDocument())
    expect(screen.getByText('Personal')).toBeInTheDocument()
    expect(screen.getByText('Work')).toBeInTheDocument()
    expect(screen.getByText('Done')).toBeInTheDocument()
  })

  it('shows "Tag all as reviewed" button in header', async () => {
    mockFrom.mockImplementation(table => {
      if (table === 'uploads') return makeChain({ then: vi.fn(cb => Promise.resolve(cb({ data: [{ period: '2025-03' }], error: null }))) })
      if (table === 'expense_claims') return makeChain({ then: vi.fn(cb => Promise.resolve(cb({ data: [], error: null }))) })
      return makeChain({ then: vi.fn(cb => Promise.resolve(cb({ data: [], error: null }))) })
    })
    render(<Review />)
    await waitFor(() => expect(screen.getByText(/tag all as reviewed/i)).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Run test — confirm it fails**

```bash
npx vitest run --pool=threads tests/Review.test.jsx
```
Expected: "Done" and "Tag all as reviewed" assertions fail.

- [ ] **Step 3: Rewrite `src/pages/Review.jsx`**

Replace the entire file:

```jsx
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
  const [periods, setPeriods]     = useState([])
  const [periodIndex, setPeriodIndex] = useState(null)
  const [pending, setPending]     = useState([])   // untagged transactions
  const [tagged, setTagged]       = useState([])   // [{tx, tag: 'personal'|'work'}]
  const [claim, setClaim]         = useState(null) // loaded expense_claims row
  const [loading, setLoading]     = useState(true)

  // Load periods
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

  // Load transactions + check existing claim for selected period
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
      if (!existingClaim) {
        setPending(sortTransactions(txs))
      }
      // If claim exists, we show actioning view (pending stays empty)
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
    const totalPersonal = tagged
      .filter(t => t.tag === 'personal')
      .reduce((s, t) => s + Number(t.tx.amount), 0)
    const totalWork = tagged
      .filter(t => t.tag === 'work')
      .reduce((s, t) => s + Number(t.tx.amount), 0)

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
      {/* Header: period picker + tag-all button */}
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

      {/* Actioning view: shown after tag-all or if claim already exists */}
      {claim && (
        <div className="space-y-4">
          {/* Tagged personal summary */}
          {(taggedPersonal.length > 0 || Number(claim.total_personal) > 0) && !claim.personal_actioned_at && (
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

          {/* Tagged work summary */}
          {(taggedWork.length > 0 || Number(claim.total_work) > 0) && !claim.work_actioned_at && (
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

          {/* All complete */}
          {(!Number(claim.total_personal) || claim.personal_actioned_at) &&
           (!Number(claim.total_work)     || claim.work_actioned_at) && (
            <div className="px-5 py-8 text-center text-[#66473B] text-sm border border-[#35211A] rounded">
              All done for {formatPeriodLabel(period)}.
            </div>
          )}
        </div>
      )}

      {/* Active review: pending + in-session tagged transactions */}
      {!claim && (
        <div className="border border-[#66473B] rounded">
          {loading ? (
            <div className="px-5 py-8 text-[#B6A596] text-sm">Loading…</div>
          ) : pending.length === 0 && tagged.length === 0 ? (
            <div className="px-5 py-8 text-[#B6A596] text-sm">All done — nothing left to review.</div>
          ) : (
            <>
              {/* Tagged transactions (held at top, visually marked) */}
              {tagged.map(({ tx, tag }) => (
                <div
                  key={`tagged-${tx.id}`}
                  className="px-5 py-3 flex items-center gap-4 border-b border-[#35211A] bg-white/[0.03]"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#EBDCC4] truncate">{tx.description}</p>
                    <p className="text-xs text-[#66473B] mt-0.5">
                      {tx.date} · <span className="text-[#B6A596]">{tx.category}</span>
                    </p>
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
              {/* Pending transactions */}
              {pending.map((tx, idx) => (
                <div
                  key={tx.id}
                  className={`px-5 py-3 flex items-center gap-4 border-b border-[#35211A] last:border-0 ${idx % 2 === 1 ? 'bg-white/[0.02]' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#EBDCC4] truncate">{tx.description}</p>
                    <p className="text-xs text-[#66473B] mt-0.5">
                      {tx.date} · <span className="text-[#B6A596]">{tx.category}</span>
                    </p>
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
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
npx vitest run --pool=threads tests/Review.test.jsx
```
Expected: 3/3 PASS.

- [ ] **Step 5: Run full suite**

```bash
npx vitest run --pool=threads
```
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Review.jsx tests/Review.test.jsx
git commit -m "feat: Review — Done button, sort General Merchandise, tag-all workflow, expense_claims actioning"
```

---

### Final: push to deploy

- [ ] **Step 1: Push to budgetdash/main**

```bash
git push budgetdash feature/budgeting-dashboard:main --force
```

- [ ] **Step 2: Manual step — run expense_claims migration in Supabase**

Copy `supabase/migrations/004_expense_claims.sql` into the Supabase SQL editor and execute. Verify the table appears.
