-- Migration: Fix sync_discord_user_data to preserve custom usernames
-- Date: 2025-11-13
-- Description: Prevents Discord username from overwriting custom usernames on login

-- ============================================================================
-- PROBLEM:
-- The sync_discord_user_data function was unconditionally overwriting usernames
-- with the Discord username every time a user logged in, even if they had set
-- a custom username and paid 50 XP for it.
--
-- SOLUTION:
-- Only update username to Discord username if the user has NOT set a custom one
-- (i.e., last_username_change IS NULL).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_discord_user_data(
  p_auth_user_id UUID,
  p_discord_id TEXT,
  p_username TEXT,
  p_avatar TEXT
)
RETURNS public.users AS $$
DECLARE
  v_user public.users;
BEGIN
  -- SECURITY: Verify caller is updating their own profile
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'auth_user_id cannot be NULL';
  END IF;

  IF auth.uid() != p_auth_user_id THEN
    RAISE EXCEPTION 'Unauthorized: Cannot update another user''s profile';
  END IF;

  -- Upsert user data
  INSERT INTO public.users (
    auth_user_id,
    discord_id,
    username,
    avatar,
    last_login,
    updated_at
  ) VALUES (
    p_auth_user_id,
    p_discord_id,
    p_username,
    p_avatar,
    NOW(),
    NOW()
  )
  ON CONFLICT (discord_id)
  DO UPDATE SET
    -- Only update auth_user_id if it's currently NULL (prevent account hijacking)
    auth_user_id = CASE
      WHEN users.auth_user_id IS NULL THEN EXCLUDED.auth_user_id
      ELSE users.auth_user_id
    END,
    -- CRITICAL FIX: Only update username if user hasn't set a custom one
    -- If last_username_change is NULL, they're using their Discord username
    -- If last_username_change is set, they've customized it - don't overwrite!
    username = CASE
      WHEN users.last_username_change IS NULL THEN EXCLUDED.username
      ELSE users.username
    END,
    avatar = EXCLUDED.avatar,
    last_login = EXCLUDED.last_login,
    updated_at = EXCLUDED.updated_at
  RETURNING * INTO v_user;

  -- Update login streak
  -- (streak logic handled by application)

  RETURN v_user;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment explaining the fix
COMMENT ON FUNCTION public.sync_discord_user_data IS
  'Syncs Discord profile data on login. Preserves custom usernames (only overwrites if last_username_change IS NULL).';
