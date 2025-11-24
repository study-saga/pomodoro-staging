-- Add boost multiplier column to support dynamic boost percentages (25%, 50%, etc.)
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS pomodoro_boost_multiplier NUMERIC(3,2) DEFAULT 1.25;

COMMENT ON COLUMN public.users.pomodoro_boost_multiplier IS 'XP multiplier when boost active (1.25 = +25%, 1.5 = +50%)';

-- Update atomic_save_completed_pomodoro to apply boost multiplier
CREATE OR REPLACE FUNCTION public.atomic_save_completed_pomodoro(
  p_user_id UUID,
  p_discord_id TEXT,
  p_duration_minutes INTEGER,
  p_xp_earned INTEGER,
  p_task_name TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_critical_success BOOLEAN DEFAULT FALSE
)
RETURNS UUID AS $$
DECLARE
  v_pomodoro_id UUID;
  v_boost_active BOOLEAN;
  v_boost_expires_at BIGINT;
  v_boost_multiplier NUMERIC(3,2);
  v_final_xp INTEGER;
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

  -- Check if pomodoro boost is active
  SELECT pomodoro_boost_active, pomodoro_boost_expires_at, pomodoro_boost_multiplier
  INTO v_boost_active, v_boost_expires_at, v_boost_multiplier
  FROM public.users
  WHERE id = p_user_id;

  -- Apply boost if active and not expired
  v_final_xp := p_xp_earned;
  IF v_boost_active AND v_boost_expires_at > EXTRACT(EPOCH FROM NOW()) * 1000 THEN
    v_final_xp := FLOOR(p_xp_earned * v_boost_multiplier);
    RAISE NOTICE 'Boost applied: % XP -> % XP (multiplier: %)', p_xp_earned, v_final_xp, v_boost_multiplier;
  ELSIF v_boost_active AND v_boost_expires_at <= EXTRACT(EPOCH FROM NOW()) * 1000 THEN
    -- Boost expired, deactivate it
    UPDATE public.users
    SET pomodoro_boost_active = false, pomodoro_boost_expires_at = NULL
    WHERE id = p_user_id;
    RAISE NOTICE 'Boost expired, deactivated';
  END IF;

  -- Insert completed pomodoro (returns ID)
  INSERT INTO public.completed_pomodoros (
    user_id,
    discord_id,
    duration_minutes,
    xp_earned,
    task_name,
    notes,
    critical_success,
    completed_at
  ) VALUES (
    p_user_id,
    p_discord_id,
    p_duration_minutes,
    v_final_xp,
    p_task_name,
    p_notes,
    p_critical_success,
    NOW()
  )
  RETURNING id INTO v_pomodoro_id;

  -- Update user totals atomically
  UPDATE public.users
  SET
    total_pomodoros = total_pomodoros + 1,
    total_study_minutes = total_study_minutes + p_duration_minutes,
    xp = xp + v_final_xp,
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
GRANT EXECUTE ON FUNCTION public.atomic_save_completed_pomodoro(UUID, TEXT, INTEGER, INTEGER, TEXT, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atomic_save_completed_pomodoro(UUID, TEXT, INTEGER, INTEGER, TEXT, TEXT, BOOLEAN) TO anon;

-- Update claim_daily_gift to store boost multiplier
CREATE OR REPLACE FUNCTION public.claim_daily_gift(
  p_user_id UUID,
  p_xp_amount INTEGER,
  p_activate_boost BOOLEAN DEFAULT false,
  p_boost_duration_hours INTEGER DEFAULT 24,
  p_boost_multiplier NUMERIC(3,2) DEFAULT 1.25
)
RETURNS JSONB AS $$
DECLARE
  v_auth_user_id UUID;
  v_today TEXT;
  v_last_claim_date TEXT;
  v_new_xp INTEGER;
  v_boost_expires_at BIGINT;
BEGIN
  -- SECURITY: Verify authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Verify the user_id matches the caller's auth_user_id
  SELECT auth_user_id INTO v_auth_user_id
  FROM public.users
  WHERE id = p_user_id;

  IF v_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'User with id % not found', p_user_id;
  END IF;

  IF auth.uid() != v_auth_user_id THEN
    RAISE EXCEPTION 'Unauthorized: Cannot claim gift for another user';
  END IF;

  -- Get today's date in YYYY-MM-DD format
  v_today := TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD');

  -- Check if gift was already claimed today
  SELECT last_daily_gift_date INTO v_last_claim_date
  FROM public.users
  WHERE id = p_user_id;

  IF v_last_claim_date = v_today THEN
    -- Gift already claimed today
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Daily gift already claimed today',
      'already_claimed', true
    );
  END IF;

  -- Calculate boost expiration (duration in hours)
  IF p_activate_boost THEN
    v_boost_expires_at := EXTRACT(EPOCH FROM NOW() + (p_boost_duration_hours || ' hours')::INTERVAL) * 1000;
  ELSE
    v_boost_expires_at := NULL;
  END IF;

  -- Claim the gift: update XP and last_daily_gift_date atomically
  UPDATE public.users
  SET
    xp = xp + p_xp_amount,
    last_daily_gift_date = v_today,
    pomodoro_boost_active = CASE WHEN p_activate_boost THEN true ELSE pomodoro_boost_active END,
    pomodoro_boost_expires_at = CASE WHEN p_activate_boost THEN v_boost_expires_at ELSE pomodoro_boost_expires_at END,
    pomodoro_boost_multiplier = CASE WHEN p_activate_boost THEN p_boost_multiplier ELSE pomodoro_boost_multiplier END,
    updated_at = NOW()
  WHERE id = p_user_id
  RETURNING xp INTO v_new_xp;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Failed to update user data';
  END IF;

  -- Return success with new XP value
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Daily gift claimed successfully',
    'xp_awarded', p_xp_amount,
    'new_xp', v_new_xp,
    'boost_activated', p_activate_boost,
    'boost_expires_at', v_boost_expires_at,
    'boost_multiplier', p_boost_multiplier
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.claim_daily_gift(UUID, INTEGER, BOOLEAN, INTEGER, NUMERIC) TO authenticated;

