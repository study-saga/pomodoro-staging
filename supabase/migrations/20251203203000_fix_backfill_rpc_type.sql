-- Fix type mismatch in backfill_auth_user_id function
-- v_updated was declared as BOOLEAN but used to store ROW_COUNT (integer)

CREATE OR REPLACE FUNCTION public.backfill_auth_user_id(
  p_discord_id TEXT,
  p_auth_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_updated INTEGER; -- Changed from BOOLEAN to INTEGER
  v_jwt_discord_id TEXT;
  v_user_metadata JSONB;
BEGIN
  -- SECURITY: Verify caller is updating their own account
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF auth.uid() != p_auth_user_id THEN
    RAISE EXCEPTION 'Unauthorized: Cannot backfill another user''s auth_user_id';
  END IF;

  -- CRITICAL SECURITY: Verify the discord_id matches the authenticated user's Discord identity
  -- Extract user_metadata from JWT to get the Discord provider ID
  SELECT raw_user_meta_data INTO v_user_metadata
  FROM auth.users
  WHERE id = auth.uid();

  IF v_user_metadata IS NULL THEN
    RAISE EXCEPTION 'User metadata not found';
  END IF;

  -- Try to extract Discord ID from various metadata fields
  v_jwt_discord_id := COALESCE(
    v_user_metadata->>'provider_id',
    v_user_metadata->>'sub',
    auth.uid()::text
  );

  IF v_jwt_discord_id IS NULL OR v_jwt_discord_id != p_discord_id THEN
    RAISE EXCEPTION 'Unauthorized: discord_id does not match authenticated Discord identity (expected: %, got: %)',
      v_jwt_discord_id, p_discord_id;
  END IF;

  -- Update existing user with their auth_user_id
  -- This bypasses RLS (SECURITY DEFINER) but with proper ownership verification
  UPDATE public.users
  SET auth_user_id = p_auth_user_id,
      updated_at = NOW()
  WHERE discord_id = p_discord_id
  AND auth_user_id IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.backfill_auth_user_id(TEXT, UUID) TO authenticated;

COMMENT ON FUNCTION public.backfill_auth_user_id(TEXT, UUID) IS
  'SECURITY DEFINER function to backfill auth_user_id for existing users. Verifies Discord ID ownership via JWT metadata before linking. Bypasses RLS with proper verification.';
