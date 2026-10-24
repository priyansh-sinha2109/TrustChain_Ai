-- Version currency is extracted evidence; the case's default INR must not relabel it.
ALTER TABLE public.deal_versions ADD COLUMN currency text CHECK(currency ~ '^[A-Z]{3}$');
COMMENT ON COLUMN public.deal_versions.currency IS
  'Explicit document currency, NULL when missing/ambiguous; never inferred from case currency.';

-- Match the backend's policy: round each advance, then subtract, rather than rounding
-- the unrounded difference. Existing function signature and return columns are preserved.
CREATE OR REPLACE FUNCTION public.calculate_advance_exposure(
  p_baseline_total numeric,p_baseline_advance_pct numeric,
  p_final_total numeric,p_final_advance_pct numeric)
RETURNS TABLE(baseline_advance_amount numeric,final_advance_amount numeric,
  exposure_delta_amount numeric,is_exposure_increased boolean)
LANGUAGE sql IMMUTABLE AS $$
  WITH amounts AS (SELECT round(p_baseline_total*p_baseline_advance_pct/100,2) b,
                         round(p_final_total*p_final_advance_pct/100,2) f)
  SELECT b,f,f-b,f>b FROM amounts
$$;
