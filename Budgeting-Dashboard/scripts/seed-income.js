// scripts/seed-income.js
import * as XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

const TRANSIENT_CATEGORIES = new Set([
  'Credit card payments',
  'Dulce Personal Purchases',
  'Dulce Work Expenses',
  'Gui Personal Purchases',
  'Gui Work Expensss',
  'Transfers',
])

// Exported for testing
export function normaliseIncomeRow(row) {
  const DATE_COL = 'DATE'
  const DESC_COL = 'DESCRIPTION'
  const AMT_COL = 'AMOUNT'
  const CAT_COL = 'CATEGORY'

  if (!row[DATE_COL] || !row[DESC_COL] || row[AMT_COL] === undefined || !row[CAT_COL]) {
    throw new Error(`Missing required column: ${JSON.stringify(row)}`)
  }

  const amount = parseFloat(String(row[AMT_COL]).replace(/[^0-9.-]/g, ''))
  if (isNaN(amount)) throw new Error(`Invalid amount: ${JSON.stringify(row)}`)
  if (amount <= 0) throw new Error(`Not an income row (amount <= 0): ${JSON.stringify(row)}`)

  const category = String(row[CAT_COL]).trim()
  if (TRANSIENT_CATEGORIES.has(category)) {
    throw new Error(`Skipping transient category '${category}': ${JSON.stringify(row)}`)
  }

  // Convert Excel serial date (days since 1899-12-30) to ISO string
  const date = new Date((row[DATE_COL] - 25569) * 86400 * 1000)
  const isoDate = date.toISOString().split('T')[0]

  return {
    date: isoDate,
    description: String(row[DESC_COL]).trim(),
    amount,
    category,
  }
}

async function seed() {
  const EXCEL_PATH = process.argv[2]
  if (!EXCEL_PATH) {
    console.error('Usage: node scripts/seed-income.js <path-to-excel.xlsx>')
    process.exit(1)
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const workbook = XLSX.read(readFileSync(EXCEL_PATH), { type: 'buffer' })

  let totalProcessed = 0
  let totalSkipped = 0

  for (const sheetName of workbook.SheetNames) {
    console.log(`\nProcessing sheet: ${sheetName}`)
    const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName])

    const incomeRows = []
    for (const raw of rawRows) {
      try {
        incomeRows.push(normaliseIncomeRow(raw))
      } catch {
        totalSkipped++
      }
    }

    if (incomeRows.length === 0) {
      console.log(`  No income rows found`)
      continue
    }

    const { error } = await supabase
      .from('income')
      .upsert(incomeRows, { onConflict: 'date,description,amount', ignoreDuplicates: true })

    if (error) {
      console.error(`  Insert failed: ${error.message}`)
    } else {
      console.log(`  Processed ${incomeRows.length} income rows`)
      totalProcessed += incomeRows.length
    }
  }

  console.log(`\nDone. Processed ${totalProcessed} income rows, skipped ${totalSkipped} non-income rows.`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seed()
}
