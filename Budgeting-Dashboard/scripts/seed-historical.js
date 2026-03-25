import * as XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

// --- Helper exported for testing ---

export function normaliseExcelRow(row) {
  const DATE_COL = 'DATE'
  const DESC_COL = 'DESCRIPTION'
  const AMT_COL = 'AMOUNT'
  const CAT_COL = 'CATEGORY'

  if (!row[DATE_COL] || !row[DESC_COL] || row[AMT_COL] === undefined || !row[CAT_COL]) {
    throw new Error(`Missing required column in row: ${JSON.stringify(row)}`)
  }

  const amount = parseFloat(String(row[AMT_COL]).replace(/[^0-9.-]/g, ''))
  if (isNaN(amount)) throw new Error(`Invalid amount in row: ${JSON.stringify(row)}`)
  if (amount > 0) throw new Error(`Skipping income/refund row: ${JSON.stringify(row)}`)
  if (amount === 0) throw new Error(`Skipping zero-amount row: ${JSON.stringify(row)}`)

  // Convert Excel serial date (days since 1899-12-30) to ISO string
  const serial = row[DATE_COL]
  const date = new Date((serial - 25569) * 86400 * 1000)
  const isoDate = date.toISOString().split('T')[0]

  return {
    date: isoDate,
    description: String(row[DESC_COL]).trim(),
    amount: Math.abs(amount),
    category: String(row[CAT_COL]).trim(),
  }
}

// --- Main seeder (run directly) ---

async function seed() {
  const EXCEL_PATH = process.argv[2]
  if (!EXCEL_PATH) {
    console.error('Usage: node scripts/seed-historical.js <path-to-excel.xlsx>')
    process.exit(1)
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const workbook = XLSX.read(readFileSync(EXCEL_PATH), { type: 'buffer' })

  let totalInserted = 0
  let totalSkipped = 0

  for (const sheetName of workbook.SheetNames) {
    console.log(`\nProcessing sheet: ${sheetName}`)
    const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName])

    // Normalise rows and group by YYYY-MM period
    const byPeriod = new Map()
    for (const raw of rawRows) {
      let row
      try {
        row = normaliseExcelRow(raw)
      } catch (e) {
        totalSkipped++
        continue
      }
      const period = row.date.slice(0, 7)
      if (!byPeriod.has(period)) byPeriod.set(period, [])
      byPeriod.get(period).push(row)
    }

    for (const [period, rows] of [...byPeriod.entries()].sort()) {
      // Check if already seeded
      const { data: existing } = await supabase.from('uploads').select('id').eq('period', period).single()
      if (existing) {
        console.log(`  ${period} — already seeded, skipping`)
        continue
      }

      // Create upload record
      const { data: upload, error: uploadErr } = await supabase
        .from('uploads')
        .insert({ filename: `seed-${period}.csv`, period, uploaded_by: null, row_count: rows.length })
        .select()
        .single()

      if (uploadErr) {
        console.error(`  ${period} — upload insert failed: ${uploadErr.message}`)
        continue
      }

      // Insert transactions
      const txRows = rows.map(r => ({ ...r, upload_id: upload.id }))
      const { error: txErr } = await supabase.from('transactions').insert(txRows)
      if (txErr) {
        console.error(`  ${period} — transactions insert failed: ${txErr.message}`)
        await supabase.from('uploads').delete().eq('id', upload.id)
        continue
      }

      console.log(`  ${period} — inserted ${rows.length} rows`)
      totalInserted += rows.length
    }
  }

  console.log(`\nDone. Inserted ${totalInserted} transactions, skipped ${totalSkipped} rows.`)
}

// Guard: only run when executed directly, not when imported by tests
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seed()
}
