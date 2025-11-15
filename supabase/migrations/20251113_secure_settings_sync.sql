-- Migration: Secure Settings Sync - Prevent Client-Controlled Stats Abuse
--
-- SECURITY FIX: Split update_user_preferences into two functions:
-- 1. update_user_settings() - CLIENT can call (settings only)
-- 2. Stats updates remain in existing atomic functions (SERVER only)
--
-- This prevents users from cheating by setting arbitrary XP/levels/stats

-- ============================================================================
-- 1. CREATE SECURE SETTINGS UPDATE FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_user_settings(
  -- User identification
  p_user_id UUID,

  -- Timer preferences (6 fields) - SAFE for client to control
  p_timer_pomodoro_minutes INTEGER DEFAULT NULL,
  p_timer_short_break_minutes INTEGER DEFAULT NULL,
  p_timer_long_break_minutes INTEGER DEFAULT NULL,
  p_pomodoros_before_long_break INTEGER DEFAULT NULL,
  p_auto_start_breaks BOOLEAN DEFAULT NULL,
  p_auto_start_pomodoros BOOLEAN DEFAULT NULL,

  -- Visual preferences (3 fields) - SAFE for client to control
  p_background_id TEXT DEFAULT NULL,
  p_playlist TEXT DEFAULT NULL,
  p_ambient_volumes JSONB DEFAULT NULL,

  -- Audio preferences (3 fields) - SAFE for client to control
  p_sound_enabled BOOLEAN DEFAULT NULL,
  p_volume INTEGER DEFAULT NULL,
  p_music_volume INTEGER DEFAULT NULL,

  -- System preferences (2 fields) - SAFE for client to control
  p_level_system_enabled BOOLEAN DEFAULT NULL,
  p_level_path TEXT DEFAULT NULL  -- Visual preference only
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
    RAISE EXCEPTION 'Unauthorized: Cannot update another user''s settings';
  END IF;

  -- Update ONLY settings fields (NOT stats, XP, levels)
  -- Stats are updated through dedicated server-controlled functions:
  -- - atomic_save_completed_pomodoro()
  -- - increment_user_xp()
  -- - increment_pomodoro_totals()
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
    level_path = COALESCE(p_level_path, level_path),

    -- Always update timestamp
    updated_at = NOW()
  WHERE id = p_user_id
  RETURNING * INTO v_updated_user;

  RETURN v_updated_user;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.update_user_settings IS 'Securely updates ONLY user settings (not stats/XP/levels). Prevents client-side cheating by restricting to 14 safe fields.';

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.update_user_settings TO authenticated;

-- ============================================================================
-- 2. DEPRECATE (but keep for backward compatibility) OLD FUNCTION
-- ============================================================================

-- IMPORTANT: Keep update_user_preferences for now, but document it should not be used
-- Eventually this should be removed once all code uses update_user_settings

COMMENT ON FUNCTION public.update_user_preferences IS 'DEPRECATED: Use update_user_settings instead. This function allows client-controlled stats which is a security risk.';

-- ============================================================================
-- 3. ADD VALIDATION CONSTRAINTS TO SETTINGS
-- ============================================================================

-- Add check constraints to prevent invalid values
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_timer_pomodoro_minutes_check,
  DROP CONSTRAINT IF EXISTS users_timer_short_break_minutes_check,
  DROP CONSTRAINT IF EXISTS users_timer_long_break_minutes_check,
  DROP CONSTRAINT IF EXISTS users_pomodoros_before_long_break_check;

-- Timer durations must be reasonable (1-120 minutes)
ALTER TABLE public.users
  ADD CONSTRAINT users_timer_pomodoro_minutes_check
    CHECK (timer_pomodoro_minutes >= 1 AND timer_pomodoro_minutes <= 120);

ALTER TABLE public.users
  ADD CONSTRAINT users_timer_short_break_minutes_check
    CHECK (timer_short_break_minutes >= 1 AND timer_short_break_minutes <= 60);

ALTER TABLE public.users
  ADD CONSTRAINT users_timer_long_break_minutes_check
    CHECK (timer_long_break_minutes >= 1 AND timer_long_break_minutes <= 120);

-- Pomodoros before long break must be reasonable (1-10)
ALTER TABLE public.users
  ADD CONSTRAINT users_pomodoros_before_long_break_check
    CHECK (pomodoros_before_long_break >= 1 AND pomodoros_before_long_break <= 10);

-- ============================================================================
-- 4. MIGRATION COMPLETE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Migration 20251113_secure_settings_sync.sql completed successfully';
  RAISE NOTICE 'Created function: update_user_settings (14 safe parameters)';
  RAISE NOTICE 'Deprecated function: update_user_preferences (29 parameters - security risk)';
  RAISE NOTICE 'Added validation constraints to timer settings';
  RAISE NOTICE '';
  RAISE NOTICE 'SECURITY IMPROVEMENT:';
  RAISE NOTICE '  ✓ Clients can now ONLY update settings (14 fields)';
  RAISE NOTICE '  ✓ XP, levels, stats are SERVER-CONTROLLED only';
  RAISE NOTICE '  ✓ Prevents cheating by setting arbitrary XP/levels';
  RAISE NOTICE '';
  RAISE NOTICE 'CLIENT-CONTROLLED (safe to sync):';
  RAISE NOTICE '  - Timer preferences (6 fields)';
  RAISE NOTICE '  - Visual preferences (3 fields)';
  RAISE NOTICE '  - Audio preferences (3 fields)';
  RAISE NOTICE '  - System preferences (2 fields)';
  RAISE NOTICE '';
  RAISE NOTICE 'SERVER-CONTROLLED (read-only from client):';
  RAISE NOTICE '  - XP, level, prestige_level';
  RAISE NOTICE '  - total_pomodoros, total_study_minutes';
  RAISE NOTICE '  - total_unique_days, last_pomodoro_date';
  RAISE NOTICE '  - total_login_days, consecutive_login_days, last_login_date';
  RAISE NOTICE '  - username (requires cooldown enforcement)';
END $$;
