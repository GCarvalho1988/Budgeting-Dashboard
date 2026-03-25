# Budgeting Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Netlify-hosted household budgeting dashboard where the admin uploads monthly LifeStages CSVs and both users can view spend analytics; the wife can flag transactions.

**Architecture:** React + Vite SPA hosted on Netlify CDN, with Netlify Functions as the server-side API layer (CSV ingestion, bulk deletes). All reads go directly from the browser via the Supabase JS client. Supabase provides Postgres (transactions, flags), Auth (two role-based accounts), and Storage (raw CSV archive).

**Tech Stack:** React 18, Vite, React Router v6, Tailwind CSS, Recharts, Papaparse, @supabase/supabase-js, xlsx (seed script only), Vitest, @testing-library/react, Netlify Functions (Node 18)

---

## File Structure

```
Budgeting-Dashboard/
├── src/
│   ├── main.jsx                        # React entry, mounts App
│   ├── App.jsx                         # Router, AuthProvider wrapper
│   ├── lib/
│   │   └── supabase.js                 # Supabase client (anon key)
│   ├── context/
│   │   └── AuthContext.jsx             # Auth state + helpers (signIn, signOut, user, role)
│   ├── components/
│   │   ├── Navbar.jsx                  # Top nav tabs + admin upload button
│   │   ├── ProtectedRoute.jsx          # Redirects unauthenticated users to /login
│   │   ├── KpiCard.jsx                 # Reusable stat card (label, value, delta)
│   │   ├── CsvUploader.jsx             # Drag-and-drop upload, preview, duplicate warn, confirm
│   │   ├── CategoryBarChart.jsx        # Recharts bar chart: spend by category
│   │   ├── MonthlyTrendChart.jsx       # Recharts line chart: monthly spend trend
│   │   └── FlagButton.jsx              # Flag icon + comment modal for a transaction row
│   └── pages/
│       ├── Login.jsx                   # Email/password login form
│       ├── Overview.jsx                # Tab 1: KPIs, category bar, trend line
│       ├── Categories.jsx              # Tab 2: category selector, month breakdown, YoY, tx list
│       ├── YearVsYear.jsx              # Tab 3: monthly comparison table, per-category table, forecast
│       └── Transactions.jsx            # Tab 4: filterable transaction list with flagging
├── netlify/
│   └── functions/
│       ├── ingest-csv.js               # POST: parse CSV body, insert transactions, save to Storage
│       └── delete-period.js            # DELETE: remove all transactions for a given period
├── scripts/
│   └── seed-historical.js             # One-off: read Excel tabs, call ingest API for each month
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql      # Tables + RLS policies
├── tests/
│   ├── ingest-csv.test.js             # Unit tests: CSV parsing logic in isolation
│   └── seed-historical.test.js        # Unit tests: Excel row normalisation
├── .env.example                        # Document required env vars
├── vite.config.js
├── netlify.toml
└── package.json
```

---

## Environment Variables

| Variable | Used by | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | Browser | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Browser | Safe to expose; RLS enforces access |
| `SUPABASE_SERVICE_ROLE_KEY` | Netlify Functions only | Bypasses RLS; never expose to browser |

---

## Task 1: Inspect LifeStages CSV Format

**Files:**
- Create: `docs/csv-column-map.md` — document the confirmed column schema

This task has no code. Its output is a column map that all subsequent parser tasks depend on. Do not skip it.

- [ ] **Step 1: Open a sample LifeStages CSV export**

Open one of the provided monthly CSV files in a text editor or spreadsheet app. Note every column header exactly as it appears (including capitalisation and spacing).

- [ ] **Step 2: Document the column map**

Create `docs/csv-column-map.md` with a table:

```markdown
# LifeStages CSV Column Map

| CSV Column Header | Maps to | Notes |
|---|---|---|
| (fill in) | date | Format: DD/MM/YYYY or YYYY-MM-DD? |
| (fill in) | description | Merchant name |
| (fill in) | amount | Positive or negative for spend? |
| (fill in) | category | LifeStages tag |
| (fill in) | (drop) | Any columns not needed |
```

- [ ] **Step 3: Note any data quirks**

Check for: blank rows, header rows mid-file, currency symbols in amounts, date format, encoding (UTF-8?). Add notes to the column map doc.

- [ ] **Step 4: Commit**

```bash
git add docs/csv-column-map.md
git commit -m "docs: document LifeStages CSV column schema"
```

---

## Task 2: Project Scaffold

**Files:**
- Create: `Budgeting-Dashboard/` (all scaffold files listed above)
- Create: `netlify.toml`
- Create: `.env.example`

- [ ] **Step 1: Scaffold Vite + React project**

From inside `Claude PlayArea/`:

```bash
npm create vite@latest Budgeting-Dashboard -- --template react
cd Budgeting-Dashboard
npm install
```

- [ ] **Step 2: Install dependencies**

```bash
npm install @supabase/supabase-js react-router-dom recharts papaparse
npm install -D tailwindcss @tailwindcss/vite vitest @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 3: Configure Tailwind**

In `vite.config.js`, add the Tailwind plugin:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.js'],
  },
})
```

Create `src/index.css`:
```css
@import "tailwindcss";
```

Create `src/test-setup.js`:
```js
import '@testing-library/jest-dom'
```

- [ ] **Step 4: Create Supabase client**

Create `src/lib/supabase.js`:

```js
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

- [ ] **Step 5: Create .env.example**

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Copy to `.env.local` and fill in real values. Add `.env.local` to `.gitignore`.

- [ ] **Step 6: Create netlify.toml**

```toml
[build]
  base = "Budgeting-Dashboard"
  command = "npm run build"
  publish = "dist"
  functions = "netlify/functions"

[dev]
  command = "npm run dev"
  port = 5173
  functions = "netlify/functions"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

- [ ] **Step 7: Wire up App.jsx with placeholder routing**

Replace `src/App.jsx`:

```jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
```

Create stub `src/pages/Login.jsx`:
```jsx
export default function Login() {
  return <div className="p-8">Login page</div>
}
```

- [ ] **Step 8: Verify dev server starts**

```bash
npm run dev
```

Expected: Vite dev server running, browser shows "Login page".

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: scaffold Budgeting-Dashboard (Vite + React + Tailwind + Supabase client)"
```

---

## Task 3: Supabase Schema

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`

