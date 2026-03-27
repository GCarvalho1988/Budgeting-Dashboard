-- =============================================================================
-- OPERATOR NOTE: This migration must be run manually in the Supabase SQL editor.
-- Copy and paste the entire contents of this file into the SQL editor and execute.
-- =============================================================================

-- supabase/migrations/003_income_categories.sql

-- 1. Income table
CREATE TABLE IF NOT EXISTS income (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  date        date        NOT NULL,
  description text        NOT NULL,
  amount      numeric     NOT NULL,
  category    text        NOT NULL,
  created_at  timestamptz DEFAULT now()
);

-- Unique constraint so ON CONFLICT DO NOTHING works in seeders
CREATE UNIQUE INDEX IF NOT EXISTS income_unique_row
  ON income(date, description, amount);

ALTER TABLE income ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_income"
  ON income FOR SELECT
  TO authenticated
  USING (true);

-- 2. RPC: monthly totals per category (replaces .limit(10000) raw queries)
-- Returns every period+category combination — no row limit.
-- NOTE: amounts in the transactions table are stored as positive values (sign-flipped at ingest).
CREATE OR REPLACE FUNCTION get_monthly_category_totals()
RETURNS TABLE(period text, category text, total numeric)
LANGUAGE sql STABLE
SECURITY DEFINER
AS $$
  SELECT
    to_char(date, 'YYYY-MM') AS period,
    category,
    SUM(amount)::numeric     AS total
  FROM transactions
  GROUP BY to_char(date, 'YYYY-MM'), category
  ORDER BY 1, 2;
$$;

-- 3. RPC: monthly income totals
CREATE OR REPLACE FUNCTION get_monthly_income()
RETURNS TABLE(period text, total numeric)
LANGUAGE sql STABLE
SECURITY DEFINER
AS $$
  SELECT
    to_char(date, 'YYYY-MM') AS period,
    SUM(amount)::numeric     AS total
  FROM income
  GROUP BY to_char(date, 'YYYY-MM')
  ORDER BY 1;
$$;

-- 4. Recategorise existing PLATINUM M/C transactions
-- These are 0% credit card repayments that were imported as 'Credit card payments'
-- Safe to re-run: rows already recategorised will be touched again but the value is idempotent.
UPDATE transactions
SET category = '0% Credit Card Repayment'
WHERE description ILIKE '%PLATINUM M/C%';
