-- Migration: Add Discord-compatible daily gift claim function
-- Allows Discord Activity users to claim daily gifts (they don't have auth.uid())

-- ============================================================================
-- CREATE RPC FUNCTION: CLAIM DAILY GIFT (DISCORD MODE)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.claim_daily_gift_discord(
  p_user_id UUID,
  p_discord_id TEXT,
  p_xp_amount INTEGER,
  p_activate_boost BOOLEAN DEFAULT false
)
RETURNS JSONB AS $$
DECLARE
  v_discord_id TEXT;
  v_today TEXT;
  v_last_claim_date TEXT;
  v_new_xp INTEGER;
  v_boost_expires_at BIGINT;
BEGIN
  -- SECURITY: Verify discord_id matches the user
  SELECT discord_id INTO v_discord_id
  FROM public.users
  WHERE id = p_user_id;

  IF v_discord_id IS NULL THEN
    RAISE EXCEPTION 'User with id % not found', p_user_id;
  END IF;

  IF v_discord_id != p_discord_id THEN
    RAISE EXCEPTION 'Unauthorized: discord_id mismatch';
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

-- Grant execute to all users (authenticated by discord_id check)
GRANT EXECUTE ON FUNCTION public.claim_daily_gift_discord(UUID, TEXT, INTEGER, BOOLEAN) TO anon, authenticated;

COMMENT ON FUNCTION public.claim_daily_gift_discord(UUID, TEXT, INTEGER, BOOLEAN) IS
  'Atomically claim daily gift for Discord Activity users.
   Uses discord_id for authentication instead of auth.uid().
   Prevents claiming multiple times per day and ensures consistency across devices.';

-- ============================================================================
-- CREATE HELPER FUNCTION: CHECK IF GIFT CAN BE CLAIMED (DISCORD MODE)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.can_claim_daily_gift_discord(
  p_user_id UUID,
  p_discord_id TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_discord_id TEXT;
  v_today TEXT;
  v_last_claim_date TEXT;
BEGIN
  -- SECURITY: Verify discord_id matches the user
  SELECT discord_id INTO v_discord_id
  FROM public.users
  WHERE id = p_user_id;

  IF v_discord_id IS NULL OR v_discord_id != p_discord_id THEN
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

-- Grant execute to all users (authenticated by discord_id check)
GRANT EXECUTE ON FUNCTION public.can_claim_daily_gift_discord(UUID, TEXT) TO anon, authenticated;

COMMENT ON FUNCTION public.can_claim_daily_gift_discord IS
  'Check if Discord Activity user can claim daily gift today.
   Uses discord_id for authentication instead of auth.uid().
   Returns true if gift has not been claimed today, false otherwise.';
