-- Remove discord_id parameter from atomic RPC functions
-- Align DB signature with frontend code (commit 7a061ab)

-- Drop ALL function signatures by querying pg_catalog
-- Production has multiple overloaded versions causing "function name not unique" error
DO $$
DECLARE
  func_record RECORD;
BEGIN
  -- Drop all atomic_save_completed_pomodoro overloads
  FOR func_record IN
    SELECT oid::regprocedure
    FROM pg_proc
    WHERE proname = 'atomic_save_completed_pomodoro'
    AND pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || func_record.oid::regprocedure || ' CASCADE';
  END LOOP;

  -- Drop all atomic_save_completed_break overloads
  FOR func_record IN
    SELECT oid::regprocedure
    FROM pg_proc
    WHERE proname = 'atomic_save_completed_break'
    AND pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || func_record.oid::regprocedure || ' CASCADE';
  END LOOP;
END $$;

-- ============================================================================
-- 1. Create atomic_save_completed_pomodoro (session-auth only)
-- ============================================================================

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
   Removed discord_id param - fetched from user table instead.';


-- ============================================================================
-- 2. Update atomic_save_completed_break (remove p_discord_id param)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.atomic_save_completed_break(
  p_user_id UUID,
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
    RAISE EXCEPTION 'Unauthorized: User not found or cannot save break for another user';
  END IF;

  -- Validation
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id cannot be NULL';
  END IF;

  IF p_break_type NOT IN ('short', 'long') THEN
    RAISE EXCEPTION 'break_type must be short or long';
  END IF;

  IF p_duration_minutes <= 0 THEN
    RAISE EXCEPTION 'duration_minutes must be positive';
  END IF;

  -- Get boost status and discord_id from user table
  SELECT pomodoro_boost_active, pomodoro_boost_expires_at, discord_id
  INTO v_boost_active, v_boost_expires_at, v_discord_id
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

  -- Insert completed break
  INSERT INTO public.completed_breaks (
    user_id,
    discord_id,
    break_type,
    duration_minutes,
    xp_earned,
    completed_at
  ) VALUES (
    p_user_id,
    v_discord_id,
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

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User with id % not found', p_user_id;
  END IF;

  RETURN v_break_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.atomic_save_completed_break(UUID, TEXT, INTEGER, INTEGER) TO authenticated;

COMMENT ON FUNCTION public.atomic_save_completed_break IS
  'Atomically saves completed break and updates user XP (session-auth only).
   Removed discord_id param - fetched from user table instead.
   Applies +25% XP boost if active.';
