-- Reset user progress RPC
-- Resets XP, level, prestige, and stats for authenticated user
-- Supports both web (Supabase Auth) and Discord Activity modes

-- Web version: uses auth.uid()
CREATE OR REPLACE FUNCTION public.reset_user_progress(
  p_user_id UUID
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
    RAISE EXCEPTION 'Not authorized to reset this user';
  END IF;

  UPDATE public.users
  SET
    xp = 0,
    level = 1,
    prestige_level = 0,
    total_pomodoros = 0,
    total_study_minutes = 0,
    total_unique_days = 0,
    last_pomodoro_date = NULL,
    updated_at = NOW()
  WHERE id = p_user_id
  RETURNING * INTO v_updated_user;

  IF v_updated_user IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  RETURN v_updated_user;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Discord Activity version: uses discord_id
CREATE OR REPLACE FUNCTION public.reset_user_progress_discord(
  p_discord_id TEXT
)
RETURNS public.users AS $$
DECLARE
  v_updated_user public.users;
BEGIN
  -- Verify discord_id is provided
  IF p_discord_id IS NULL OR p_discord_id = '' THEN
    RAISE EXCEPTION 'Discord ID required';
  END IF;

  UPDATE public.users
  SET
    xp = 0,
    level = 1,
    prestige_level = 0,
    total_pomodoros = 0,
    total_study_minutes = 0,
    total_unique_days = 0,
    last_pomodoro_date = NULL,
    updated_at = NOW()
  WHERE discord_id = p_discord_id
  RETURNING * INTO v_updated_user;

  IF v_updated_user IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  RETURN v_updated_user;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.reset_user_progress TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_user_progress_discord TO anon;
GRANT EXECUTE ON FUNCTION public.reset_user_progress_discord TO authenticated;

COMMENT ON FUNCTION public.reset_user_progress IS
  'Resets all progress (XP, level, prestige, stats) for web users via Supabase Auth';

COMMENT ON FUNCTION public.reset_user_progress_discord IS
  'Resets all progress (XP, level, prestige, stats) for Discord Activity users';
