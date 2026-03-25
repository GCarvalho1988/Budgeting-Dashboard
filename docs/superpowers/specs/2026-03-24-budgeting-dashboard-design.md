# Budgeting Dashboard — Design Spec

**Date:** 2026-03-24
**Project:** Budgeting-Dashboard
**Status:** Approved for implementation

---

## Overview

A Netlify-hosted React dashboard backed by Supabase, where the user uploads monthly LifeStages CSVs, views household spend by category with year-on-year comparisons and forecasts, and their wife can log in independently to flag transactions.

---

## Context & Problem

The household manages finances through joint accounts. Transactions are exported monthly from the LifeStages app as CSV files. Currently, all transaction tagging is done by one person (the husband), meaning the wife's purchases — particularly Vinted and Amazon — are frequently untagged or miscategorised. The wife needs a way to review and flag her own transactions without requiring full admin access.

Financial structure:
- Salaries are transferred to joint accounts net of £200 pocket money each
- All tracked transactions are joint account purchases only
- Personal pocket money spend is out of scope

---

## Architecture

```
Browser (React + Vite SPA)
    ↕ Supabase JS client / Netlify Functions
Netlify (CDN + Functions)
    ↕
Supabase
  ├── Auth       — two user accounts, role-based (admin / member)
  ├── Postgres   — transactions, uploads, flags
  └── Storage    — raw uploaded CSV files (audit trail)
```

- **Frontend:** React + Vite, hosted on Netlify CDN
- **API layer:** Netlify Functions for server-side logic (CSV parsing validation, forecast calculations)
- **Database:** Supabase Postgres — efficient SQL queries for aggregations, YoY comparisons, and forecasting
- **Auth:** Supabase Auth with two roles
- **File storage:** Raw CSVs stored in Supabase Storage for audit trail; parsed data lives in Postgres

---

## Data Model

### `profiles`
| Column | Type | Notes |
|---|---|---|
| id | uuid (FK → auth.users) | |
| email | text | |
| role | enum (`admin`, `member`) | admin = husband, member = wife |

### `uploads`
| Column | Type | Notes |
|---|---|---|
| id | uuid | |
| filename | text | Original CSV filename |
| period | text | e.g. `2025-10` (YYYY-MM) |
| uploaded_by | uuid (FK → profiles) | |
| uploaded_at | timestamptz | |
| row_count | integer | Parsed transaction count |

### `transactions`
| Column | Type | Notes |
|---|---|---|
| id | uuid | |
| date | date | |
| description | text | |
| amount | numeric | Positive = spend |
| category | text | From LifeStages tags |
| upload_id | uuid (FK → uploads) | |

### `flags`
| Column | Type | Notes |
|---|---|---|
| id | uuid | |
| transaction_id | uuid (FK → transactions) | |
| user_id | uuid (FK → profiles) | |
| comment | text | e.g. "This was mine — Vinted purchase" |
| created_at | timestamptz | |

**Notes:**
- Categories are derived dynamically from the `transactions` table — no separate categories table
- Flags are append-only; one transaction can have multiple flags over time
- The `uploads` table acts as a duplicate guard — importing a period that already exists triggers a warning

---

## Roles & Access

| Action | Admin (husband) | Member (wife) |
|---|---|---|
| View all dashboard views | ✓ | ✓ |
| Upload CSV | ✓ | ✗ |
| Flag / comment on transactions | ✓ | ✓ |
| View flags left by either user | ✓ | ✓ |

---

## Dashboard Layout

Top navigation bar with tabs. Stat cards and charts fill the page beneath.

### Tab 1 — Overview
- KPI cards: total spend this month, vs same month last year (%), top category, flagged transaction count
- Bar chart: spend by category this month
- Line chart: monthly spend trend over last 12 months

### Tab 2 — Categories
- Category selector
- Month-by-month spend for selected category
- YoY comparison for that category
- Transaction list within the selected category

### Tab 3 — Year vs Year
- Side-by-side monthly totals: current year vs previous year
- Per-category table: both years + % change
- Annual total with year-end forecast (linear extrapolation from months completed so far)

### Tab 4 — Transactions
- Full transaction list, filterable by month, category, and amount range
- Flag button on each row — opens a comment input
- Flags displayed inline with commenter name and timestamp
- Admin only: CSV upload button in the top nav bar

---

## Upload & Ingestion Flow

1. Admin selects or drag-and-drops a CSV file via the upload button in the top nav
2. App parses the CSV client-side and shows a preview:
   - Row count, date range detected, categories found
   - Any malformed rows flagged (skipped with warning, not silently dropped)
3. Duplicate check: if the detected period already exists in `uploads`, a warning is shown. The admin can choose to **overwrite** (delete all existing transactions for that period and replace) or **cancel**. Appending to an existing period is not supported.
4. On confirm:
   - Raw CSV written to Supabase Storage
   - Parsed transactions inserted into Postgres via a Netlify Function
5. Dashboard refreshes automatically

**Note:** The LifeStages CSV column mapping must be confirmed against a sample file as the **first implementation task**, before the parser is written. Do not assume column names.

---

## Historical Data

The user has existing data covering **October 2024 to February 2026** across two Excel tabs (one spreadsheet, two sheets). This requires a **bespoke one-off conversion script** to extract and normalise the data into the CSV format expected by the standard upload flow — it is a distinct setup task and not handled by the regular CSV uploader.

---

## Error Handling

- Malformed CSV rows: surfaced in the upload preview, not silently ignored
- Duplicate period upload: warning prompt before overwrite/append
- Auth errors: redirect to login with clear messaging; sessions expire gracefully
- Supabase unavailable: clear offline/error state rather than blank screen

---

## Testing

- **Unit tests:** CSV parser logic (critical path — bad parses corrupt data)
- **Integration tests:** Upload flow end-to-end (CSV → Postgres)
- **Manual smoke test checklist:** All dashboard views verified before each deployment

---

## Out of Scope (for now)

- Gmail sync / automated CSV ingestion (manual upload covers the need)
- Personal account transaction tracking (pocket money spend is outside joint accounts)
- Transfer matching between personal and joint accounts
- Mobile-native app (responsive web is sufficient)
- Wife re-categorising transactions (flagging with comments covers the need)
