-- Add separate background columns for desktop and mobile
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS background_mobile text,
ADD COLUMN IF NOT EXISTS background_desktop text;

-- Update update_user_settings RPC to handle new fields
CREATE OR REPLACE FUNCTION update_user_settings(
  p_user_id uuid,
  p_timer_pomodoro_minutes integer DEFAULT NULL,
  p_timer_short_break_minutes integer DEFAULT NULL,
  p_timer_long_break_minutes integer DEFAULT NULL,
  p_pomodoros_before_long_break integer DEFAULT NULL,
  p_auto_start_breaks boolean DEFAULT NULL,
  p_auto_start_pomodoros boolean DEFAULT NULL,
  p_background_id text DEFAULT NULL,
  p_playlist text DEFAULT NULL,
  p_ambient_volumes jsonb DEFAULT NULL,
  p_sound_enabled boolean DEFAULT NULL,
  p_volume integer DEFAULT NULL,
  p_music_volume integer DEFAULT NULL,
  p_level_system_enabled boolean DEFAULT NULL,
  p_level_path text DEFAULT NULL,
  p_background_mobile text DEFAULT NULL,
  p_background_desktop text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_data jsonb;
BEGIN
  -- Check if user exists and matches auth
  IF NOT EXISTS (
    SELECT 1 FROM users 
    WHERE id = p_user_id 
    AND auth_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied or user not found';
  END IF;

  -- Update user settings
  UPDATE users
  SET
    timer_pomodoro_minutes = COALESCE(p_timer_pomodoro_minutes, timer_pomodoro_minutes),
    timer_short_break_minutes = COALESCE(p_timer_short_break_minutes, timer_short_break_minutes),
    timer_long_break_minutes = COALESCE(p_timer_long_break_minutes, timer_long_break_minutes),
    pomodoros_before_long_break = COALESCE(p_pomodoros_before_long_break, pomodoros_before_long_break),
    auto_start_breaks = COALESCE(p_auto_start_breaks, auto_start_breaks),
    auto_start_pomodoros = COALESCE(p_auto_start_pomodoros, auto_start_pomodoros),
    background_id = COALESCE(p_background_id, background_id),
    playlist = COALESCE(p_playlist, playlist),
    ambient_volumes = COALESCE(p_ambient_volumes, ambient_volumes),
    sound_enabled = COALESCE(p_sound_enabled, sound_enabled),
    volume = COALESCE(p_volume, volume),
    music_volume = COALESCE(p_music_volume, music_volume),
    level_system_enabled = COALESCE(p_level_system_enabled, level_system_enabled),
    level_path = COALESCE(p_level_path, level_path),
    background_mobile = COALESCE(p_background_mobile, background_mobile),
    background_desktop = COALESCE(p_background_desktop, background_desktop),
    updated_at = NOW()
  WHERE id = p_user_id
  RETURNING to_jsonb(users.*) INTO v_user_data;

  RETURN v_user_data;
END;
$$;

-- Update update_user_settings_discord RPC to handle new fields
CREATE OR REPLACE FUNCTION update_user_settings_discord(
  p_discord_id text,
  p_timer_pomodoro_minutes integer DEFAULT NULL,
  p_timer_short_break_minutes integer DEFAULT NULL,
  p_timer_long_break_minutes integer DEFAULT NULL,
  p_pomodoros_before_long_break integer DEFAULT NULL,
  p_auto_start_breaks boolean DEFAULT NULL,
  p_auto_start_pomodoros boolean DEFAULT NULL,
  p_background_id text DEFAULT NULL,
  p_playlist text DEFAULT NULL,
  p_ambient_volumes jsonb DEFAULT NULL,
  p_sound_enabled boolean DEFAULT NULL,
  p_volume integer DEFAULT NULL,
  p_music_volume integer DEFAULT NULL,
  p_level_system_enabled boolean DEFAULT NULL,
  p_level_path text DEFAULT NULL,
  p_background_mobile text DEFAULT NULL,
  p_background_desktop text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_data jsonb;
BEGIN
  -- Update user settings
  UPDATE users
  SET
    timer_pomodoro_minutes = COALESCE(p_timer_pomodoro_minutes, timer_pomodoro_minutes),
    timer_short_break_minutes = COALESCE(p_timer_short_break_minutes, timer_short_break_minutes),
    timer_long_break_minutes = COALESCE(p_timer_long_break_minutes, timer_long_break_minutes),
    pomodoros_before_long_break = COALESCE(p_pomodoros_before_long_break, pomodoros_before_long_break),
    auto_start_breaks = COALESCE(p_auto_start_breaks, auto_start_breaks),
    auto_start_pomodoros = COALESCE(p_auto_start_pomodoros, auto_start_pomodoros),
    background_id = COALESCE(p_background_id, background_id),
    playlist = COALESCE(p_playlist, playlist),
    ambient_volumes = COALESCE(p_ambient_volumes, ambient_volumes),
    sound_enabled = COALESCE(p_sound_enabled, sound_enabled),
    volume = COALESCE(p_volume, volume),
    music_volume = COALESCE(p_music_volume, music_volume),
    level_system_enabled = COALESCE(p_level_system_enabled, level_system_enabled),
    level_path = COALESCE(p_level_path, level_path),
    background_mobile = COALESCE(p_background_mobile, background_mobile),
    background_desktop = COALESCE(p_background_desktop, background_desktop),
    updated_at = NOW()
  WHERE discord_id = p_discord_id
  RETURNING to_jsonb(users.*) INTO v_user_data;

  RETURN v_user_data;
END;
$$;