Run these SQL statements in the Supabase dashboard SQL editor (or via `supabase db push` if CLI is set up).

- [ ] **Step 1: Create the schema SQL file**

Create `supabase/migrations/001_initial_schema.sql`:

```sql
-- Profiles (extends Supabase auth.users)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'member'))
);

-- Uploads (one row per imported CSV)
create table uploads (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  period text not null,  -- YYYY-MM e.g. '2025-10'
  uploaded_by uuid references profiles(id),
  uploaded_at timestamptz default now(),
  row_count integer not null
);
create unique index uploads_period_unique on uploads(period);

-- Transactions
create table transactions (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  description text not null,
  amount numeric(10,2) not null,
  category text not null,
  upload_id uuid references uploads(id) on delete cascade
);
create index transactions_upload_idx on transactions(upload_id);
create index transactions_date_idx on transactions(date);
create index transactions_category_idx on transactions(category);

-- Flags (comments on transactions)
create table flags (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid references transactions(id) on delete cascade,
  user_id uuid references profiles(id),
  comment text not null,
  created_at timestamptz default now()
);
create index flags_transaction_idx on flags(transaction_id);

-- Row Level Security
alter table profiles enable row level security;
alter table uploads enable row level security;
alter table transactions enable row level security;
alter table flags enable row level security;

-- All authenticated users can read everything
create policy "authenticated read profiles" on profiles for select using (auth.role() = 'authenticated');
create policy "authenticated read uploads" on uploads for select using (auth.role() = 'authenticated');
create policy "authenticated read transactions" on transactions for select using (auth.role() = 'authenticated');
create policy "authenticated read flags" on flags for select using (auth.role() = 'authenticated');

-- Only authenticated users can insert their own flags
create policy "insert own flags" on flags for insert with check (auth.uid() = user_id);

-- Uploads and transactions are written by service role only (Netlify Functions)
-- No insert/update/delete policies needed for client — service role bypasses RLS
```

- [ ] **Step 2: Run the migration in Supabase dashboard**

Go to Supabase → SQL Editor → paste the contents of `001_initial_schema.sql` → Run.

Verify: all four tables appear in the Table Editor.

- [ ] **Step 3: Create the two user accounts in Supabase Auth**

Go to Supabase → Authentication → Users → Invite user (or Add user).

Create:
- Admin user (your email), then manually insert into `profiles`: `('your-user-id', 'your@email.com', 'admin')`
- Member user (wife's email), insert into `profiles`: `('wife-user-id', 'wife@email.com', 'member')`

Note both user IDs for reference.

- [ ] **Step 4: Create Supabase Storage bucket**

Go to Supabase → Storage → New bucket → name: `csv-uploads` → Private.

- [ ] **Step 5: Commit**

```bash
git add supabase/
git commit -m "feat: add Supabase schema (profiles, uploads, transactions, flags) with RLS"
```

---

## Task 4: Auth — Login Page + Auth Context + Protected Routes

**Files:**
- Create: `src/context/AuthContext.jsx`
- Create: `src/components/ProtectedRoute.jsx`
- Modify: `src/pages/Login.jsx`
- Modify: `src/App.jsx`
- Create: `tests/auth.test.jsx`

- [ ] **Step 1: Write failing tests for AuthContext**

Create `tests/auth.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider, useAuth } from '../src/context/AuthContext'

// Mock supabase
vi.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null }),
        }),
      }),
    }),
  },
}))

function TestConsumer() {
  const { user, role, loading } = useAuth()
  if (loading) return <div>loading</div>
  return <div>{user ? `role:${role}` : 'not-signed-in'}</div>
}

describe('AuthContext', () => {
  it('shows loading then resolves to not-signed-in when no session', async () => {
    render(<AuthProvider><TestConsumer /></AuthProvider>)
    expect(screen.getByText('loading')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('not-signed-in')).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -- tests/auth.test.jsx
```

Expected: FAIL — AuthContext module not found.

- [ ] **Step 3: Implement AuthContext**

Create `src/context/AuthContext.jsx`:

```jsx
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()
    setRole(data?.role ?? null)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) loadProfile(session.user.id).finally(() => setLoading(false))
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) loadProfile(session.user.id)
      else setRole(null)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, role, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test -- tests/auth.test.jsx
```

Expected: PASS

- [ ] **Step 5: Implement Login page**

Replace `src/pages/Login.jsx`:

```jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const err = await signIn(email, password)
    if (err) {
      setError('Invalid email or password.')
      setLoading(false)
    } else {
      navigate('/')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-xl shadow p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Budget Dashboard</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Implement ProtectedRoute**

Create `src/components/ProtectedRoute.jsx`:

```jsx
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, requiredRole }) {
  const { user, role, loading } = useAuth()
  if (loading) return <div className="p-8 text-gray-500">Loading…</div>
  if (!user) return <Navigate to="/login" replace />
  if (requiredRole && role !== requiredRole) return <Navigate to="/" replace />
  return children
}
```

- [ ] **Step 7: Wire everything into App.jsx**

Replace `src/App.jsx`:

```jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Overview from './pages/Overview'
import Categories from './pages/Categories'
import YearVsYear from './pages/YearVsYear'
import Transactions from './pages/Transactions'

// Stub pages — replace in later tasks
function stub(name) { return () => <div className="p-8">{name}</div> }
// Use real imports once pages are built; for now create stubs
```

Create stub pages:
```bash
echo "export default function Overview() { return <div className='p-8'>Overview</div> }" > src/pages/Overview.jsx
echo "export default function Categories() { return <div className='p-8'>Categories</div> }" > src/pages/Categories.jsx
echo "export default function YearVsYear() { return <div className='p-8'>Year vs Year</div> }" > src/pages/YearVsYear.jsx
echo "export default function Transactions() { return <div className='p-8'>Transactions</div> }" > src/pages/Transactions.jsx
```

Replace `src/App.jsx`:
```jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Navbar from './components/Navbar'
import Overview from './pages/Overview'
import Categories from './pages/Categories'
import YearVsYear from './pages/YearVsYear'
import Transactions from './pages/Transactions'

