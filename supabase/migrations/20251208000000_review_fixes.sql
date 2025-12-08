-- Migration to address CodeRabbit review issues
-- Issues: 9, 10, 11, 12, 13, 14, 15

-- 1. Fix Weekends/Timezone Logic (Issues 9, 10, 11, 14)
-- Replace request_timezone_change with better validation
CREATE OR REPLACE FUNCTION public.request_timezone_change(
  p_user_id UUID,
  p_new_timezone TEXT,
  p_new_weekend_days INTEGER[]
)
RETURNS JSONB AS $$
DECLARE
  v_current_timezone TEXT;
  v_last_change TIMESTAMPTZ;
  v_last_change TIMESTAMPTZ;
  v_account_age_days INT;
  v_applies_at TIMESTAMPTZ;
  v_hours_until_applied INT;
  v_cooldown_end TIMESTAMPTZ;
BEGIN
  -- 1. Authorization
  IF auth.uid() IS NULL OR auth.uid()::uuid != (SELECT auth_user_id FROM public.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- 2. Input Validation (Timezone) - Use pg_timezone_names instead of regex
  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = p_new_timezone) THEN
    RAISE EXCEPTION 'Invalid timezone name: %', p_new_timezone;
  END IF;

  -- 3. Input Validation (Weekend Days) - Enforce unique 0-6 values
  -- Check for duplicates
  IF (SELECT COUNT(*) FROM unnest(p_new_weekend_days)) != (SELECT COUNT(DISTINCT x) FROM unnest(p_new_weekend_days) AS x) THEN
    RAISE EXCEPTION 'Weekend days must be unique';
  END IF;
  
  -- Check range (0-6)
  IF EXISTS (SELECT 1 FROM unnest(p_new_weekend_days) AS x WHERE x < 0 OR x > 6) THEN
    RAISE EXCEPTION 'Weekend days must be between 0 (Sunday) and 6 (Saturday)';
  END IF;

  -- 4. Get User State
  SELECT 
    timezone, 
    last_timezone_change_at, 
    EXTRACT(DAY FROM (NOW() - created_at))::INT
  INTO 
    v_current_timezone, 
    v_last_change, 
    v_account_age_days
  FROM public.users 
  WHERE id = p_user_id;

  -- 5. Calculate cooldown (Issue: Dropped monthly limit, but kept cooldown?)
  -- For now, we enforce 14-day cooldown for established accounts (>7 days)
  -- BUT we allow unlimited changes for new accounts (<7 days)
  IF v_account_age_days > 7 THEN
    IF v_last_change IS NOT NULL AND v_last_change > (NOW() - INTERVAL '14 days') THEN
       v_cooldown_end := v_last_change + INTERVAL '14 days';
       RETURN jsonb_build_object(
         'status', 'rejected',
         'message', 'Cooldown active. You can change timezone every 14 days.',
         'cooldownUntil', v_cooldown_end,
         'hoursRemaining', EXTRACT(EPOCH FROM (v_cooldown_end - NOW())) / 3600
       );
    END IF;
  END IF;

  -- 6. Apply logic: Effective next midnight UTC (to avoid gaming)
  -- Minimum 24 hours delay for changes
  v_applies_at := (CURRENT_DATE + INTERVAL '1 day' + INTERVAL '1 day')::timestamptz AT TIME ZONE 'UTC';
  v_hours_until_applied := EXTRACT(EPOCH FROM (v_applies_at - NOW())) / 3600;

  -- 7. Update User (Pending Change)
  UPDATE public.users 
  SET 
    pending_timezone = p_new_timezone,
    pending_weekend_days = p_new_weekend_days,
    pending_timezone_applies_at = v_applies_at,
    -- We update the last change timestamp NOW to start the cooldown immediately
    last_timezone_change_at = NOW()
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'status', 'pending',
    'message', 'Timezone change scheduled',
    'newTimezone', p_new_timezone,
    'newWeekendDays', p_new_weekend_days,
    'appliesAt', v_applies_at,
    'hoursUntilApplied', v_hours_until_applied,
    'cooldownUntil', NOW() + INTERVAL '14 days'
  );

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Cleanup Monthly Limit Cron/Function (Issues 12, 13)
-- Drop the cron job if strictly necessary, but typically we just drop the function if it's unused.
-- Note: pg_cron usage typically requires superuser or specific extension handling. 
-- We'll accept that we might not be able to un-schedule strictly in migrations without extensions.
-- But we can definitely drop the function.
DROP FUNCTION IF EXISTS reset_monthly_timezone_counters() CASCADE;


-- 3. Fix Atomic Save Pomodoro (Issue 15)
-- Update function to USE p_critical_success
CREATE OR REPLACE FUNCTION public.atomic_save_completed_pomodoro(
  p_user_id UUID,
  p_duration_minutes INTEGER,
  p_xp_earned INTEGER,
  p_critical_success BOOLEAN DEFAULT false,
  p_task_name TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_pomodoro_id UUID;
  v_discord_id TEXT;
BEGIN
  -- Session-auth verification
  IF auth.uid() IS NULL OR auth.uid()::uuid != (SELECT auth_user_id FROM public.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_duration_minutes <= 0 THEN RAISE EXCEPTION 'Invalid duration'; END IF;
  IF p_xp_earned < 0 THEN RAISE EXCEPTION 'Invalid XP'; END IF;

  SELECT discord_id INTO v_discord_id FROM public.users WHERE id = p_user_id;

  INSERT INTO public.completed_pomodoros (
    user_id,
    discord_id,
    duration_minutes,
    xp_earned,
    critical_success, -- ADDED THIS
    task_name,
    notes,
    completed_at
  ) VALUES (
    p_user_id,
    v_discord_id,
    p_duration_minutes,
    p_xp_earned,
    p_critical_success, -- USED HERE
    p_task_name,
    p_notes,
    NOW()
  )
  RETURNING id INTO v_pomodoro_id;

  UPDATE public.users
  SET
    total_pomodoros = total_pomodoros + 1,
    total_study_minutes = total_study_minutes + p_duration_minutes,
    xp = xp + p_xp_earned,
    updated_at = NOW()
  WHERE id = p_user_id;

  RETURN v_pomodoro_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