-- Update Discord version
CREATE OR REPLACE FUNCTION public.claim_daily_gift_discord(
  p_user_id UUID,
  p_discord_id TEXT,
  p_xp_amount INTEGER,
  p_activate_boost BOOLEAN DEFAULT false,
  p_boost_duration_hours INTEGER DEFAULT 24,
  p_boost_multiplier NUMERIC(3,2) DEFAULT 1.25
)
RETURNS JSONB AS $$
DECLARE
  v_today TEXT;
  v_last_claim_date TEXT;
  v_new_xp INTEGER;
  v_boost_expires_at BIGINT;
BEGIN
  -- Verify discord_id ownership
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_user_id AND discord_id = p_discord_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized: discord_id does not match user_id';
  END IF;

  -- Get today's date in YYYY-MM-DD format
  v_today := TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD');

  -- Check if gift was already claimed today
  SELECT last_daily_gift_date INTO v_last_claim_date
  FROM public.users
  WHERE id = p_user_id;

  IF v_last_claim_date = v_today THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Daily gift already claimed today',
      'already_claimed', true
    );
  END IF;

  -- Calculate boost expiration
  IF p_activate_boost THEN
    v_boost_expires_at := EXTRACT(EPOCH FROM NOW() + (p_boost_duration_hours || ' hours')::INTERVAL) * 1000;
  ELSE
    v_boost_expires_at := NULL;
  END IF;

  -- Claim the gift
  UPDATE public.users
  SET
    xp = xp + p_xp_amount,
    last_daily_gift_date = v_today,
    pomodoro_boost_active = CASE WHEN p_activate_boost THEN true ELSE pomodoro_boost_active END,
    pomodoro_boost_expires_at = CASE WHEN p_activate_boost THEN v_boost_expires_at ELSE pomodoro_boost_expires_at END,
    pomodoro_boost_multiplier = CASE WHEN p_activate_boost THEN p_boost_multiplier ELSE pomodoro_boost_multiplier END,
    updated_at = NOW()
  WHERE id = p_user_id
  RETURNING xp INTO v_new_xp;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Failed to update user data';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Daily gift claimed successfully',
    'xp_awarded', p_xp_amount,
    'new_xp', v_new_xp,
    'boost_activated', p_activate_boost,
    'boost_expires_at', v_boost_expires_at,
    'boost_multiplier', p_boost_multiplier
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to anon (for Discord Activity)
GRANT EXECUTE ON FUNCTION public.claim_daily_gift_discord(UUID, TEXT, INTEGER, BOOLEAN, INTEGER, NUMERIC) TO anon;