function Layout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Layout><Overview /></Layout></ProtectedRoute>} />
          <Route path="/categories" element={<ProtectedRoute><Layout><Categories /></Layout></ProtectedRoute>} />
          <Route path="/year-vs-year" element={<ProtectedRoute><Layout><YearVsYear /></Layout></ProtectedRoute>} />
          <Route path="/transactions" element={<ProtectedRoute><Layout><Transactions /></Layout></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
```

Create stub `src/components/Navbar.jsx` (full version in Task 5):
```jsx
export default function Navbar() {
  return <nav className="bg-white border-b border-gray-200 px-4 py-3">Budget Dashboard</nav>
}
```

- [ ] **Step 8: Smoke test auth flow manually**

```bash
npm run dev
```

Navigate to `http://localhost:5173`. Should redirect to `/login`. Sign in with the admin account created in Task 3. Should redirect to `/` (Overview stub).

- [ ] **Step 9: Commit**

```bash
git add src/
git commit -m "feat: auth context, login page, protected routes"
```

---

## Task 5: CSV Parser — Netlify Function (ingest-csv)

**Files:**
- Create: `netlify/functions/ingest-csv.js`
- Create: `netlify/functions/delete-period.js`
- Create: `tests/ingest-csv.test.js`

> **Prerequisite:** Complete Task 1 (CSV column map) before implementing the column mapping in `parseRow`.

- [ ] **Step 1: Write failing tests for the CSV parser**

Create `tests/ingest-csv.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { parseRow, detectPeriod } from '../netlify/functions/ingest-csv.js'

// Update column names to match docs/csv-column-map.md after Task 1
const SAMPLE_ROW = {
  Date: '01/10/2025',       // update header name if different
  Description: 'Tesco',
  Amount: '-45.67',         // update if amount format differs
  Category: 'Groceries',
}

describe('parseRow', () => {
  it('maps CSV row to transaction object', () => {
    const result = parseRow(SAMPLE_ROW)
    expect(result.date).toBe('2025-10-01')
    expect(result.description).toBe('Tesco')
    expect(result.amount).toBe(45.67)   // stored as positive spend
    expect(result.category).toBe('Groceries')
  })

  it('throws on missing required field', () => {
    expect(() => parseRow({ Date: '01/10/2025' })).toThrow()
  })
})

describe('detectPeriod', () => {
  it('returns YYYY-MM from a list of transaction dates', () => {
    const rows = [{ date: '2025-10-01' }, { date: '2025-10-15' }]
    expect(detectPeriod(rows)).toBe('2025-10')
  })

  it('throws if rows span multiple months', () => {
    const rows = [{ date: '2025-10-01' }, { date: '2025-11-01' }]
    expect(() => detectPeriod(rows)).toThrow()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- tests/ingest-csv.test.js
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the parser and Netlify Function**

Create `netlify/functions/ingest-csv.js`:

```js
import Papa from 'papaparse'
import { createClient } from '@supabase/supabase-js'

// --- Pure parsing helpers (exported for testing) ---

export function parseRow(row) {
  // Update these key names to match docs/csv-column-map.md
  const DATE_COL = 'Date'
  const DESC_COL = 'Description'
  const AMOUNT_COL = 'Amount'
  const CAT_COL = 'Category'

  if (!row[DATE_COL] || !row[DESC_COL] || !row[AMOUNT_COL] || !row[CAT_COL]) {
    throw new Error(`Missing required column in row: ${JSON.stringify(row)}`)
  }

  // Parse date: handle DD/MM/YYYY → YYYY-MM-DD
  const [d, m, y] = row[DATE_COL].split('/')
  const date = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`

  // Amount: strip £ symbol, make positive for spend
  const amount = Math.abs(parseFloat(row[AMOUNT_COL].replace(/[^0-9.-]/g, '')))

  return {
    date,
    description: row[DESC_COL].trim(),
    amount,
    category: row[CAT_COL].trim(),
  }
}

export function detectPeriod(rows) {
  const months = new Set(rows.map(r => r.date.slice(0, 7)))
  if (months.size !== 1) throw new Error(`CSV spans multiple months: ${[...months].join(', ')}`)
  return [...months][0]
}

// --- Netlify Function handler ---

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' }

  const { csvText, filename, uploadedBy } = JSON.parse(event.body)

  // Parse CSV
  const { data: rawRows, errors } = Papa.parse(csvText, { header: true, skipEmptyLines: true })
  if (errors.length) return { statusCode: 400, body: JSON.stringify({ error: 'CSV parse error', details: errors }) }

  // Parse rows, collect warnings for malformed ones
  const parsed = []
  const warnings = []
  for (const row of rawRows) {
    try { parsed.push(parseRow(row)) }
    catch (e) { warnings.push(e.message) }
  }

  if (parsed.length === 0) return { statusCode: 400, body: JSON.stringify({ error: 'No valid rows found', warnings }) }

  // Detect period
  let period
  try { period = detectPeriod(parsed) }
  catch (e) { return { statusCode: 400, body: JSON.stringify({ error: e.message }) } }

  // Check for duplicate period
  const { data: existing } = await supabase.from('uploads').select('id').eq('period', period).single()
  if (existing) return { statusCode: 409, body: JSON.stringify({ conflict: true, period }) }

  // Save raw CSV to Storage
  const { error: storageErr } = await supabase.storage.from('csv-uploads').upload(`${period}/${filename}`, csvText, { contentType: 'text/csv' })
  if (storageErr) return { statusCode: 500, body: JSON.stringify({ error: 'Storage upload failed' }) }

  // Insert upload record
  const { data: upload, error: uploadErr } = await supabase.from('uploads').insert({
    filename, period, uploaded_by: uploadedBy, row_count: parsed.length
  }).select().single()
  if (uploadErr) return { statusCode: 500, body: JSON.stringify({ error: uploadErr.message }) }

  // Insert transactions
  const txRows = parsed.map(t => ({ ...t, upload_id: upload.id }))
  const { error: txErr } = await supabase.from('transactions').insert(txRows)
  if (txErr) return { statusCode: 500, body: JSON.stringify({ error: txErr.message }) }

  return { statusCode: 200, body: JSON.stringify({ period, rowCount: parsed.length, warnings }) }
}
```

Create `netlify/functions/delete-period.js`:

```js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export const handler = async (event) => {
  if (event.httpMethod !== 'DELETE') return { statusCode: 405, body: 'Method not allowed' }
  const { period } = JSON.parse(event.body)

  // Deleting the upload cascades to transactions (ON DELETE CASCADE)
  const { error } = await supabase.from('uploads').delete().eq('period', period)
  if (error) return { statusCode: 500, body: JSON.stringify({ error: error.message }) }

  return { statusCode: 200, body: JSON.stringify({ deleted: period }) }
}
```

- [ ] **Step 4: Add Papaparse to function dependencies**

```bash
npm install papaparse
```

Update `vite.config.js` to exclude `papaparse` from Vite optimisation if needed. Also ensure netlify.toml has the right Node version:

In `netlify.toml`:
```toml
[functions]
  node_bundler = "esbuild"
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm run test -- tests/ingest-csv.test.js
```

Expected: PASS (update `SAMPLE_ROW` constants to match real CSV columns from Task 1 first)

- [ ] **Step 6: Commit**

```bash
git add netlify/ tests/ingest-csv.test.js
git commit -m "feat: CSV parser and ingest-csv / delete-period Netlify Functions"
```

---

## Task 6: Upload UI (CsvUploader Component)

**Files:**
- Create: `src/components/CsvUploader.jsx`
- Modify: `src/components/Navbar.jsx` (add upload trigger for admin)

- [ ] **Step 1: Implement CsvUploader**

> **After completing Task 1**, update the `r.Category` and `r.Date` references in `handleFile` below to match the real CSV column names from `docs/csv-column-map.md`. The client-side preview depends on these matching the actual headers.

Create `src/components/CsvUploader.jsx`:

```jsx
import { useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext'

export default function CsvUploader({ onSuccess }) {
  const { user } = useAuth()
  const [stage, setStage] = useState('idle')  // idle | preview | conflict | uploading | done | error
  const [preview, setPreview] = useState(null) // { rowCount, period, categories, warnings }
  const [conflict, setConflict] = useState(null)
  const [csvText, setCsvText] = useState('')
  const [filename, setFilename] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const inputRef = useRef()

  async function handleFile(file) {
    setFilename(file.name)
    const text = await file.text()
    setCsvText(text)

    // Client-side preview parse
    const { default: Papa } = await import('papaparse')
    const { data } = Papa.parse(text, { header: true, skipEmptyLines: true })
    const categories = [...new Set(data.map(r => r.Category).filter(Boolean))]
    const dates = data.map(r => r.Date).filter(Boolean)
    // Detect period from first date
    const [d, m, y] = (dates[0] || '').split('/')
    const period = y && m ? `${y}-${m.padStart(2,'0')}` : 'unknown'

    setPreview({ rowCount: data.length, period, categories, warnings: [] })
    setStage('preview')
  }

  async function handleConfirm(overwrite = false) {
    setStage('uploading')
    if (overwrite) {
      await fetch('/.netlify/functions/delete-period', {
        method: 'DELETE',
        body: JSON.stringify({ period: preview.period }),
      })
    }
    const res = await fetch('/.netlify/functions/ingest-csv', {
      method: 'POST',
      body: JSON.stringify({ csvText, filename, uploadedBy: user.id }),
    })
    const json = await res.json()
    if (res.status === 409) { setConflict(json); setStage('conflict'); return }
    if (!res.ok) { setErrorMsg(json.error || 'Upload failed'); setStage('error'); return }
    setStage('done')
    onSuccess?.()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
        {stage === 'idle' && (
          <>
            <h2 className="text-lg font-semibold mb-4">Upload CSV</h2>
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400"
              onClick={() => inputRef.current.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]) }}
            >
              <p className="text-gray-500">Drag & drop a LifeStages CSV, or click to browse</p>
            </div>
            <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={e => handleFile(e.target.files[0])} />
          </>
        )}

        {stage === 'preview' && preview && (
          <>
            <h2 className="text-lg font-semibold mb-4">Preview: {filename}</h2>
            <dl className="space-y-2 text-sm mb-4">
              <div className="flex justify-between"><dt className="text-gray-500">Period</dt><dd className="font-medium">{preview.period}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Transactions</dt><dd className="font-medium">{preview.rowCount}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Categories</dt><dd className="font-medium">{preview.categories.join(', ')}</dd></div>
            </dl>
            {preview.warnings.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4 text-xs text-yellow-800">
                {preview.warnings.length} rows skipped due to formatting issues.
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => setStage('idle')} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm">Cancel</button>
              <button onClick={() => handleConfirm(false)} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm">Import</button>
            </div>
          </>
        )}

        {stage === 'conflict' && (
          <>
            <h2 className="text-lg font-semibold mb-2">Period already imported</h2>
            <p className="text-sm text-gray-600 mb-4">{conflict?.period} already exists. Overwrite it with this file?</p>
            <div className="flex gap-3">
              <button onClick={() => setStage('idle')} className="flex-1 border border-gray-300 rounded-lg py-2 text-sm">Cancel</button>
              <button onClick={() => handleConfirm(true)} className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm">Overwrite</button>
            </div>
          </>
        )}

        {stage === 'uploading' && <p className="text-center text-gray-500 py-8">Importing…</p>}
        {stage === 'done' && (
          <>
            <p className="text-center text-green-600 py-4 font-medium">Import complete!</p>
            <button onClick={() => setStage('idle')} className="w-full border border-gray-300 rounded-lg py-2 text-sm">Close</button>
          </>
        )}
        {stage === 'error' && (
          <>
            <p className="text-red-600 mb-4">{errorMsg}</p>
            <button onClick={() => setStage('idle')} className="w-full border border-gray-300 rounded-lg py-2 text-sm">Try again</button>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Implement Navbar with upload trigger**

Replace `src/components/Navbar.jsx`:

```jsx
import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import CsvUploader from './CsvUploader'

const tabs = [
  { to: '/', label: 'Overview', end: true },
  { to: '/categories', label: 'Categories' },
  { to: '/year-vs-year', label: 'Year vs Year' },
  { to: '/transactions', label: 'Transactions' },
]

export default function Navbar() {
  const { role, signOut } = useAuth()
  const navigate = useNavigate()
  const [uploaderOpen, setUploaderOpen] = useState(false)

  return (
    <>
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-6 h-14">
          <span className="font-bold text-gray-900 mr-4">💰 BudgetDash</span>
          {tabs.map(t => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `text-sm font-medium pb-0.5 border-b-2 transition-colors ${
                  isActive ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-900'
                }`
              }
            >
              {t.label}
            </NavLink>
          ))}
          <div className="ml-auto flex items-center gap-3">
            {role === 'admin' && (
              <button
                onClick={() => setUploaderOpen(true)}
                className="bg-blue-600 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-blue-700"
              >
                Upload CSV
              </button>
            )}
            <button onClick={() => { signOut(); navigate('/login') }} className="text-sm text-gray-500 hover:text-gray-900">
              Sign out
            </button>
          </div>
        </div>
      </nav>
      {uploaderOpen && <CsvUploader onSuccess={() => setUploaderOpen(false)} />}
    </>
  )
}
```

- [ ] **Step 3: Smoke test upload flow manually**

```bash
npx netlify dev
```

Sign in as admin. Click "Upload CSV". Drag in a real LifeStages CSV. Verify preview shows correct period, row count, and categories. Confirm import. Check Supabase Table Editor — rows should appear in `uploads` and `transactions`.

- [ ] **Step 4: Commit**

```bash
git add src/components/
git commit -m "feat: CSV upload UI with preview, duplicate warning, and confirm flow"
```

---

## Task 7: Historical Data Seeder (One-Off Script)

**Files:**
- Create: `scripts/seed-historical.js`
- Create: `tests/seed-historical.test.js`

This runs once locally to import the two Excel tabs into Supabase. It uses the same `ingest-csv` Netlify Function via HTTP, or can write directly to Supabase using the service role key.

- [ ] **Step 1: Install xlsx**

```bash
npm install xlsx --save-dev
```

- [ ] **Step 2: Write failing tests for row normalisation**

Create `tests/seed-historical.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { normaliseExcelRow } from '../scripts/seed-historical.js'

