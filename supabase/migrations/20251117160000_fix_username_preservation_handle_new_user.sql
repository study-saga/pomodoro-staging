-- Migration: Fix handle_new_user() to Preserve Custom Usernames
-- Date: 2025-11-17
-- Description: Updates handle_new_user trigger to respect last_username_change column
--              Prevents username overwrite when user has set a custom name
--              Supersedes: 20251117_update_handle_new_user_background.sql (line 66)

-- ============================================================================
-- PROBLEM:
-- The handle_new_user() trigger unconditionally overwrites usernames on web login
-- when a Discord ID conflict occurs. This happens even if the user paid 50 XP
-- to set a custom username.
--
-- Root Cause (line 66 in previous migration):
--   username = EXCLUDED.username,  -- ❌ ALWAYS OVERWRITES
--
-- SOLUTION:
-- Only update username if last_username_change IS NULL (user hasn't customized)
-- If last_username_change is set, preserve the existing username
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_discord_id TEXT;
  v_username TEXT;
  v_avatar TEXT;
BEGIN
  -- Extract Discord ID from metadata (provider uses different fields)
  v_discord_id := COALESCE(
    NEW.raw_user_meta_data->>'provider_id',
    NEW.raw_user_meta_data->>'sub',
    NEW.id::text
  );

  -- Extract username (Discord users may not have full_name)
  -- IMPORTANT: Never use Discord ID in fallback username to protect PII
  v_username := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'user_name',
    NEW.raw_user_meta_data->>'username',
    'Discord User ' || substring(md5(random()::text || clock_timestamp()::text), 1, 8)
  );

  -- Extract avatar URL
  v_avatar := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture'
  );

  -- CRITICAL: Bypass RLS for this insert since trigger has no auth context
  -- This is safe because:
  -- 1. Trigger only fires on auth.users INSERT (controlled by Supabase Auth)
  -- 2. We're creating a profile for the newly created auth user (NEW.id)
  -- 3. Function is SECURITY DEFINER with proper ownership
  SET LOCAL row_security = OFF;

  -- Insert user profile, handling both new users and legacy account linking
  INSERT INTO public.users (
    auth_user_id,
    discord_id,
    username,
    avatar,
    background_id,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    v_discord_id,
    v_username,
    v_avatar,
    'room-video',  -- Set to valid default (desktop default, app will adjust for mobile)
    NOW(),
    NOW()
  )
  ON CONFLICT (discord_id) DO UPDATE SET
    -- Link legacy account if auth_user_id is NULL (user existed before Supabase Auth)
    auth_user_id = CASE
      WHEN users.auth_user_id IS NULL THEN EXCLUDED.auth_user_id
      ELSE users.auth_user_id
    END,
    -- CRITICAL FIX: Only update username if user hasn't customized it
    -- If last_username_change is NULL, they're using their Discord username → safe to update
    -- If last_username_change is set, they've customized it → preserve it!
    username = CASE
      WHEN users.last_username_change IS NULL THEN EXCLUDED.username
      ELSE users.username
    END,
    avatar = EXCLUDED.avatar,
    -- Fix background_id for legacy users who might have invalid values
    background_id = CASE
      WHEN users.background_id IS NULL OR users.background_id = 'default'
           OR users.background_id NOT IN ('road-video', 'room-video', 'eyes-video', 'anime-video', 'forest-video', 'landscape-video')
      THEN 'room-video'
      ELSE users.background_id
    END,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Automatically creates user profile when new auth user signs up via Discord OAuth. Uses SET LOCAL row_security = OFF to bypass RLS since trigger has no auth context. Handles legacy account linking when user previously authenticated via Discord SDK. Sets valid background_id to prevent blank screen on first load. PRESERVES custom usernames (only overwrites if last_username_change IS NULL).';
