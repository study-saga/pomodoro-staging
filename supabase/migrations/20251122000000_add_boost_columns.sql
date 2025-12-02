-- Add missing boost columns for buff system compatibility
-- These columns support both legacy boost system and new active_buffs JSONB

-- ============================================================================
-- 1. ADD BOOST COLUMNS (backwards compatible with legacy code)
-- ============================================================================

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS pomodoro_boost_active BOOLEAN DEFAULT FALSE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS pomodoro_boost_expires_at BIGINT;

COMMENT ON COLUMN public.users.pomodoro_boost_active IS 'Legacy: Whether user has active XP boost. Use active_buffs for new code.';
COMMENT ON COLUMN public.users.pomodoro_boost_expires_at IS 'Legacy: Boost expiration timestamp (ms). Use active_buffs for new code.';

-- ============================================================================
-- 2. ADD ACTIVE_BUFFS JSONB (flexible buff storage)
-- ============================================================================

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS active_buffs JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.users.active_buffs IS
'Flexible buff storage as JSONB. Structure:
{
  "buff_id": {
    "value": 0.25,           -- Buff multiplier (0.25 = +25%)
    "expiresAt": 1732396800000,  -- Unix ms timestamp (null = permanent)
    "metadata": {}           -- Optional extra data
  }
}

Current buff IDs:
- day10_boost: +25% XP for 24h (from day 10 daily gift)
- slingshot_nov22: +25% XP (Nov 22-23 event, elf only)

Future buff IDs (examples):
- weekend_warrior: +15% XP on weekends
- streak_master: +10% XP at 7-day streak
- prestige_bonus: +5% XP per prestige level
- event_*: Time-limited event buffs
';

-- ============================================================================
-- 3. CREATE INDEX FOR JSONB QUERIES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_users_active_buffs ON public.users USING GIN (active_buffs);

-- ============================================================================
-- 4. HELPER FUNCTIONS FOR BUFF MANAGEMENT
-- ============================================================================

-- Set/update a buff
CREATE OR REPLACE FUNCTION public.set_user_buff(
  p_user_id UUID,
  p_buff_id TEXT,
  p_value NUMERIC,
  p_expires_at BIGINT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID AS $$
BEGIN
  -- Verify caller owns this account
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_user_id
      AND (auth_user_id = auth.uid() OR discord_id = auth.uid()::text)
  ) THEN
    RAISE EXCEPTION 'Not authorized to modify buffs for user %', p_user_id;
  END IF;

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

-- Remove a buff
CREATE OR REPLACE FUNCTION public.remove_user_buff(
  p_user_id UUID,
  p_buff_id TEXT
)
RETURNS VOID AS $$
BEGIN
  -- Verify caller owns this account
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_user_id
      AND (auth_user_id = auth.uid() OR discord_id = auth.uid()::text)
  ) THEN
    RAISE EXCEPTION 'Not authorized to modify buffs for user %', p_user_id;
  END IF;

  UPDATE public.users
  SET
    active_buffs = active_buffs - p_buff_id,
    updated_at = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get active buffs (filters expired)
CREATE OR REPLACE FUNCTION public.get_active_buffs(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_buffs JSONB;
  v_result JSONB := '{}'::jsonb;
  v_key TEXT;
  v_buff JSONB;
  v_expires BIGINT;
  v_now BIGINT;
BEGIN
  -- Verify caller owns this account
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_user_id
      AND (auth_user_id = auth.uid() OR discord_id = auth.uid()::text)
  ) THEN
    RAISE EXCEPTION 'Not authorized to read buffs for user %', p_user_id;
  END IF;

  v_now := EXTRACT(EPOCH FROM NOW()) * 1000;

  SELECT active_buffs INTO v_buffs
  FROM public.users WHERE id = p_user_id;

  IF v_buffs IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

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

-- Clear expired buffs
CREATE OR REPLACE FUNCTION public.clear_expired_buffs(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Verify caller owns this account
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_user_id
      AND (auth_user_id = auth.uid() OR discord_id = auth.uid()::text)
  ) THEN
    RAISE EXCEPTION 'Not authorized to modify buffs for user %', p_user_id;
  END IF;

  UPDATE public.users
  SET
    active_buffs = public.get_active_buffs(p_user_id),
    updated_at = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.set_user_buff(UUID, TEXT, NUMERIC, BIGINT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_user_buff(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_buffs(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_expired_buffs(UUID) TO authenticated;
