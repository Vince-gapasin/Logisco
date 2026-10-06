-- ============================================================================
-- Close ForecastingMonthlyData to the browser keys
-- ============================================================================
-- The other forecasting tables have Row Level Security on; this one reported
-- relrowsecurity = false. Its generated type has every column nullable, which
-- is how a view comes through - and a view runs with its owner's rights, so it
-- reads past the RLS of the tables beneath it. Anyone holding the public anon
-- key (it ships in the browser bundle) could read it through the REST API.
--
-- Only the server reads it (services/forecasting/forecastSnapshotService.ts),
-- with the service-role key, which none of this affects.
--
-- Written to work whether it is a view or a table:
--   - the browser roles lose their grants, which closes either kind;
--   - a view is also switched to run with the caller's rights, so a grant
--     added back by accident still meets the RLS underneath;
--   - a table also gets RLS, like its neighbours.
-- ============================================================================

REVOKE ALL ON public."ForecastingMonthlyData" FROM anon, authenticated;

DO $$
DECLARE
  kind "char";
BEGIN
  SELECT c.relkind INTO kind
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'ForecastingMonthlyData';

  IF kind = 'v' THEN
    EXECUTE 'ALTER VIEW public."ForecastingMonthlyData" SET (security_invoker = true)';
  ELSIF kind = 'r' THEN
    EXECUTE 'ALTER TABLE public."ForecastingMonthlyData" ENABLE ROW LEVEL SECURITY';
  END IF;
  -- A materialized view ('m') takes neither; the REVOKE above is what closes it.
END $$;
