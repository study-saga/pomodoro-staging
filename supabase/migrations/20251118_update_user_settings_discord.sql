-- Migration: Add Discord Activity Settings Sync Support
--
-- Discord Activity uses Discord SDK for auth (no Supabase session).
-- This function allows settings sync via discord_id authentication.

-- ============================================================================
-- 1. CREATE DISCORD SETTINGS UPDATE FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_user_settings_discord(
  -- User identification via Discord ID
  p_discord_id TEXT,

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
  p_level_path TEXT DEFAULT NULL
)
RETURNS public.users AS $$
DECLARE
  v_updated_user public.users;
BEGIN
  -- SECURITY: Verify discord_id is provided
  IF p_discord_id IS NULL OR p_discord_id = '' THEN
    RAISE EXCEPTION 'Discord ID required';
  END IF;

  -- Verify user exists with this discord_id
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE discord_id = p_discord_id
  ) THEN
    RAISE EXCEPTION 'User not found with discord_id: %', p_discord_id;
  END IF;

  -- Update ONLY settings fields (NOT stats, XP, levels)
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
  WHERE discord_id = p_discord_id
  RETURNING * INTO v_updated_user;

  RETURN v_updated_user;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.update_user_settings_discord IS 'Updates user settings via Discord ID authentication. For Discord Activity mode where no Supabase session exists.';

-- Grant execute permission to anon (Discord Activity uses anon key)
GRANT EXECUTE ON FUNCTION public.update_user_settings_discord TO anon;
GRANT EXECUTE ON FUNCTION public.update_user_settings_discord TO authenticated;

-- ============================================================================
-- 2. MIGRATION COMPLETE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Migration 20251118_update_user_settings_discord.sql completed';
  RAISE NOTICE 'Created function: update_user_settings_discord';
  RAISE NOTICE 'Discord Activity can now sync settings via discord_id';
END $$;
