-- RPC: monthly totals for trend chart (bypasses 1000-row default limit)
CREATE OR REPLACE FUNCTION get_monthly_totals()
RETURNS TABLE (period text, total numeric)
LANGUAGE sql STABLE
SECURITY DEFINER
AS $$
  SELECT
    to_char(date, 'YYYY-MM') AS period,
    SUM(amount)::numeric      AS total
  FROM transactions
  GROUP BY 1
  ORDER BY 1;
$$;

-- RPC: distinct categories for re-assignment dropdown
CREATE OR REPLACE FUNCTION get_distinct_categories()
RETURNS TABLE (category text)
LANGUAGE sql STABLE
SECURITY DEFINER
AS $$
  SELECT DISTINCT category FROM transactions ORDER BY 1;
$$;

-- RLS: allow authenticated users to update category on any transaction
-- (Supabase does not support column-level RLS; the app only sends { category } in the payload)
CREATE POLICY "authenticated_update_category"
  ON transactions
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
