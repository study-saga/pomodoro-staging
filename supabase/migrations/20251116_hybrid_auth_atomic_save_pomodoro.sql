-- Update atomic_save_completed_pomodoro to support hybrid authentication
-- Supports both Supabase Auth (web) and Discord Activity (no JWT) authentication

CREATE OR REPLACE FUNCTION public.atomic_save_completed_pomodoro(
  p_user_id UUID,
  p_discord_id TEXT,
  p_duration_minutes INTEGER,
  p_xp_earned INTEGER,
  p_task_name TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_pomodoro_id UUID;
BEGIN
  -- Validate inputs first
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
    -- Supabase Auth (Web mode): Verify auth_user_id matches
    IF NOT EXISTS (
      SELECT 1 FROM public.users
      WHERE id = p_user_id
      AND auth_user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'Unauthorized: User not found or cannot save pomodoro for another user';
    END IF;
  ELSE
    -- Discord Activity mode (no JWT): Verify discord_id ownership
    IF p_discord_id IS NULL THEN
      RAISE EXCEPTION 'Authentication required: discord_id is required when not authenticated via Supabase';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.users
      WHERE id = p_user_id
      AND discord_id = p_discord_id
    ) THEN
      RAISE EXCEPTION 'Unauthorized: User not found or discord_id does not match';
    END IF;
  END IF;

  -- Insert completed pomodoro (returns ID)
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
    p_discord_id,
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

  -- Verify user was updated
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User with id % not found', p_user_id;
  END IF;

  -- Return the pomodoro ID
  RETURN v_pomodoro_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users AND anon (for Discord Activity)
GRANT EXECUTE ON FUNCTION public.atomic_save_completed_pomodoro(UUID, TEXT, INTEGER, INTEGER, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atomic_save_completed_pomodoro(UUID, TEXT, INTEGER, INTEGER, TEXT, TEXT) TO anon;

COMMENT ON FUNCTION public.atomic_save_completed_pomodoro IS
  'Atomically saves completed pomodoro and updates user stats in one transaction.
   Supports both Supabase Auth (web) and Discord Activity (discord_id) authentication.
   Prevents inconsistent state from partial failures.';
