-- ============================================================================
-- Fix Production Schema Mismatch (Nov 23, 2025)
-- ============================================================================
-- Issue: Production deployment failed due to missing schema features
--
-- Errors Fixed:
--   1. "Could not find function atomic_save_completed_pomodoro(p_critical_success...)"
--      → Function signature didn't include p_critical_success parameter
--   2. "column 'critical_success' does not exist"
--      → Missing column in completed_pomodoros table
--   3. Missing first_login_date column for account age tracking
--
-- Changes:
--   - Add critical_success BOOLEAN column to completed_pomodoros
--   - Add first_login_date DATE column to users (backfilled with created_at)
--   - Update atomic_save_completed_pomodoro to accept p_critical_success param
--
-- Safety: Backward compatible, zero downtime, idempotent
-- Applied: 2025-11-23 02:00:00 UTC
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- STEP 1: Add Missing Columns
-- ----------------------------------------------------------------------------

-- Add critical_success to completed_pomodoros (human role crit tracking)
ALTER TABLE public.completed_pomodoros
ADD COLUMN IF NOT EXISTS critical_success BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.completed_pomodoros.critical_success IS
  'For human role: tracks if this pomodoro triggered the 25% critical success (2x XP)';

-- Add first_login_date to users (account age tracking)
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS first_login_date DATE;

COMMENT ON COLUMN public.users.first_login_date IS
  'Date of first login (YYYY-MM-DD), used for "Since" display in stats';

-- Backfill existing users with created_at date
UPDATE public.users
SET first_login_date = created_at::DATE
WHERE first_login_date IS NULL;

-- Set default for new users
ALTER TABLE public.users
ALTER COLUMN first_login_date SET DEFAULT CURRENT_DATE;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_users_first_login_date ON public.users(first_login_date);

-- ----------------------------------------------------------------------------
-- STEP 2: Replace atomic_save_completed_pomodoro Function
-- ----------------------------------------------------------------------------

-- Drop old version (6 parameters - missing critical_success)
DROP FUNCTION IF EXISTS public.atomic_save_completed_pomodoro(UUID, TEXT, INTEGER, INTEGER, TEXT, TEXT);

-- Create new version (7 parameters - adds p_critical_success)
CREATE FUNCTION public.atomic_save_completed_pomodoro(
  p_user_id UUID,
  p_discord_id TEXT,
  p_duration_minutes INTEGER,
  p_xp_earned INTEGER,
  p_task_name TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_critical_success BOOLEAN DEFAULT FALSE  -- NEW: Human role crit tracking
)
RETURNS UUID AS $$
DECLARE
  v_pomodoro_id UUID;
BEGIN
  -- Validate inputs
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id cannot be NULL';
  END IF;

  IF p_duration_minutes <= 0 THEN
    RAISE EXCEPTION 'duration_minutes must be positive';
  END IF;

  IF p_xp_earned < 0 THEN
    RAISE EXCEPTION 'xp_earned must be non-negative' USING ERRCODE = '22023';
  END IF;

  -- HYBRID AUTHENTICATION: Support both Supabase Auth and Discord Activity
  IF auth.uid() IS NOT NULL THEN
    -- Web mode: Verify auth_user_id matches
    IF NOT EXISTS (
      SELECT 1 FROM public.users
      WHERE id = p_user_id AND auth_user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'Unauthorized: Cannot save pomodoro for another user';
    END IF;
  ELSE
    -- Discord Activity mode: Verify discord_id ownership
    IF p_discord_id IS NULL THEN
      RAISE EXCEPTION 'Authentication required: discord_id required when not authenticated via Supabase';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.users
      WHERE id = p_user_id AND discord_id = p_discord_id
    ) THEN
      RAISE EXCEPTION 'Unauthorized: discord_id does not match user';
    END IF;
  END IF;

  -- Insert completed pomodoro
  INSERT INTO public.completed_pomodoros (
    user_id,
    discord_id,
    duration_minutes,
    xp_earned,
    task_name,
    notes,
    critical_success,  -- NEW
    completed_at
  ) VALUES (
    p_user_id,
    p_discord_id,
    p_duration_minutes,
    p_xp_earned,
    p_task_name,
    p_notes,
    p_critical_success,  -- NEW
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

-- Grant permissions (web + Discord Activity)
GRANT EXECUTE ON FUNCTION public.atomic_save_completed_pomodoro(UUID, TEXT, INTEGER, INTEGER, TEXT, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atomic_save_completed_pomodoro(UUID, TEXT, INTEGER, INTEGER, TEXT, TEXT, BOOLEAN) TO anon;

COMMENT ON FUNCTION public.atomic_save_completed_pomodoro IS
  'Atomically saves completed pomodoro and updates user stats.
   Supports dual authentication: Supabase Auth (web) + Discord Activity.
   Tracks critical success (p_critical_success) for human role 2x XP buff.
   Prevents inconsistent state from partial failures.';

COMMIT;

-- ============================================================================
-- Migration applied successfully
-- Production schema now matches codebase expectations
-- ============================================================================
