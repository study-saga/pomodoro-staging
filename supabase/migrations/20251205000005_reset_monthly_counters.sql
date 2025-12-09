-- Monthly counter reset cron job
-- Runs on the 1st of each month to reset timezone_change_count_month

CREATE OR REPLACE FUNCTION public.reset_monthly_timezone_counters()
RETURNS INTEGER AS $$
DECLARE
  v_reset_count INTEGER;
BEGIN
  UPDATE public.users
  SET timezone_change_count_month = 0
  WHERE timezone_change_count_month > 0;

  GET DIAGNOSTICS v_reset_count = ROW_COUNT;
  RETURN v_reset_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.reset_monthly_timezone_counters IS
  'Automated cron job that resets timezone change counters on the 1st of each month.
   Allows users to make up to 5 timezone changes per month.
   Runs at 00:00 UTC on day 1 of each month.';

-- Note: Set up cron job via Supabase Dashboard → Database → Cron Jobs
-- Schedule: 0 0 1 * * (1st of month at 00:00 UTC)
-- SQL: SELECT reset_monthly_timezone_counters();
