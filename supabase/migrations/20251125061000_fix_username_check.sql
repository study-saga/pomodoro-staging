-- Migration: Fix username availability check and enforce uniqueness
-- Date: 2025-11-25
-- Description: Adds a secure RPC to check username availability (bypassing RLS)
--              and ensures update functions enforce uniqueness.

-- ============================================================================
-- FUNCTION: check_username_availability
-- ============================================================================
-- Checks if a username is taken by ANY user.
-- Uses SECURITY DEFINER to bypass RLS (since users can't see other users).

CREATE OR REPLACE FUNCTION public.check_username_availability(p_username TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Case-insensitive check
  SELECT COUNT(*) INTO v_count
  FROM public.users
  WHERE LOWER(username) = LOWER(TRIM(p_username));
  
  RETURN v_count = 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.check_username_availability(TEXT) TO anon, authenticated;

-- ============================================================================
-- FUNCTION: update_username (Web Mode)
-- ============================================================================
-- Re-applying to ensure uniqueness check is active

CREATE OR REPLACE FUNCTION public.update_username(
  p_user_id UUID,
  p_new_username TEXT,
  p_force_with_xp BOOLEAN DEFAULT FALSE
)
RETURNS public.users AS $$
DECLARE
  v_user public.users;
  v_existing_user public.users;
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

  -- Check for uniqueness (case-insensitive)
  -- Exclude current user from check
  SELECT * INTO v_existing_user
  FROM public.users
  WHERE LOWER(username) = LOWER(TRIM(p_new_username))
    AND id != p_user_id
  LIMIT 1;

  IF v_existing_user IS NOT NULL THEN
    RAISE EXCEPTION 'Username is already taken';
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
          username = TRIM(p_new_username),
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
    username = TRIM(p_new_username),
    last_username_change = NOW(),
    updated_at = NOW()
  WHERE id = p_user_id
  RETURNING * INTO v_user;

  RETURN v_user;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: update_username_discord (Discord Activity Mode)
-- ============================================================================
-- Re-applying to ensure uniqueness check is active

CREATE OR REPLACE FUNCTION public.update_username_discord(
  p_discord_id TEXT,
  p_new_username TEXT,
  p_force_with_xp BOOLEAN DEFAULT FALSE
)
RETURNS public.users AS $$
DECLARE
  v_user public.users;
  v_existing_user public.users;
  v_cooldown_ms BIGINT := 604800000; -- 7 days in milliseconds
  v_xp_cost INTEGER := 50;
  v_time_since_change BIGINT;
BEGIN
  -- SECURITY: Fetch user by Discord ID
  SELECT * INTO v_user
  FROM public.users
  WHERE discord_id = p_discord_id;

  IF v_user IS NULL THEN
    RAISE EXCEPTION 'User not found for Discord ID: %', p_discord_id;
  END IF;

  -- Validate username (basic checks)
  IF p_new_username IS NULL OR LENGTH(TRIM(p_new_username)) = 0 THEN
    RAISE EXCEPTION 'Username cannot be empty';
  END IF;

  IF LENGTH(p_new_username) > 20 THEN
    RAISE EXCEPTION 'Username cannot exceed 20 characters';
  END IF;

  -- Check for uniqueness (case-insensitive)
  -- Exclude current user from check
  SELECT * INTO v_existing_user
  FROM public.users
  WHERE LOWER(username) = LOWER(TRIM(p_new_username))
    AND discord_id != p_discord_id
  LIMIT 1;

  IF v_existing_user IS NOT NULL THEN
    RAISE EXCEPTION 'Username is already taken';
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
          username = TRIM(p_new_username),
          xp = xp - v_xp_cost,
          last_username_change = NOW(),
          updated_at = NOW()
        WHERE discord_id = p_discord_id
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
    username = TRIM(p_new_username),
    last_username_change = NOW(),
    updated_at = NOW()
  WHERE discord_id = p_discord_id
  RETURNING * INTO v_user;

  RETURN v_user;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
