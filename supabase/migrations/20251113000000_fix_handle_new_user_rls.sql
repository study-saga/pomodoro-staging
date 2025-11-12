-- Fix: handle_new_user trigger blocked by RLS
-- The trigger needs to bypass RLS because it has no auth context (auth.uid() is NULL)

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
  v_username := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'user_name',
    NEW.raw_user_meta_data->>'username',
    'Discord User ' || substring(v_discord_id, 1, 8)
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
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    v_discord_id,
    v_username,
    v_avatar,
    NOW(),
    NOW()
  )
  ON CONFLICT (discord_id) DO UPDATE SET
    -- Link legacy account if auth_user_id is NULL (user existed before Supabase Auth)
    auth_user_id = CASE
      WHEN users.auth_user_id IS NULL THEN EXCLUDED.auth_user_id
      ELSE users.auth_user_id
    END,
    username = EXCLUDED.username,
    avatar = EXCLUDED.avatar,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Automatically creates user profile when new auth user signs up via Discord OAuth. Uses SET LOCAL row_security = OFF to bypass RLS since trigger has no auth context. Handles legacy account linking when user previously authenticated via Discord SDK.';
