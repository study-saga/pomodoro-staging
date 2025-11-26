-- Fix function overload conflicts caused by migration 20251125070000
-- Drop old 15-param versions of update_user_settings functions
-- Keep only new 17-param versions (with background_mobile/desktop)

-- Drop old update_user_settings (web mode)
DROP FUNCTION IF EXISTS public.update_user_settings(
  p_user_id uuid,
  p_timer_pomodoro_minutes integer,
  p_timer_short_break_minutes integer,
  p_timer_long_break_minutes integer,
  p_pomodoros_before_long_break integer,
  p_auto_start_breaks boolean,
  p_auto_start_pomodoros boolean,
  p_background_id text,
  p_playlist text,
  p_ambient_volumes jsonb,
  p_sound_enabled boolean,
  p_volume integer,
  p_music_volume integer,
  p_level_system_enabled boolean,
  p_level_path text
);

-- Drop old update_user_settings_discord (Discord mode)
DROP FUNCTION IF EXISTS public.update_user_settings_discord(
  p_discord_id text,
  p_timer_pomodoro_minutes integer,
  p_timer_short_break_minutes integer,
  p_timer_long_break_minutes integer,
  p_pomodoros_before_long_break integer,
  p_auto_start_breaks boolean,
  p_auto_start_pomodoros boolean,
  p_background_id text,
  p_playlist text,
  p_ambient_volumes jsonb,
  p_sound_enabled boolean,
  p_volume integer,
  p_music_volume integer,
  p_level_system_enabled boolean,
  p_level_path text
);
