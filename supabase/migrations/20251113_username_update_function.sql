-- Migration: Add username update function with XP cost and cooldown validation
-- Date: 2025-11-13
-- Description: Creates a secure function to update username with server-side validation

-- ============================================================================
-- FUNCTION: update_username
-- ============================================================================
-- Securely updates a user's username with proper validation:
-- - Validates user ownership
-- - Enforces 7-day cooldown (or 50 XP cost to skip)
-- - Atomically deducts XP if forcing early change
-- - Updates username and timestamp together
--
-- This prevents users from:
-- - Bypassing XP cost by calling update_user_settings directly
-- - Changing username without cooldown
-- - Race conditions between XP deduction and username update

CREATE OR REPLACE FUNCTION public.update_username(
  p_user_id UUID,
  p_new_username TEXT,
  p_force_with_xp BOOLEAN DEFAULT FALSE
)
RETURNS public.users AS $$
DECLARE
  v_user public.users;
  v_cooldown_ms BIGINT := 604800000; -- 7 days in milliseconds
  v_xp_cost INTEGER := 50;
  v_time_since_change BIGINT;
BEGIN
  -- SECURITY: Verify caller owns this user profile
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Fetch current user data
  SELECT * INTO v_user
  FROM public.users
  WHERE id = p_user_id AND auth_user_id = auth.uid();

  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Cannot update another user''s username';
  END IF;

  -- Validate username (basic checks)
  IF p_new_username IS NULL OR LENGTH(TRIM(p_new_username)) = 0 THEN
    RAISE EXCEPTION 'Username cannot be empty';
  END IF;

  IF LENGTH(p_new_username) > 20 THEN
    RAISE EXCEPTION 'Username cannot exceed 20 characters';
  END IF;

  -- Check if cooldown has passed
  IF v_user.last_username_change IS NOT NULL THEN
    v_time_since_change := EXTRACT(EPOCH FROM (NOW() - v_user.last_username_change)) * 1000;

    IF v_time_since_change < v_cooldown_ms THEN
      -- Cooldown hasn't passed
      IF p_force_with_xp THEN
        -- User wants to force change with XP
        IF v_user.xp < v_xp_cost THEN
          RAISE EXCEPTION 'Insufficient XP: Need % XP to change username early (you have %)', v_xp_cost, v_user.xp;
        END IF;

        -- Deduct XP and update username (atomic transaction)
        UPDATE public.users
        SET
          username = p_new_username,
          xp = xp - v_xp_cost,
          last_username_change = NOW(),
          updated_at = NOW()
        WHERE id = p_user_id
        RETURNING * INTO v_user;

        RETURN v_user;
      ELSE
        -- User trying to change without XP, but cooldown hasn't passed
        RAISE EXCEPTION 'Username change is on cooldown. Wait % more hours or pay % XP',
          ROUND((v_cooldown_ms - v_time_since_change) / 3600000.0, 1),
          v_xp_cost;
      END IF;
    END IF;
  END IF;

  -- Cooldown has passed (or first time changing) - free username change
  UPDATE public.users
  SET
    username = p_new_username,
    last_username_change = NOW(),
    updated_at = NOW()
  WHERE id = p_user_id
  RETURNING * INTO v_user;

  RETURN v_user;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment
COMMENT ON FUNCTION public.update_username IS
  'Securely updates username with 7-day cooldown or 50 XP cost. Validates ownership and enforces XP deduction atomically.';

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.update_username TO authenticated;
