-- Migration: Add Daily Gift Tracking to Database
-- Ensures daily gift claims are validated server-side and synced across devices

-- ============================================================================
-- 1. ADD DAILY GIFT TRACKING COLUMN
-- ============================================================================

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS last_daily_gift_date TEXT;

COMMENT ON COLUMN public.users.last_daily_gift_date IS 'Last date daily gift was claimed (YYYY-MM-DD format)';

-- ============================================================================
-- 2. CREATE RPC FUNCTION: CLAIM DAILY GIFT (SERVER-SIDE VALIDATION)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.claim_daily_gift(
  p_user_id UUID,
  p_xp_amount INTEGER,
  p_activate_boost BOOLEAN DEFAULT false
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

  -- Calculate boost expiration (24 hours from now in milliseconds)
  IF p_activate_boost THEN
    v_boost_expires_at := EXTRACT(EPOCH FROM NOW() + INTERVAL '24 hours') * 1000;
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
    'boost_expires_at', v_boost_expires_at
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.claim_daily_gift(UUID, INTEGER, BOOLEAN) TO authenticated;

COMMENT ON FUNCTION public.claim_daily_gift IS
  'Atomically claim daily gift with server-side validation.
   Prevents claiming multiple times per day and ensures consistency across devices.
   Returns success status and new XP value.';

-- ============================================================================
-- 3. CREATE HELPER FUNCTION: CHECK IF GIFT CAN BE CLAIMED
-- ============================================================================

CREATE OR REPLACE FUNCTION public.can_claim_daily_gift(
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_auth_user_id UUID;
  v_today TEXT;
  v_last_claim_date TEXT;
BEGIN
  -- SECURITY: Verify authentication
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  -- Verify the user_id matches the caller's auth_user_id
  SELECT auth_user_id INTO v_auth_user_id
  FROM public.users
  WHERE id = p_user_id;

  IF v_auth_user_id IS NULL OR auth.uid() != v_auth_user_id THEN
    RETURN false;
  END IF;

  -- Get today's date in YYYY-MM-DD format
  v_today := TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD');

  -- Check if gift was already claimed today
  SELECT last_daily_gift_date INTO v_last_claim_date
  FROM public.users
  WHERE id = p_user_id;

  -- Can claim if never claimed before OR last claim was not today
  RETURN (v_last_claim_date IS NULL OR v_last_claim_date != v_today);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.can_claim_daily_gift(UUID) TO authenticated;

COMMENT ON FUNCTION public.can_claim_daily_gift IS
  'Check if user can claim daily gift today.
   Returns true if gift has not been claimed today, false otherwise.';
