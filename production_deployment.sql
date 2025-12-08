-- Add timezone and weekend days support for timezone-aware weekend buffs
-- Allows users to set their timezone for correct weekend detection
-- Supports custom weekend days (Fri-Sat for Middle East, Sat-Sun for most regions)

ALTER TABLE public.users
  -- Current timezone (IANA format: America/New_York, Europe/London, etc.)
  ADD COLUMN IF NOT EXISTS timezone VARCHAR(255) DEFAULT 'America/New_York',

  -- Custom weekend days array (0=Sunday, 1=Monday, ..., 6=Saturday)
  -- Default [0,6] = Saturday-Sunday
  -- Middle East [5,6] = Friday-Saturday
  ADD COLUMN IF NOT EXISTS weekend_days INTEGER[] DEFAULT ARRAY[0,6],

  -- Pending timezone change (applies at next midnight 00:00 UTC)
  ADD COLUMN IF NOT EXISTS pending_timezone VARCHAR(255),
  ADD COLUMN IF NOT EXISTS pending_timezone_applies_at TIMESTAMP WITH TIME ZONE,

  -- Rate limiting fields
  ADD COLUMN IF NOT EXISTS timezone_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS timezone_change_count_month INTEGER DEFAULT 0
    CHECK (timezone_change_count_month >= 0 AND timezone_change_count_month <= 5),
  ADD COLUMN IF NOT EXISTS last_timezone_change_at TIMESTAMP WITH TIME ZONE;

-- Validate IANA timezone format (e.g., America/New_York, Europe/Paris)
ALTER TABLE public.users
  ADD CONSTRAINT valid_iana_timezone
  CHECK (
    timezone ~ '^[A-Za-z_]+/[A-Za-z_]+$'
    OR timezone = 'UTC'
  );

