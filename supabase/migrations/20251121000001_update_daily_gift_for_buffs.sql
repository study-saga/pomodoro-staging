-- Update daily gift RPC functions to write to new buff system
-- Integrates with active_buffs JSONB column for day 10 boost

/**
 * UPDATE claim_daily_gift_xp (Web Mode)
 * Now writes day10 boost to active_buffs when granting day 10 gift
 */
CREATE OR REPLACE FUNCTION public.claim_daily_gift_xp(
  p_user_id UUID
)
RETURNS TABLE(
  success BOOLEAN,
  xp_awarded INTEGER,
  consecutive_days INTEGER,
  boost_activated BOOLEAN,
  boost_expires_at BIGINT
) AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_last_login DATE;
  v_consecutive INTEGER;
  v_xp INTEGER;
  v_new_consecutive INTEGER;
  v_boost_expires_at BIGINT;
  v_is_day_10 BOOLEAN := FALSE;
BEGIN
  -- SECURITY: Verify user owns this account
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_user_id AND auth_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Get current state
  SELECT last_login_date, consecutive_login_days
  INTO v_last_login, v_consecutive
  FROM public.users WHERE id = p_user_id;

  -- Already claimed today - reject
  IF v_last_login = v_today THEN
    RETURN QUERY SELECT FALSE, 0, v_consecutive, FALSE, NULL::BIGINT;
    RETURN;
  END IF;

  -- Calculate new streak (restarts after day 10)
  IF v_consecutive >= 10 THEN
    v_new_consecutive := 1;  -- Restart cycle
  ELSE
    v_new_consecutive := COALESCE(v_consecutive, 0) + 1;
  END IF;

  -- Check if this is day 10 (activates boost)
  v_is_day_10 := (v_new_consecutive = 10);

  -- Calculate XP (100 on day 10, else 50)
  v_xp := CASE WHEN v_is_day_10 THEN 100 ELSE 50 END;

  -- Calculate boost expiration (24 hours from now) if day 10
  IF v_is_day_10 THEN
    v_boost_expires_at := EXTRACT(EPOCH FROM (NOW() + INTERVAL '24 hours')) * 1000;
  END IF;

  -- Atomic update
  UPDATE public.users SET
    xp = xp + v_xp,
    last_login_date = v_today,
    consecutive_login_days = v_new_consecutive,
    total_login_days = total_login_days + 1,
    -- Legacy boost fields (backwards compatibility)
    pomodoro_boost_active = v_is_day_10,
    pomodoro_boost_expires_at = CASE WHEN v_is_day_10 THEN v_boost_expires_at ELSE NULL END,
    -- NEW: Write to active_buffs using set_user_buff
    active_buffs = CASE
      WHEN v_is_day_10 THEN
        COALESCE(active_buffs, '{}'::jsonb) || jsonb_build_object(
          'day10_boost',
          jsonb_build_object(
            'value', 0.25,
            'expires_at', v_boost_expires_at,
            'metadata', jsonb_build_object('claimedAt', EXTRACT(EPOCH FROM NOW()) * 1000)
          )
        )
      ELSE active_buffs
    END,
    updated_at = NOW()
  WHERE id = p_user_id;

  RETURN QUERY SELECT TRUE, v_xp, v_new_consecutive, v_is_day_10, v_boost_expires_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/**
 * UPDATE claim_daily_gift_xp_discord (Discord Mode)
 * Now writes day10 boost to active_buffs when granting day 10 gift
 */
CREATE OR REPLACE FUNCTION public.claim_daily_gift_xp_discord(
  p_discord_id TEXT
)
RETURNS TABLE(
  success BOOLEAN,
  xp_awarded INTEGER,
  consecutive_days INTEGER,
  boost_activated BOOLEAN,
  boost_expires_at BIGINT
) AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_last_login DATE;
  v_consecutive INTEGER;
  v_xp INTEGER;
  v_new_consecutive INTEGER;
  v_boost_expires_at BIGINT;
  v_is_day_10 BOOLEAN := FALSE;
BEGIN
  -- Get current state
  SELECT last_login_date, consecutive_login_days
  INTO v_last_login, v_consecutive
  FROM public.users WHERE discord_id = p_discord_id;

  -- User not found
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Already claimed today - reject
  IF v_last_login = v_today THEN
    RETURN QUERY SELECT FALSE, 0, v_consecutive, FALSE, NULL::BIGINT;
    RETURN;
  END IF;

  -- Calculate new streak (restarts after day 10)
  IF v_consecutive >= 10 THEN
    v_new_consecutive := 1;  -- Restart cycle
  ELSE
    v_new_consecutive := COALESCE(v_consecutive, 0) + 1;
  END IF;

  -- Check if this is day 10 (activates boost)
  v_is_day_10 := (v_new_consecutive = 10);

  -- Calculate XP (100 on day 10, else 50)
  v_xp := CASE WHEN v_is_day_10 THEN 100 ELSE 50 END;

  -- Calculate boost expiration (24 hours from now) if day 10
  IF v_is_day_10 THEN
    v_boost_expires_at := EXTRACT(EPOCH FROM (NOW() + INTERVAL '24 hours')) * 1000;
  END IF;

  -- Atomic update
  UPDATE public.users SET
    xp = xp + v_xp,
    last_login_date = v_today,
    consecutive_login_days = v_new_consecutive,
    total_login_days = total_login_days + 1,
    -- Legacy boost fields (backwards compatibility)
    pomodoro_boost_active = v_is_day_10,
    pomodoro_boost_expires_at = CASE WHEN v_is_day_10 THEN v_boost_expires_at ELSE NULL END,
    -- NEW: Write to active_buffs
    active_buffs = CASE
      WHEN v_is_day_10 THEN
        COALESCE(active_buffs, '{}'::jsonb) || jsonb_build_object(
          'day10_boost',
          jsonb_build_object(
            'value', 0.25,
            'expires_at', v_boost_expires_at,
            'metadata', jsonb_build_object('claimedAt', EXTRACT(EPOCH FROM NOW()) * 1000)
          )
        )
      ELSE active_buffs
    END,
    updated_at = NOW()
  WHERE discord_id = p_discord_id;

  RETURN QUERY SELECT TRUE, v_xp, v_new_consecutive, v_is_day_10, v_boost_expires_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.claim_daily_gift_xp IS
  'Claim daily login gift with server-side validation (Web mode).
   Grants XP, updates streak, and activates day10 boost in new buff system.';

COMMENT ON FUNCTION public.claim_daily_gift_xp_discord IS
  'Claim daily login gift with server-side validation (Discord mode).
   Grants XP, updates streak, and activates day10 boost in new buff system.';
