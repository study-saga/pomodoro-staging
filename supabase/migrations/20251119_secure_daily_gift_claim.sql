-- Secure daily gift claim with server-side validation
-- Prevents XP exploit from repeated page reloads

-- Web Mode: Uses Supabase Auth (auth.uid())
CREATE OR REPLACE FUNCTION public.claim_daily_gift_xp(
  p_user_id UUID
)
RETURNS TABLE(success BOOLEAN, xp_awarded INTEGER, consecutive_days INTEGER) AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_last_login DATE;
  v_consecutive INTEGER;
  v_xp INTEGER;
  v_new_consecutive INTEGER;
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
    RETURN QUERY SELECT FALSE, 0, v_consecutive;
    RETURN;
  END IF;

  -- Calculate new streak (continues on missed days, restarts after day 10)
  IF v_consecutive >= 10 THEN
    v_new_consecutive := 1;  -- Restart cycle
  ELSE
    v_new_consecutive := COALESCE(v_consecutive, 0) + 1;
  END IF;

  -- Calculate XP (100 on day 10, else 50)
  v_xp := CASE WHEN v_new_consecutive = 10 THEN 100 ELSE 50 END;

  -- Atomic update
  UPDATE public.users SET
    xp = xp + v_xp,
    last_login_date = v_today,
    consecutive_login_days = v_new_consecutive,
    total_login_days = total_login_days + 1,
    updated_at = NOW()
  WHERE id = p_user_id;

  RETURN QUERY SELECT TRUE, v_xp, v_new_consecutive;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Discord Activity Mode: Uses discord_id
CREATE OR REPLACE FUNCTION public.claim_daily_gift_xp_discord(
  p_discord_id TEXT
)
RETURNS TABLE(success BOOLEAN, xp_awarded INTEGER, consecutive_days INTEGER) AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_last_login DATE;
  v_consecutive INTEGER;
  v_xp INTEGER;
  v_new_consecutive INTEGER;
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
    RETURN QUERY SELECT FALSE, 0, v_consecutive;
    RETURN;
  END IF;

  -- Calculate new streak (continues on missed days, restarts after day 10)
  IF v_consecutive >= 10 THEN
    v_new_consecutive := 1;  -- Restart cycle
  ELSE
    v_new_consecutive := COALESCE(v_consecutive, 0) + 1;
  END IF;

  -- Calculate XP (100 on day 10, else 50)
  v_xp := CASE WHEN v_new_consecutive = 10 THEN 100 ELSE 50 END;

  -- Atomic update
  UPDATE public.users SET
    xp = xp + v_xp,
    last_login_date = v_today,
    consecutive_login_days = v_new_consecutive,
    total_login_days = total_login_days + 1,
    updated_at = NOW()
  WHERE discord_id = p_discord_id;

  RETURN QUERY SELECT TRUE, v_xp, v_new_consecutive;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