describe('normaliseExcelRow', () => {
  it('converts Excel serial date to ISO date string', () => {
    // Excel serial 45200 = 2023-10-01
    const row = { Date: 45200, Description: 'Tesco', Amount: -45.67, Category: 'Groceries' }
    const result = normaliseExcelRow(row)
    expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(result.amount).toBe(45.67)
  })

  it('handles string date format too', () => {
    const row = { Date: '01/10/2024', Description: 'Tesco', Amount: '-45.67', Category: 'Groceries' }
    const result = normaliseExcelRow(row)
    expect(result.date).toBe('2024-10-01')
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npm run test -- tests/seed-historical.test.js
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement the seeder**

Create `scripts/seed-historical.js`:

```js
import * as XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

// --- Helper exported for testing ---

export function normaliseExcelRow(row) {
  // Update column names to match actual Excel headers (check docs/csv-column-map.md)
  const DATE_COL = 'Date'
  const DESC_COL = 'Description'
  const AMOUNT_COL = 'Amount'
  const CAT_COL = 'Category'

  let date
  const rawDate = row[DATE_COL]
  if (typeof rawDate === 'number') {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(rawDate)
    date = `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`
  } else {
    // String DD/MM/YYYY
    const [d, m, y] = String(rawDate).split('/')
    date = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
  }

  const amount = Math.abs(parseFloat(String(row[AMOUNT_COL]).replace(/[^0-9.-]/g, '')))
  const description = String(row[DESC_COL]).trim()
  const category = String(row[CAT_COL]).trim()

  if (!date || !description || isNaN(amount) || !category) {
    throw new Error(`Invalid row: ${JSON.stringify(row)}`)
  }

  return { date, description, amount, category }
}

// --- Main seeder (run directly) ---

async function seed() {
  const EXCEL_PATH = process.argv[2]
  if (!EXCEL_PATH) { console.error('Usage: node scripts/seed-historical.js <path-to-excel.xlsx>'); process.exit(1) }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  const workbook = XLSX.read(readFileSync(EXCEL_PATH), { type: 'buffer' })

  for (const sheetName of workbook.SheetNames) {
    console.log(`\nProcessing sheet: ${sheetName}`)
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName])

    // Group by month
    const byMonth = {}
    let skipped = 0
    for (const row of rows) {
      try {
        const tx = normaliseExcelRow(row)
        const month = tx.date.slice(0, 7)
        if (!byMonth[month]) byMonth[month] = []
        byMonth[month].push(tx)
      } catch { skipped++ }
    }
    console.log(`  Skipped ${skipped} invalid rows`)

    // Insert each month
    for (const [period, txs] of Object.entries(byMonth)) {
      const { data: existing } = await supabase.from('uploads').select('id').eq('period', period).single()
      if (existing) { console.log(`  Skipping ${period} — already imported`); continue }

      const { data: upload, error: uploadErr } = await supabase.from('uploads')
        .insert({ filename: `${sheetName}-seed`, period, uploaded_by: null, row_count: txs.length })
        .select().single()
      if (uploadErr) { console.error(`  Error inserting upload for ${period}:`, uploadErr.message); continue }

      const { error: txErr } = await supabase.from('transactions').insert(txs.map(t => ({ ...t, upload_id: upload.id })))
      if (txErr) { console.error(`  Error inserting transactions for ${period}:`, txErr.message); continue }

      console.log(`  ✓ ${period}: ${txs.length} transactions`)
    }
  }
  console.log('\nSeeding complete.')
}

// Guard: only run when executed directly, not when imported by tests
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seed()
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm run test -- tests/seed-historical.test.js
```

Expected: PASS

- [ ] **Step 6: Run the seeder against the real Excel file**

```bash
SUPABASE_URL=https://your-project.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=your-key \
node scripts/seed-historical.js path/to/historical-data.xlsx
```

Verify row counts in Supabase Table Editor match expectations.

- [ ] **Step 7: Commit**

```bash
git add scripts/ tests/seed-historical.test.js
git commit -m "feat: historical data seeder script (Excel → Supabase)"
```

---

## Task 8: KpiCard + CategoryBarChart + MonthlyTrendChart Components

**Files:**
- Create: `src/components/KpiCard.jsx`
- Create: `src/components/CategoryBarChart.jsx`
- Create: `src/components/MonthlyTrendChart.jsx`

- [ ] **Step 1: Install Recharts**

```bash
npm install recharts
```

- [ ] **Step 2: Implement KpiCard**

Create `src/components/KpiCard.jsx`:

```jsx
export default function KpiCard({ label, value, delta, deltaLabel }) {
  const positive = delta > 0
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {delta !== undefined && (
        <p className={`text-sm mt-1 ${positive ? 'text-red-500' : 'text-green-600'}`}>
          {positive ? '↑' : '↓'} {Math.abs(delta)}% {deltaLabel}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Implement CategoryBarChart**

Create `src/components/CategoryBarChart.jsx`:

```jsx
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const COLOURS = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#6366f1','#14b8a6','#f97316']

export default function CategoryBarChart({ data }) {
  // data: [{ category: 'Groceries', amount: 843 }, ...]
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} layout="vertical" margin={{ left: 80, right: 20 }}>
        <XAxis type="number" tickFormatter={v => `£${v}`} tick={{ fontSize: 12 }} />
        <YAxis type="category" dataKey="category" tick={{ fontSize: 12 }} width={80} />
        <Tooltip formatter={v => [`£${v.toFixed(2)}`, 'Spend']} />
        <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
          {data.map((_, i) => <Cell key={i} fill={COLOURS[i % COLOURS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 4: Implement MonthlyTrendChart**

Create `src/components/MonthlyTrendChart.jsx`:

```jsx
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

export default function MonthlyTrendChart({ data }) {
  // data: [{ month: 'Oct 24', amount: 2847 }, ...]
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ left: 10, right: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={v => `£${v}`} tick={{ fontSize: 11 }} />
        <Tooltip formatter={v => [`£${v.toFixed(2)}`, 'Spend']} />
        <Line type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/
git commit -m "feat: KpiCard, CategoryBarChart, MonthlyTrendChart components"
```

---

## Task 9: Overview Page

**Files:**
- Modify: `src/pages/Overview.jsx`

- [ ] **Step 1: Implement Overview page**

Replace `src/pages/Overview.jsx`:

```jsx
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import KpiCard from '../components/KpiCard'
import CategoryBarChart from '../components/CategoryBarChart'
import MonthlyTrendChart from '../components/MonthlyTrendChart'

function formatGBP(n) { return `£${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }

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
      const yoyDelta = lastYearTotal > 0 ? Math.round(((currentTotal - lastYearTotal) / lastYearTotal) * 100) : null

      // Category breakdown for current month
      const catMap = {}
      currentTx?.forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + Number(t.amount) })
      const sortedCats = Object.entries(catMap).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount)
      const topCat = sortedCats[0]?.category ?? '—'

      // Flag count
      const { count: flagCount } = await supabase
        .from('flags')
        .select('id', { count: 'exact', head: true })

      // Monthly trend (last 12 months of data)
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
        const label = new Date(Number(ty), Number(tm) - 1).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
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
        <KpiCard label="vs Last Year" value={kpis.yoyDelta !== null ? `${kpis.yoyDelta > 0 ? '+' : ''}${kpis.yoyDelta}%` : '—'} delta={kpis.yoyDelta} deltaLabel="YoY" />
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
```

- [ ] **Step 2: Smoke test with real data**

Ensure Task 7 (seeder) has run. Start dev server and verify:
- KPI cards show correct values
- Category bar chart renders with categories from the data
- Trend line covers all available months

- [ ] **Step 3: Commit**

```bash
git add src/pages/Overview.jsx
git commit -m "feat: Overview page (KPIs, category chart, trend chart)"
```

---

## Task 10: Categories Page

**Files:**
- Modify: `src/pages/Categories.jsx`

- [ ] **Step 1: Implement Categories page**

Replace `src/pages/Categories.jsx`:

```jsx
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import MonthlyTrendChart from '../components/MonthlyTrendChart'

function formatGBP(n) { return `£${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` }

export default function Categories() {
  const [categories, setCategories] = useState([])
  const [selected, setSelected] = useState(null)
  const [monthData, setMonthData] = useState([])
  const [yoy, setYoy] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('transactions').select('category').then(({ data }) => {
      const cats = [...new Set(data?.map(t => t.category))].sort()
      setCategories(cats)
      if (cats.length) setSelected(cats[0])
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!selected) return
    async function load() {
      const { data: txs } = await supabase
        .from('transactions')
        .select('date, amount, description')
        .eq('category', selected)
        .order('date', { ascending: false })

      setTransactions(txs || [])

      const monthMap = {}
      txs?.forEach(t => {
        const mo = t.date.slice(0, 7)
        monthMap[mo] = (monthMap[mo] || 0) + Number(t.amount)
      })
      const trend = Object.entries(monthMap).sort(([a],[b]) => a.localeCompare(b)).map(([mo, amount]) => {
        const [y, m] = mo.split('-')
        const label = new Date(Number(y), Number(m)-1).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
        return { month: label, amount: Math.round(amount) }
      })

      // YoY totals for this category
      const byYear = {}
      txs?.forEach(t => {
        const y = t.date.slice(0, 4)
        byYear[y] = (byYear[y] || 0) + Number(t.amount)
      })
      const years = Object.keys(byYear).sort()
      const cy = years[years.length - 1]
      const py = String(Number(cy) - 1)
      const yoyDelta = byYear[py] ? Math.round(((byYear[cy] - byYear[py]) / byYear[py]) * 100) : null

      setYoy({ cy, py, cyTotal: byYear[cy] ?? 0, pyTotal: byYear[py] ?? 0, delta: yoyDelta })
      setMonthData(trend)
    }
    load()
  }, [selected])

  if (loading) return <div className="text-gray-400 py-8">Loading…</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelected(cat)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${selected === cat ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-400'}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {selected && (
        <>
          {yoy && (
            <div className="flex gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-5 flex-1">
                <p className="text-xs text-gray-500 uppercase tracking-wide">{yoy.py} Total</p>
                <p className="text-xl font-bold text-gray-900">{formatGBP(yoy.pyTotal)}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-5 flex-1">
                <p className="text-xs text-gray-500 uppercase tracking-wide">{yoy.cy} Total</p>
                <p className="text-xl font-bold text-gray-900">{formatGBP(yoy.cyTotal)}</p>
                {yoy.delta !== null && (
                  <p className={`text-sm ${yoy.delta > 0 ? 'text-red-500' : 'text-green-600'}`}>
                    {yoy.delta > 0 ? '↑' : '↓'} {Math.abs(yoy.delta)}% YoY
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">{selected} — Monthly Spend</h2>
            <MonthlyTrendChart data={monthData} />
          </div>

          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">Transactions in {selected}</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {transactions.map(tx => (
                <div key={tx.date + tx.description + tx.amount} className="px-5 py-3 flex justify-between text-sm">
                  <div>
                    <p className="text-gray-900">{tx.description}</p>
                    <p className="text-gray-400 text-xs">{tx.date}</p>
                  </div>
                  <p className="text-gray-900 font-medium">{formatGBP(tx.amount)}</p>
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

- [ ] **Step 2: Smoke test — select different categories, verify data changes**

- [ ] **Step 3: Commit**

```bash
git add src/pages/Categories.jsx
git commit -m "feat: Categories page with monthly trend and transaction list"
```

---

## Task 11: Year vs Year Page

**Files:**
- Modify: `src/pages/YearVsYear.jsx`

Forecast method: linear extrapolation — `(sum of completed months / number of completed months) × 12`.

- [ ] **Step 1: Implement Year vs Year page**

Replace `src/pages/YearVsYear.jsx`:

```jsx
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function formatGBP(n) { return `£${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` }

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function YearVsYear() {
  const [loading, setLoading] = useState(true)
  const [currentYear, setCurrentYear] = useState(null)
  const [prevYear, setPrevYear] = useState(null)
  const [rows, setRows] = useState([])        // monthly comparison rows
  const [catRows, setCatRows] = useState([])  // category comparison rows
  const [forecast, setForecast] = useState(null)

  useEffect(() => {
    async function load() {
      const { data: tx } = await supabase.from('transactions').select('date, amount, category')

      // Group by year-month
      const byYearMonth = {}
      const byCatYear = {}
      tx?.forEach(t => {
        const [y, m] = t.date.split('-')
        const yr = Number(y), mo = Number(m)
        const amt = Number(t.amount)

        if (!byYearMonth[yr]) byYearMonth[yr] = {}
        byYearMonth[yr][mo] = (byYearMonth[yr][mo] || 0) + amt

        const key = `${t.category}|${yr}`
        byCatYear[key] = (byCatYear[key] || 0) + amt
      })

      const years = Object.keys(byYearMonth).map(Number).sort()
      const cy = years[years.length - 1]
      const py = cy - 1
      setCurrentYear(cy)
      setPrevYear(py)

      // Monthly rows
      const monthRows = MONTHS.map((label, i) => {
        const mo = i + 1
        const cur = byYearMonth[cy]?.[mo] ?? null
        const prev = byYearMonth[py]?.[mo] ?? null
        const delta = cur !== null && prev !== null ? Math.round(((cur - prev) / prev) * 100) : null
        return { label, cur, prev, delta }
      })
      setRows(monthRows)

      // Forecast (current year)
      const completedMonths = monthRows.filter(r => r.cur !== null)
      if (completedMonths.length > 0) {
        const avgMonthly = completedMonths.reduce((s, r) => s + r.cur, 0) / completedMonths.length
        setForecast(Math.round(avgMonthly * 12))
      }

      // Category rows
      const categories = [...new Set(tx?.map(t => t.category))].sort()
      const catRowData = categories.map(cat => {
        const cur = byCatYear[`${cat}|${cy}`] ?? 0
        const prev = byCatYear[`${cat}|${py}`] ?? 0
        const delta = prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null
        return { cat, cur, prev, delta }
      }).sort((a, b) => b.cur - a.cur)
      setCatRows(catRowData)

      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="text-gray-400 py-8">Loading…</div>

  return (
    <div className="space-y-6">
      {/* Monthly comparison */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Monthly: {prevYear} vs {currentYear}</h2>
          {forecast && <span className="text-sm text-gray-500">{currentYear} forecast: <strong className="text-gray-900">{formatGBP(forecast)}</strong></span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-5 py-2 text-gray-500 font-medium">Month</th>
                <th className="text-right px-5 py-2 text-gray-500 font-medium">{prevYear}</th>
                <th className="text-right px-5 py-2 text-gray-500 font-medium">{currentYear}</th>
                <th className="text-right px-5 py-2 text-gray-500 font-medium">Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map(r => (
                <tr key={r.label}>
                  <td className="px-5 py-2.5 text-gray-900">{r.label}</td>
                  <td className="px-5 py-2.5 text-right text-gray-500">{r.prev !== null ? formatGBP(r.prev) : '—'}</td>
                  <td className="px-5 py-2.5 text-right text-gray-900 font-medium">{r.cur !== null ? formatGBP(r.cur) : '—'}</td>
                  <td className={`px-5 py-2.5 text-right font-medium ${r.delta === null ? 'text-gray-300' : r.delta > 0 ? 'text-red-500' : 'text-green-600'}`}>
                    {r.delta !== null ? `${r.delta > 0 ? '+' : ''}${r.delta}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Category comparison */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">By Category: {prevYear} vs {currentYear}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-5 py-2 text-gray-500 font-medium">Category</th>
                <th className="text-right px-5 py-2 text-gray-500 font-medium">{prevYear}</th>
                <th className="text-right px-5 py-2 text-gray-500 font-medium">{currentYear}</th>
                <th className="text-right px-5 py-2 text-gray-500 font-medium">Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {catRows.map(r => (
                <tr key={r.cat}>
                  <td className="px-5 py-2.5 text-gray-900">{r.cat}</td>
                  <td className="px-5 py-2.5 text-right text-gray-500">{formatGBP(r.prev)}</td>
                  <td className="px-5 py-2.5 text-right text-gray-900 font-medium">{formatGBP(r.cur)}</td>
                  <td className={`px-5 py-2.5 text-right font-medium ${r.delta === null ? 'text-gray-300' : r.delta > 0 ? 'text-red-500' : 'text-green-600'}`}>
                    {r.delta !== null ? `${r.delta > 0 ? '+' : ''}${r.delta}%` : '—'}
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
```

- [ ] **Step 2: Smoke test — verify monthly and category tables populate correctly**

- [ ] **Step 3: Commit**

```bash
git add src/pages/YearVsYear.jsx
git commit -m "feat: Year vs Year page with monthly comparison, category table, and forecast"
```

---

## Task 12: Transactions Page + FlagButton

**Files:**
- Create: `src/components/FlagButton.jsx`
- Modify: `src/pages/Transactions.jsx`

- [ ] **Step 1: Implement FlagButton**

Create `src/components/FlagButton.jsx`:

```jsx
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function FlagButton({ transactionId, existingFlags = [] }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [comment, setComment] = useState('')
  const [flags, setFlags] = useState(existingFlags)
  const [saving, setSaving] = useState(false)

  async function submitFlag() {
    if (!comment.trim()) return
    setSaving(true)
    const { data } = await supabase.from('flags').insert({
      transaction_id: transactionId,
      user_id: user.id,
      comment: comment.trim(),
    }).select().single()
    if (data) setFlags(f => [...f, { ...data, user_id: user.id }])
    setComment('')
    setSaving(false)
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`p-1.5 rounded hover:bg-gray-100 transition-colors ${flags.length > 0 ? 'text-amber-500' : 'text-gray-300 hover:text-gray-500'}`}
        title={flags.length > 0 ? `${flags.length} flag(s)` : 'Flag transaction'}
      >
        ⚑
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-10 w-72 bg-white rounded-xl shadow-lg border border-gray-200 p-4">
          {flags.length > 0 && (
            <div className="mb-3 space-y-2">
              {flags.map(f => (
                <div key={f.id} className="text-xs bg-amber-50 border border-amber-100 rounded p-2 text-gray-700">
                  {f.comment}
                </div>
              ))}
            </div>
          )}
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Add a comment…"
            rows={2}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
          />
          <div className="flex gap-2">
            <button onClick={() => setOpen(false)} className="flex-1 border border-gray-200 rounded-lg py-1.5 text-xs">Cancel</button>
            <button onClick={submitFlag} disabled={saving} className="flex-1 bg-blue-600 text-white rounded-lg py-1.5 text-xs disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Implement Transactions page**

Replace `src/pages/Transactions.jsx`:

```jsx
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import FlagButton from '../components/FlagButton'

function formatGBP(n) { return `£${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }

export default function Transactions() {
  const [transactions, setTransactions] = useState([])
  const [flags, setFlags] = useState({})   // { transactionId: [flag, ...] }
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ month: '', category: '', minAmount: '', maxAmount: '' })
  const [categories, setCategories] = useState([])
  const [months, setMonths] = useState([])

  useEffect(() => {
    async function load() {
      const { data: tx } = await supabase
        .from('transactions')
        .select('id, date, description, amount, category')
        .order('date', { ascending: false })

      const { data: flagData } = await supabase
        .from('flags')
        .select('id, transaction_id, comment, created_at')

      const flagMap = {}
      flagData?.forEach(f => {
        if (!flagMap[f.transaction_id]) flagMap[f.transaction_id] = []
        flagMap[f.transaction_id].push(f)
      })

      setTransactions(tx || [])
      setFlags(flagMap)
      setCategories([...new Set(tx?.map(t => t.category))].sort())
      setMonths([...new Set(tx?.map(t => t.date.slice(0,7)))].sort().reverse())
      setLoading(false)
    }
    load()
  }, [])

  const filtered = transactions.filter(tx => {
    if (filters.month && !tx.date.startsWith(filters.month)) return false
    if (filters.category && tx.category !== filters.category) return false
    if (filters.minAmount !== '' && Number(tx.amount) < filters.minAmount) return false
    if (filters.maxAmount !== '' && Number(tx.amount) > filters.maxAmount) return false
    return true
  })

  if (loading) return <div className="text-gray-400 py-8">Loading…</div>

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-3">
        <select
          value={filters.month}
          onChange={e => setFilters(f => ({ ...f, month: e.target.value }))}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All months</option>
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select
          value={filters.category}
          onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <input
            type="number"
            placeholder="Min £"
            onChange={e => setFilters(f => ({ ...f, minAmount: e.target.value ? Number(e.target.value) : '' }))}
            className="w-20 border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="number"
            placeholder="Max £"
            onChange={e => setFilters(f => ({ ...f, maxAmount: e.target.value ? Number(e.target.value) : '' }))}
            className="w-20 border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <span className="text-sm text-gray-400 self-center">{filtered.length} transactions</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Date</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Description</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Category</th>
                <th className="text-right px-5 py-3 text-gray-500 font-medium">Amount</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(tx => (
                <tr key={tx.id} className={flags[tx.id]?.length ? 'bg-amber-50/30' : ''}>
                  <td className="px-5 py-3 text-gray-500 whitespace-nowrap">{tx.date}</td>
                  <td className="px-5 py-3 text-gray-900">{tx.description}</td>
                  <td className="px-5 py-3 text-gray-500">{tx.category}</td>
                  <td className="px-5 py-3 text-right text-gray-900 font-medium">{formatGBP(tx.amount)}</td>
                  <td className="px-5 py-3 text-right">
                    <FlagButton transactionId={tx.id} existingFlags={flags[tx.id] || []} />
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
```

- [ ] **Step 3: Smoke test flagging**

Sign in as the member account (wife). Navigate to Transactions. Click a flag button, add a comment, save. Sign in as admin — verify the flag appears.

- [ ] **Step 4: Commit**

```bash
git add src/components/FlagButton.jsx src/pages/Transactions.jsx
git commit -m "feat: Transactions page with filtering and FlagButton"
```

---

## Task 13: Deployment

**Files:**
- Modify: `netlify.toml` (if needed)

- [ ] **Step 1: Create Netlify site**

```bash
npx netlify login
npx netlify init
```

Choose "Create & configure a new site". Select your Netlify team. Accept defaults for build settings (already in `netlify.toml`).

- [ ] **Step 2: Set environment variables in Netlify**

Go to Netlify → Site settings → Environment variables. Add:

```
VITE_SUPABASE_URL         = https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY    = your-anon-key
SUPABASE_URL              = https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY = your-service-role-key
```

Note: `VITE_` prefix is needed for variables used by the browser build. `SUPABASE_URL` (no prefix) is for Netlify Functions.

- [ ] **Step 3: Deploy**

```bash
npx netlify deploy --prod
```

Expected: Build succeeds, site URL returned.

- [ ] **Step 4: Verify production**

Open the production URL. Sign in as admin. Upload a CSV. Verify data appears in all four tabs. Sign in as member (wife). Verify read access and flag functionality.

- [ ] **Step 5: Commit**

```bash
git add netlify.toml
git commit -m "chore: deployment configuration"
```

---

## Done

The dashboard is live. Remaining nice-to-haves for future iterations:

- Gmail sync (automated CSV import from email attachments)
- Pagination on the Transactions page (currently loads all rows — fine for household scale)
- Mobile-optimised layout polish
- Budget targets per category
- Supabase migration to the LeedsParkingApp (separate project decision)
