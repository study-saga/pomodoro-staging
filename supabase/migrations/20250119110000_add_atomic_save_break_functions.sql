-- Create atomic functions to save break and update user stats in one transaction
-- Dual authentication support: Web (Supabase Auth) + Discord Activity



-- ============================================================================
-- 1. WEB MODE: atomic_save_completed_break (uses auth.uid())
-- ============================================================================

CREATE OR REPLACE FUNCTION public.atomic_save_completed_break(
  p_user_id UUID,
  p_discord_id TEXT,
  p_break_type TEXT,
  p_duration_minutes INTEGER,
  p_xp_earned INTEGER
)
RETURNS UUID AS $$
DECLARE
  v_break_id UUID;
  v_boost_active BOOLEAN;
  v_boost_expires_at BIGINT;
  v_xp_multiplier NUMERIC := 1.0;
  v_final_xp INTEGER;
BEGIN
  -- SECURITY: Verify caller is updating their own data
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Validate inputs
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id cannot be NULL';
  END IF;

  IF p_break_type NOT IN ('short', 'long') THEN
    RAISE EXCEPTION 'break_type must be short or long';
  END IF;

  IF p_duration_minutes <= 0 THEN
    RAISE EXCEPTION 'duration_minutes must be positive';
  END IF;

  -- Verify the user_id matches the caller's auth_user_id
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_user_id
    AND auth_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized: User not found or cannot save break for another user';
  END IF;

  -- Check if pomodoro boost is active and applies to breaks
  SELECT pomodoro_boost_active, pomodoro_boost_expires_at
  INTO v_boost_active, v_boost_expires_at
  FROM public.users
  WHERE id = p_user_id;

  -- Apply +25% boost if active and not expired
  IF v_boost_active AND v_boost_expires_at IS NOT NULL THEN
    IF EXTRACT(EPOCH FROM NOW()) * 1000 < v_boost_expires_at THEN
      v_xp_multiplier := 1.25;
    END IF;
  END IF;

  -- Calculate final XP with boost
  v_final_xp := FLOOR(p_xp_earned * v_xp_multiplier);

  -- Insert completed break (returns ID)
  INSERT INTO public.completed_breaks (
    user_id,
    discord_id,
    break_type,
    duration_minutes,
    xp_earned,
    completed_at
  ) VALUES (
    p_user_id,
    p_discord_id,
    p_break_type,
    p_duration_minutes,
    v_final_xp,
    NOW()
  )
  RETURNING id INTO v_break_id;

  -- Update user XP atomically
  UPDATE public.users
  SET
    xp = xp + v_final_xp,
    updated_at = NOW()
  WHERE id = p_user_id;

  -- Verify user was updated
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User with id % not found', p_user_id;
  END IF;

  -- Return the break ID
  RETURN v_break_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.atomic_save_completed_break(UUID, TEXT, TEXT, INTEGER, INTEGER) TO authenticated;

COMMENT ON FUNCTION public.atomic_save_completed_break IS
  'Atomically saves completed break and updates user XP in one transaction (Web mode).
   Applies +25% XP boost if active. Prevents inconsistent state from partial failures.';

-- ============================================================================
-- 2. DISCORD ACTIVITY MODE: atomic_save_completed_break_discord (uses discord_id)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.atomic_save_completed_break_discord(
  p_user_id UUID,
  p_discord_id TEXT,
  p_break_type TEXT,
  p_duration_minutes INTEGER,
  p_xp_earned INTEGER
)
RETURNS UUID AS $$
DECLARE
  v_break_id UUID;
  v_boost_active BOOLEAN;
  v_boost_expires_at BIGINT;
  v_xp_multiplier NUMERIC := 1.0;
  v_final_xp INTEGER;
BEGIN
  -- SECURITY: Verify discord_id matches user_id
  IF p_user_id IS NULL OR p_discord_id IS NULL THEN
    RAISE EXCEPTION 'user_id and discord_id cannot be NULL';
  END IF;

  IF p_break_type NOT IN ('short', 'long') THEN
    RAISE EXCEPTION 'break_type must be short or long';
  END IF;

  IF p_duration_minutes <= 0 THEN
    RAISE EXCEPTION 'duration_minutes must be positive';
  END IF;

  -- Verify the user_id matches discord_id
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_user_id
    AND discord_id = p_discord_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized: discord_id does not match user_id';
  END IF;

  -- Check if pomodoro boost is active and applies to breaks
  SELECT pomodoro_boost_active, pomodoro_boost_expires_at
  INTO v_boost_active, v_boost_expires_at
  FROM public.users
  WHERE id = p_user_id;

  -- Apply +25% boost if active and not expired
  IF v_boost_active AND v_boost_expires_at IS NOT NULL THEN
    IF EXTRACT(EPOCH FROM NOW()) * 1000 < v_boost_expires_at THEN
      v_xp_multiplier := 1.25;
    END IF;
  END IF;

  -- Calculate final XP with boost
  v_final_xp := FLOOR(p_xp_earned * v_xp_multiplier);

  -- Insert completed break (returns ID)
  INSERT INTO public.completed_breaks (
    user_id,
    discord_id,
    break_type,
    duration_minutes,
    xp_earned,
    completed_at
  ) VALUES (
    p_user_id,
    p_discord_id,
    p_break_type,
    p_duration_minutes,
    v_final_xp,
    NOW()
  )
  RETURNING id INTO v_break_id;

  -- Update user XP atomically
  UPDATE public.users
  SET
    xp = xp + v_final_xp,
    updated_at = NOW()
  WHERE id = p_user_id;

  -- Verify user was updated
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User with id % not found', p_user_id;
  END IF;

  -- Return the break ID
  RETURN v_break_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated and anon users (Discord Activity uses anon)
GRANT EXECUTE ON FUNCTION public.atomic_save_completed_break_discord(UUID, TEXT, TEXT, INTEGER, INTEGER) TO anon, authenticated;

COMMENT ON FUNCTION public.atomic_save_completed_break_discord IS
  'Atomically saves completed break and updates user XP in one transaction (Discord Activity mode).
   Applies +25% XP boost if active. Uses discord_id for authentication.';
