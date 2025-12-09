-- Add Discord-specific buff management functions (dual-auth pattern)
-- These functions accept p_discord_id TEXT and validate against stored discord_id
-- Used by Discord Activity embedded app (auth.uid() is unreliable for Discord users)

-- ============================================================================
-- 1. SET USER BUFF (DISCORD)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_user_buff_discord(
  p_user_id UUID,
  p_discord_id TEXT,
  p_buff_id TEXT,
  p_value NUMERIC,
  p_expires_at BIGINT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID AS $$
DECLARE
  v_discord_id TEXT;
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

  -- Set/update buff
  UPDATE public.users
  SET
    active_buffs = COALESCE(active_buffs, '{}'::jsonb) || jsonb_build_object(
      p_buff_id,
      jsonb_build_object(
        'value', p_value,
        'expiresAt', p_expires_at,
        'metadata', p_metadata
      )
    ),
    updated_at = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 2. REMOVE USER BUFF (DISCORD)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.remove_user_buff_discord(
  p_user_id UUID,
  p_discord_id TEXT,
  p_buff_id TEXT
)
RETURNS VOID AS $$
DECLARE
  v_discord_id TEXT;
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

  -- Remove buff
  UPDATE public.users
  SET
    active_buffs = active_buffs - p_buff_id,
    updated_at = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. GET ACTIVE BUFFS (DISCORD)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_active_buffs_discord(
  p_user_id UUID,
  p_discord_id TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_discord_id TEXT;
  v_buffs JSONB;
  v_result JSONB := '{}'::jsonb;
  v_key TEXT;
  v_buff JSONB;
  v_expires BIGINT;
  v_now BIGINT;
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

  -- Get current timestamp
  v_now := EXTRACT(EPOCH FROM NOW()) * 1000;

  -- Get user's active buffs
  SELECT active_buffs INTO v_buffs
  FROM public.users WHERE id = p_user_id;

  IF v_buffs IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  -- Filter expired buffs
  FOR v_key IN SELECT jsonb_object_keys(v_buffs)
  LOOP
    v_buff := v_buffs -> v_key;
    v_expires := (v_buff ->> 'expiresAt')::BIGINT;

    -- Keep if no expiration or not yet expired
    IF v_expires IS NULL OR v_expires > v_now THEN
      v_result := v_result || jsonb_build_object(v_key, v_buff);
    END IF;
  END LOOP;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. CLEAR EXPIRED BUFFS (DISCORD)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.clear_expired_buffs_discord(
  p_user_id UUID,
  p_discord_id TEXT
)
RETURNS VOID AS $$
DECLARE
  v_discord_id TEXT;
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

  -- Clear expired buffs (reuses get_active_buffs_discord logic)
  UPDATE public.users
  SET
    active_buffs = public.get_active_buffs_discord(p_user_id, p_discord_id),
    updated_at = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.set_user_buff_discord(UUID, TEXT, TEXT, NUMERIC, BIGINT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_user_buff_discord(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_buffs_discord(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_expired_buffs_discord(UUID, TEXT) TO authenticated;
