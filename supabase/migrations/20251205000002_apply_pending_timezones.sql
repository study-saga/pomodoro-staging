-- Cron job to apply pending timezone changes at scheduled times
-- Runs every 5 minutes to check for pending changes that should be applied

CREATE OR REPLACE FUNCTION public.apply_pending_timezone_changes()
RETURNS INTEGER AS $$
DECLARE
  v_applied_count INTEGER := 0;
  v_record RECORD;
BEGIN
  FOR v_record IN
    SELECT id, pending_timezone
    FROM public.users
    WHERE pending_timezone IS NOT NULL
      AND pending_timezone_applies_at <= NOW()
  LOOP
    -- Apply the pending timezone change
    UPDATE public.users
    SET timezone = v_record.pending_timezone,
        pending_timezone = NULL,
        pending_timezone_applies_at = NULL,
        timezone_updated_at = NOW()
    WHERE id = v_record.id;

    v_applied_count := v_applied_count + 1;
  END LOOP;

  RETURN v_applied_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.apply_pending_timezone_changes IS
  'Automated cron job that applies pending timezone changes when pending_timezone_applies_at <= NOW().
   Runs every 5 minutes. No manual intervention needed.';

-- Note: Set up cron job via Supabase Dashboard → Database → Cron Jobs
-- Schedule: */5 * * * * (every 5 minutes)
-- SQL: SELECT apply_pending_timezone_changes();
