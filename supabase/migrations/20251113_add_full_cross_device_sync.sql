-- Migration: Add Full Cross-Device Sync for All User Data
-- Ensures ALL user data (levels, stats, achievements, login tracking) syncs across devices

-- ============================================================================
-- 1. ADD MISSING COLUMNS TO USERS TABLE
-- ============================================================================

-- Add total login days tracking (different from consecutive days)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS total_login_days INTEGER DEFAULT 0 CHECK (total_login_days >= 0);

-- Add last pomodoro date for milestone tracking (stored as TEXT in YYYY-MM-DD format)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS last_pomodoro_date TEXT;

COMMENT ON COLUMN public.users.total_login_days IS 'Total unique days user has logged in (lifetime count)';
COMMENT ON COLUMN public.users.last_pomodoro_date IS 'Date of last completed pomodoro (YYYY-MM-DD format for milestone tracking)';

-- ============================================================================
-- 2. UPDATE LEVEL CONSTRAINT (increase from 20 to 50)
-- ============================================================================

-- Drop old constraint
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_level_check;

-- Add new constraint allowing levels 1-50
ALTER TABLE public.users
  ADD CONSTRAINT users_level_check CHECK (level >= 1 AND level <= 50);

COMMENT ON COLUMN public.users.level IS 'User level (1-50), resets to 1 on prestige';

-- ============================================================================
-- 3. UPDATE RPC FUNCTION: COMPREHENSIVE USER PREFERENCES SYNC
-- ============================================================================

-- Drop existing function to replace it
DROP FUNCTION IF EXISTS public.update_user_preferences(UUID, INTEGER, INTEGER, INTEGER, INTEGER, BOOLEAN, BOOLEAN, TEXT, TEXT, JSONB, BOOLEAN, INTEGER, INTEGER, BOOLEAN);

-- Create comprehensive sync function that handles ALL user data
CREATE OR REPLACE FUNCTION public.update_user_preferences(
  -- User identification
  p_user_id UUID,

  -- Timer preferences (6 fields)
  p_timer_pomodoro_minutes INTEGER DEFAULT NULL,
  p_timer_short_break_minutes INTEGER DEFAULT NULL,
  p_timer_long_break_minutes INTEGER DEFAULT NULL,
  p_pomodoros_before_long_break INTEGER DEFAULT NULL,
  p_auto_start_breaks BOOLEAN DEFAULT NULL,
  p_auto_start_pomodoros BOOLEAN DEFAULT NULL,

  -- Visual preferences (3 fields)
  p_background_id TEXT DEFAULT NULL,
  p_playlist TEXT DEFAULT NULL,
  p_ambient_volumes JSONB DEFAULT NULL,

  -- Audio preferences (3 fields)
  p_sound_enabled BOOLEAN DEFAULT NULL,
  p_volume INTEGER DEFAULT NULL,
  p_music_volume INTEGER DEFAULT NULL,

  -- System preferences (1 field)
  p_level_system_enabled BOOLEAN DEFAULT NULL,

  -- Level system data (7 fields)
  p_xp INTEGER DEFAULT NULL,
  p_level INTEGER DEFAULT NULL,
  p_prestige_level INTEGER DEFAULT NULL,
  p_total_pomodoros INTEGER DEFAULT NULL,
  p_total_study_minutes INTEGER DEFAULT NULL,
  p_username TEXT DEFAULT NULL,
  p_level_path TEXT DEFAULT NULL,

  -- Milestone tracking (2 fields)
  p_total_unique_days INTEGER DEFAULT NULL,
  p_last_pomodoro_date TEXT DEFAULT NULL,

  -- Login tracking (3 fields)
  p_total_login_days INTEGER DEFAULT NULL,
  p_consecutive_login_days INTEGER DEFAULT NULL,
  p_last_login_date TEXT DEFAULT NULL
)
RETURNS public.users AS $$
DECLARE
  v_updated_user public.users;
BEGIN
  -- SECURITY: Verify caller owns this user profile
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_user_id AND auth_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Cannot update another user''s preferences';
  END IF;

  -- Update ALL fields (NULL means no change)
  UPDATE public.users
  SET
    -- Timer preferences
    timer_pomodoro_minutes = COALESCE(p_timer_pomodoro_minutes, timer_pomodoro_minutes),
    timer_short_break_minutes = COALESCE(p_timer_short_break_minutes, timer_short_break_minutes),
    timer_long_break_minutes = COALESCE(p_timer_long_break_minutes, timer_long_break_minutes),
    pomodoros_before_long_break = COALESCE(p_pomodoros_before_long_break, pomodoros_before_long_break),
    auto_start_breaks = COALESCE(p_auto_start_breaks, auto_start_breaks),
    auto_start_pomodoros = COALESCE(p_auto_start_pomodoros, auto_start_pomodoros),

    -- Visual preferences
    background_id = COALESCE(p_background_id, background_id),
    playlist = COALESCE(p_playlist, playlist),
    ambient_volumes = COALESCE(p_ambient_volumes, ambient_volumes),

    -- Audio preferences
    sound_enabled = COALESCE(p_sound_enabled, sound_enabled),
    volume = COALESCE(p_volume, volume),
    music_volume = COALESCE(p_music_volume, music_volume),

    -- System preferences
    level_system_enabled = COALESCE(p_level_system_enabled, level_system_enabled),

    -- Level system data
    xp = COALESCE(p_xp, xp),
    level = COALESCE(p_level, level),
    prestige_level = COALESCE(p_prestige_level, prestige_level),
    total_pomodoros = COALESCE(p_total_pomodoros, total_pomodoros),
    total_study_minutes = COALESCE(p_total_study_minutes, total_study_minutes),
    username = COALESCE(p_username, username),
    level_path = COALESCE(p_level_path, level_path),

    -- Milestone tracking
    total_unique_days = COALESCE(p_total_unique_days, total_unique_days),
    last_pomodoro_date = COALESCE(p_last_pomodoro_date, last_pomodoro_date),

    -- Login tracking
    total_login_days = COALESCE(p_total_login_days, total_login_days),
    consecutive_login_days = COALESCE(p_consecutive_login_days, consecutive_login_days),
    last_login_date = CASE
      WHEN p_last_login_date IS NOT NULL THEN p_last_login_date::DATE
      ELSE last_login_date
    END,

    -- Always update timestamp
    updated_at = NOW()
  WHERE id = p_user_id
  RETURNING * INTO v_updated_user;

  RETURN v_updated_user;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.update_user_preferences IS 'Comprehensive sync function for ALL user data including levels, stats, achievements, and settings. Only updates provided fields (NULL = no change).';

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.update_user_preferences TO authenticated;

-- ============================================================================
-- 4. MIGRATION COMPLETE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Migration 20251113_add_full_cross_device_sync.sql completed successfully';
  RAISE NOTICE 'Added columns: total_login_days, last_pomodoro_date';
  RAISE NOTICE 'Updated level constraint: 1-50 (was 1-20)';
  RAISE NOTICE 'Updated function: update_user_preferences now syncs ALL user data';
  RAISE NOTICE 'Cross-device sync now includes: levels, XP, stats, achievements, login tracking, and all settings';
END $$;
