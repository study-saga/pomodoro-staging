-- Re-apply atomic_save_completed_pomodoro to fix "function not found" error
-- This ensures the function exists in the schema cache with the correct signature

-- 1. Drop existing overloads to prevent ambiguity
DO $$
DECLARE
  func_record RECORD;
BEGIN
  FOR func_record IN
    SELECT oid::regprocedure
    FROM pg_proc
    WHERE proname = 'atomic_save_completed_pomodoro'
    AND pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || func_record.oid::regprocedure || ' CASCADE';
  END LOOP;
END $$;

-- 2. Re-create the function (Signature must match src/lib/userSyncAuth.ts)
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
   Restored via migration 20251208033600 to fix schema cache error.';