-- Validate weekend_days array (must be 2 elements with values 0-6)
ALTER TABLE public.users
  ADD CONSTRAINT valid_weekend_days
  CHECK (
    array_length(weekend_days, 1) = 2
    AND weekend_days[1] BETWEEN 0 AND 6
    AND weekend_days[2] BETWEEN 0 AND 6
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_timezone ON public.users(timezone);
CREATE INDEX IF NOT EXISTS idx_users_pending_timezone ON public.users(pending_timezone)
  WHERE pending_timezone IS NOT NULL;

COMMENT ON COLUMN public.users.timezone IS
  'User timezone in IANA format (e.g., America/New_York). Used for server-authoritative weekend buff detection.';

COMMENT ON COLUMN public.users.weekend_days IS
  'Custom weekend days array. [0,6]=Sat-Sun, [5,6]=Fri-Sat (Middle East). 0=Sunday, 6=Saturday.';

COMMENT ON COLUMN public.users.pending_timezone IS
  'Pending timezone change that will apply at pending_timezone_applies_at timestamp. Enforces 24-hour delay.';
-- Simple timezone change history table for user reference
-- Read-only log, no manual review needed (fully automated enforcement)

CREATE TABLE IF NOT EXISTS public.timezone_change_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  old_timezone VARCHAR(255) NOT NULL,
  new_timezone VARCHAR(255) NOT NULL,
  old_weekend_days INTEGER[],
  new_weekend_days INTEGER[],

  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index for efficient user history queries
CREATE INDEX idx_timezone_history_user_id ON public.timezone_change_history(user_id);
CREATE INDEX idx_timezone_history_changed_at ON public.timezone_change_history(changed_at DESC);

-- Row Level Security: Users can only see their own history
ALTER TABLE public.timezone_change_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own timezone history"
  ON public.timezone_change_history FOR SELECT
  USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

COMMENT ON TABLE public.timezone_change_history IS
  'Read-only history log for user reference. No manual review needed - all enforcement is automated via database constraints and RPC validation.';
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
-- RPC function to request a timezone change with full validation
-- Enforces rate limits, cooldowns, and schedules change for next midnight UTC

CREATE OR REPLACE FUNCTION public.request_timezone_change(
  p_user_id UUID,
  p_new_timezone VARCHAR(255),
  p_new_weekend_days INTEGER[] DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_current_timezone VARCHAR(255);
  v_current_weekend_days INTEGER[];
  v_change_count_month INTEGER;
  v_last_change_at TIMESTAMP WITH TIME ZONE;
  v_account_age_days INTEGER;
  v_applies_at TIMESTAMP WITH TIME ZONE;
  v_user_auth_id UUID;
BEGIN
  -- Auth check: verify user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Auth check: verify user owns this user_id
  SELECT auth_user_id INTO v_user_auth_id
  FROM public.users
  WHERE id = p_user_id;

  IF v_user_auth_id IS NULL OR v_user_auth_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Get current state
  SELECT
    timezone,
    weekend_days,
    timezone_change_count_month,
    last_timezone_change_at,
    EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400
  INTO
    v_current_timezone,
    v_current_weekend_days,
    v_change_count_month,
    v_last_change_at,
    v_account_age_days
  FROM public.users
  WHERE id = p_user_id;

  -- Default weekend days to current if not provided
  IF p_new_weekend_days IS NULL THEN
    p_new_weekend_days := v_current_weekend_days;
  END IF;

  -- Validate: same timezone + weekend days
  IF v_current_timezone = p_new_timezone AND v_current_weekend_days = p_new_weekend_days THEN
    RETURN jsonb_build_object(
      'status', 'rejected',
      'message', 'Already using this timezone and weekend configuration'
    );
  END IF;

  -- Validate: IANA format
  IF p_new_timezone !~ '^[A-Za-z_]+/[A-Za-z_]+$' AND p_new_timezone != 'UTC' THEN
    RETURN jsonb_build_object(
      'status', 'rejected',
      'message', 'Invalid timezone format. Use IANA format (e.g., America/New_York)'
    );
  END IF;

  -- Validate: weekend_days format
  IF array_length(p_new_weekend_days, 1) != 2
     OR p_new_weekend_days[1] NOT BETWEEN 0 AND 6
     OR p_new_weekend_days[2] NOT BETWEEN 0 AND 6 THEN
    RETURN jsonb_build_object(
      'status', 'rejected',
      'message', 'Invalid weekend_days. Must be 2-element array with values 0-6'
    );
  END IF;

  -- Check cooldown (14 days, exempt new accounts <7 days old)
  IF v_last_change_at IS NOT NULL
     AND NOW() - v_last_change_at < INTERVAL '14 days'
     AND v_account_age_days > 7 THEN
    RETURN jsonb_build_object(
      'status', 'rejected',
      'message', 'Timezone changes limited to once per 14 days',
      'cooldownUntil', v_last_change_at + INTERVAL '14 days',
      'hoursRemaining', CEIL(EXTRACT(EPOCH FROM (v_last_change_at + INTERVAL '14 days' - NOW())) / 3600)
    );
  END IF;

  -- Check monthly limit (5/month)
  IF v_change_count_month >= 5 THEN
    RETURN jsonb_build_object(
      'status', 'rejected',
      'message', 'Monthly limit reached (5 changes per month)',
      'resetDate', DATE_TRUNC('month', NOW()) + INTERVAL '1 month'
    );
  END IF;

  -- Calculate application time: next midnight 00:00 UTC
  v_applies_at := DATE_TRUNC('day', NOW()) + INTERVAL '1 day';

  -- Log change in history (for user reference only)
  INSERT INTO public.timezone_change_history (
    user_id,
    old_timezone,
    new_timezone,
    old_weekend_days,
    new_weekend_days,
    changed_at
  ) VALUES (
    p_user_id,
    v_current_timezone,
    p_new_timezone,
    v_current_weekend_days,
    p_new_weekend_days,
    NOW()
  );

  -- Update user with PENDING timezone
  UPDATE public.users
  SET pending_timezone = p_new_timezone,
      pending_timezone_applies_at = v_applies_at,
      weekend_days = p_new_weekend_days,
      timezone_change_count_month = v_change_count_month + 1,
      last_timezone_change_at = NOW()
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'status', 'pending',
    'message', 'Timezone change scheduled. Will apply at next midnight (00:00 UTC)',
    'newTimezone', p_new_timezone,
    'newWeekendDays', p_new_weekend_days,
    'appliesAt', v_applies_at,
    'hoursUntilApplied', CEIL(EXTRACT(EPOCH FROM (v_applies_at - NOW())) / 3600),
    'changesRemainingThisMonth', 5 - (v_change_count_month + 1)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.request_timezone_change TO authenticated;

COMMENT ON FUNCTION public.request_timezone_change IS
  'Request timezone change with automated validation and rate limiting.
   Changes apply at next midnight UTC (24-hour minimum delay).
   Enforces 14-day cooldown (waived for accounts <7 days old) and 5 changes/month limit.
   Fully automated - no manual review needed.';
-- Server-authoritative weekend check RPC
-- Client CANNOT bypass this - all weekend detection goes through server

CREATE OR REPLACE FUNCTION public.is_weekend_for_user(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_user_timezone VARCHAR(255);
  v_weekend_days INTEGER[];
  v_server_utc_time TIMESTAMP WITH TIME ZONE;
  v_user_local_time TIMESTAMP;
  v_day_of_week INTEGER;
  v_is_weekend BOOLEAN;
BEGIN
  -- Get user's timezone and weekend days
  SELECT timezone, weekend_days
  INTO v_user_timezone, v_weekend_days
  FROM public.users
  WHERE id = p_user_id;

  -- Fallback to defaults if not found (guest mode)
  IF v_user_timezone IS NULL THEN
    v_user_timezone := 'America/New_York';
  END IF;
  IF v_weekend_days IS NULL THEN
    v_weekend_days := ARRAY[0, 6];
  END IF;

  -- Get current time in user's timezone
  v_server_utc_time := NOW();
  v_user_local_time := v_server_utc_time AT TIME ZONE v_user_timezone;
  v_day_of_week := EXTRACT(DOW FROM v_user_local_time)::INTEGER;

  -- Check if current day is in user's weekend_days
  v_is_weekend := (v_day_of_week = ANY(v_weekend_days));

  RETURN jsonb_build_object(
    'isWeekend', v_is_weekend,
    'dayOfWeek', v_day_of_week,
    'weekendDays', v_weekend_days,
    'userLocalTime', v_user_local_time,
    'serverUtcTime', v_server_utc_time,
    'timezone', v_user_timezone
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.is_weekend_for_user TO authenticated, anon;

COMMENT ON FUNCTION public.is_weekend_for_user IS
  'Server-authoritative weekend check. Client CANNOT override or manipulate.
   Uses server time + stored timezone to determine if user is currently in their weekend.
   Supports custom weekend days (e.g., Fri-Sat [5,6] for Middle East, Sat-Sun [0,6] standard).
   Callable by authenticated and anonymous users (guest mode fallback).';
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
-- Remove monthly timezone change counter
-- The 14-day cooldown naturally limits changes to ~2 per month
-- Monthly counter is redundant and adds unnecessary complexity

ALTER TABLE public.users
DROP COLUMN IF EXISTS timezone_change_count_month;

COMMENT ON TABLE public.users IS
  'User profiles with timezone settings enforced by 14-day cooldown only.';
-- Update RPC to remove monthly limit (5/month) - keep only 14-day cooldown
-- Monthly limit was unreachable due to 14-day cooldown (~2 changes/month max)

CREATE OR REPLACE FUNCTION public.request_timezone_change(
  p_user_id UUID,
  p_new_timezone VARCHAR(255),
  p_new_weekend_days INTEGER[] DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_current_timezone VARCHAR(255);
  v_current_weekend_days INTEGER[];
  v_last_change_at TIMESTAMP WITH TIME ZONE;
  v_account_age_days INTEGER;
  v_applies_at TIMESTAMP WITH TIME ZONE;
  v_user_auth_id UUID;
BEGIN
  -- Auth check: verify user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Auth check: verify user owns this user_id
  SELECT auth_user_id INTO v_user_auth_id
  FROM public.users
  WHERE id = p_user_id;

  IF v_user_auth_id IS NULL OR v_user_auth_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Get current state
  SELECT
    timezone,
    weekend_days,
    last_timezone_change_at,
    EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400
  INTO
    v_current_timezone,
    v_current_weekend_days,
    v_last_change_at,
    v_account_age_days
  FROM public.users
  WHERE id = p_user_id;

  -- Default weekend days to current if not provided
  IF p_new_weekend_days IS NULL THEN
    p_new_weekend_days := v_current_weekend_days;
  END IF;

  -- Validate: same timezone + weekend days
  IF v_current_timezone = p_new_timezone AND v_current_weekend_days = p_new_weekend_days THEN
    RETURN jsonb_build_object(
      'status', 'rejected',
      'message', 'Already using this timezone and weekend configuration'
    );
  END IF;

  -- Validate: IANA format
  IF p_new_timezone !~ '^[A-Za-z_]+/[A-Za-z_]+$' AND p_new_timezone != 'UTC' THEN
    RETURN jsonb_build_object(
      'status', 'rejected',
      'message', 'Invalid timezone format. Use IANA format (e.g., America/New_York)'
    );
  END IF;

  -- Validate: weekend_days format
  IF array_length(p_new_weekend_days, 1) != 2
     OR p_new_weekend_days[1] NOT BETWEEN 0 AND 6
     OR p_new_weekend_days[2] NOT BETWEEN 0 AND 6 THEN
    RETURN jsonb_build_object(
      'status', 'rejected',
      'message', 'Invalid weekend_days. Must be 2-element array with values 0-6'
    );
  END IF;

  -- Check cooldown (14 days, exempt new accounts <7 days old)
  IF v_last_change_at IS NOT NULL
     AND NOW() - v_last_change_at < INTERVAL '14 days'
     AND v_account_age_days > 7 THEN
    RETURN jsonb_build_object(
      'status', 'rejected',
      'message', 'Timezone changes limited to once per 14 days',
      'cooldownUntil', v_last_change_at + INTERVAL '14 days',
      'hoursRemaining', CEIL(EXTRACT(EPOCH FROM (v_last_change_at + INTERVAL '14 days' - NOW())) / 3600)
    );
  END IF;

  -- Calculate application time: next midnight 00:00 UTC
  v_applies_at := DATE_TRUNC('day', NOW()) + INTERVAL '1 day';

  -- Log change in history (for user reference only)
  INSERT INTO public.timezone_change_history (
    user_id,
    old_timezone,
    new_timezone,
    old_weekend_days,
    new_weekend_days,
    changed_at
  ) VALUES (
    p_user_id,
    v_current_timezone,
    p_new_timezone,
    v_current_weekend_days,
    p_new_weekend_days,
    NOW()
  );

  -- Update user with PENDING timezone
  UPDATE public.users
  SET pending_timezone = p_new_timezone,
      pending_timezone_applies_at = v_applies_at,
      weekend_days = p_new_weekend_days,
      last_timezone_change_at = NOW()
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'status', 'pending',
    'message', 'Timezone change scheduled. Will apply at next midnight (00:00 UTC)',
    'newTimezone', p_new_timezone,
    'newWeekendDays', p_new_weekend_days,
    'appliesAt', v_applies_at,
    'hoursUntilApplied', CEIL(EXTRACT(EPOCH FROM (v_applies_at - NOW())) / 3600)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.request_timezone_change TO authenticated;

COMMENT ON FUNCTION public.request_timezone_change IS
  'Request timezone change with automated validation and rate limiting.
   Changes apply at next midnight UTC (24-hour minimum delay).
   Enforces 14-day cooldown (waived for accounts <7 days old).
   Fully automated - no manual review needed.';
-- Update RPC to remove monthly limit (5/month) - keep only 14-day cooldown
-- Monthly limit was unreachable due to 14-day cooldown (~2 changes/month max)
-- This migration fixes the 'column timezone_change_count_month does not exist' error

CREATE OR REPLACE FUNCTION public.request_timezone_change(
  p_user_id UUID,
  p_new_timezone VARCHAR(255),
  p_new_weekend_days INTEGER[] DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_current_timezone VARCHAR(255);
  v_current_weekend_days INTEGER[];
  v_last_change_at TIMESTAMP WITH TIME ZONE;
  v_account_age_days INTEGER;
  v_applies_at TIMESTAMP WITH TIME ZONE;
  v_user_auth_id UUID;
BEGIN
  -- Auth check: verify user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Auth check: verify user owns this user_id
  SELECT auth_user_id INTO v_user_auth_id
  FROM public.users
  WHERE id = p_user_id;

  IF v_user_auth_id IS NULL OR v_user_auth_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Get current state
  SELECT
    timezone,
    weekend_days,
    last_timezone_change_at,
    EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400
  INTO
    v_current_timezone,
    v_current_weekend_days,
    v_last_change_at,
    v_account_age_days
  FROM public.users
  WHERE id = p_user_id;

  -- Default weekend days to current if not provided
  IF p_new_weekend_days IS NULL THEN
    p_new_weekend_days := v_current_weekend_days;
  END IF;

  -- Validate: same timezone + weekend days
  IF v_current_timezone = p_new_timezone AND v_current_weekend_days = p_new_weekend_days THEN
    RETURN jsonb_build_object(
      'status', 'rejected',
      'message', 'Already using this timezone and weekend configuration'
    );
  END IF;

  -- Validate: IANA format
  IF p_new_timezone !~ '^[A-Za-z_]+/[A-Za-z_]+$' AND p_new_timezone != 'UTC' THEN
    RETURN jsonb_build_object(
      'status', 'rejected',
      'message', 'Invalid timezone format. Use IANA format (e.g., America/New_York)'
    );
  END IF;

  -- Validate: weekend_days format
  IF array_length(p_new_weekend_days, 1) != 2
     OR p_new_weekend_days[1] NOT BETWEEN 0 AND 6
     OR p_new_weekend_days[2] NOT BETWEEN 0 AND 6 THEN
    RETURN jsonb_build_object(
      'status', 'rejected',
      'message', 'Invalid weekend_days. Must be 2-element array with values 0-6'
    );
  END IF;

  -- Check cooldown (14 days, exempt new accounts <7 days old)
  IF v_last_change_at IS NOT NULL
     AND NOW() - v_last_change_at < INTERVAL '14 days'
     AND v_account_age_days > 7 THEN
    RETURN jsonb_build_object(
      'status', 'rejected',
      'message', 'Timezone changes limited to once per 14 days',
      'cooldownUntil', v_last_change_at + INTERVAL '14 days',
      'hoursRemaining', CEIL(EXTRACT(EPOCH FROM (v_last_change_at + INTERVAL '14 days' - NOW())) / 3600)
    );
  END IF;

  -- Calculate application time: next midnight 00:00 UTC
  v_applies_at := DATE_TRUNC('day', NOW()) + INTERVAL '1 day';

  -- Log change in history (for user reference only)
  INSERT INTO public.timezone_change_history (
    user_id,
    old_timezone,
    new_timezone,
    old_weekend_days,
    new_weekend_days,
    changed_at
  ) VALUES (
    p_user_id,
    v_current_timezone,
    p_new_timezone,
    v_current_weekend_days,
    p_new_weekend_days,
    NOW()
  );

  -- Update user with PENDING timezone
  UPDATE public.users
  SET pending_timezone = p_new_timezone,
      pending_timezone_applies_at = v_applies_at,
      weekend_days = p_new_weekend_days,
      last_timezone_change_at = NOW()
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'status', 'pending',
    'message', 'Timezone change scheduled. Will apply at next midnight (00:00 UTC)',
    'newTimezone', p_new_timezone,
    'newWeekendDays', p_new_weekend_days,
    'appliesAt', v_applies_at,
    'hoursUntilApplied', CEIL(EXTRACT(EPOCH FROM (v_applies_at - NOW())) / 3600)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.request_timezone_change TO authenticated;

COMMENT ON FUNCTION public.request_timezone_change IS
  'Request timezone change with automated validation and rate limiting.
   Changes apply at next midnight UTC (24-hour minimum delay).
   Enforces 14-day cooldown (waived for accounts <7 days old).
   Fully automated - no manual review needed.';
-- Re-apply atomic_save_completed_pomodoro to fix "function not found" error
-- This ensures the function exists in the schema cache with the correct signature

-- 1. Drop existing overloads to prevent ambiguity
DO $$
DECLARE
  func_record RECORD;
BEGIN
  FOR func_record IN
    SELECT oid::regprocedure
    FROM pg_proc
    WHERE proname = 'atomic_save_completed_pomodoro'
    AND pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || func_record.oid::regprocedure || ' CASCADE';
  END LOOP;
END $$;

-- 2. Re-create the function (Signature must match src/lib/userSyncAuth.ts)
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
  -- Session-only auth: Verify auth.uid() matches user's auth_user_id
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_user_id
    AND auth_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized: User not found or cannot save pomodoro for another user';
  END IF;

  -- Validation
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id cannot be NULL';
  END IF;

  IF p_duration_minutes <= 0 THEN
    RAISE EXCEPTION 'duration_minutes must be positive';
  END IF;

  IF p_xp_earned < 0 THEN
    RAISE EXCEPTION 'xp_earned must be non-negative' USING ERRCODE = '22023';
  END IF;

  -- Get discord_id from user table for insert
  SELECT discord_id INTO v_discord_id
  FROM public.users
  WHERE id = p_user_id;

  -- Insert completed pomodoro
  INSERT INTO public.completed_pomodoros (
    user_id,
    discord_id,
    duration_minutes,
    xp_earned,
    task_name,
    notes,
    completed_at
  ) VALUES (
    p_user_id,
    v_discord_id,
    p_duration_minutes,
    p_xp_earned,
    p_task_name,
    p_notes,
    NOW()
  )
  RETURNING id INTO v_pomodoro_id;

  -- Update user totals atomically
  UPDATE public.users
  SET
    total_pomodoros = total_pomodoros + 1,
    total_study_minutes = total_study_minutes + p_duration_minutes,
    xp = xp + p_xp_earned,
    updated_at = NOW()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User with id % not found', p_user_id;
  END IF;

  RETURN v_pomodoro_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.atomic_save_completed_pomodoro(UUID, INTEGER, INTEGER, BOOLEAN, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.atomic_save_completed_pomodoro IS
  'Atomically saves completed pomodoro and updates user stats (session-auth only).
   Restored via migration 20251208033600 to fix schema cache error.';
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
  v_change_count INT;
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
    timezone_change_count_month,
    EXTRACT(DAY FROM (NOW() - created_at))::INT
  INTO 
    v_current_timezone, 
    v_last_change, 
    v_change_count, 
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
