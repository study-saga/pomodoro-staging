-- Buff System Migration
-- Adds JSONB column to track active time-limited buffs per user

-- ============================================================================
-- 1. ADD ACTIVE BUFFS COLUMN
-- ============================================================================

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS active_buffs JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.users.active_buffs IS
  'Active time-limited buffs in JSONB format.
   Structure: {
     "buff_id": {
       "expires_at": 1732223400000,  -- Unix timestamp in milliseconds (null = permanent)
       "value": 0.25,                 -- Buff value (e.g., 0.25 = +25%)
       "metadata": {}                 -- Optional extra data
     }
   }

   Example:
   {
     "day10_boost": {"expires_at": 1732223400000, "value": 0.25},
     "slingshot_nov22": {"expires_at": null, "value": 0.25}
   }';

-- ============================================================================
-- 2. HELPER FUNCTION: GET ACTIVE BUFFS (FILTERS EXPIRED)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_active_buffs(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_buffs JSONB;
  v_buff_key TEXT;
  v_buff_data JSONB;
  v_expires_at BIGINT;
  v_now BIGINT;
  v_active_buffs JSONB := '{}'::jsonb;
BEGIN
  -- Get current timestamp in milliseconds
  v_now := EXTRACT(EPOCH FROM NOW()) * 1000;

  -- Get user's buffs
  SELECT active_buffs INTO v_buffs
  FROM public.users
  WHERE id = p_user_id;

  -- If no buffs, return empty object
  IF v_buffs IS NULL OR v_buffs = '{}'::jsonb THEN
    RETURN '{}'::jsonb;
  END IF;

  -- Filter out expired buffs
  FOR v_buff_key IN SELECT jsonb_object_keys(v_buffs)
  LOOP
    v_buff_data := v_buffs -> v_buff_key;
    v_expires_at := (v_buff_data ->> 'expires_at')::BIGINT;

    -- Keep buff if no expiration or not yet expired
    IF v_expires_at IS NULL OR v_expires_at > v_now THEN
      v_active_buffs := v_active_buffs || jsonb_build_object(v_buff_key, v_buff_data);
    END IF;
  END LOOP;

  RETURN v_active_buffs;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.get_active_buffs IS
  'Returns only active (non-expired) buffs for a user.
   Filters out expired buffs based on current timestamp.';

-- ============================================================================
-- 3. HELPER FUNCTION: ADD/UPDATE BUFF
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_user_buff(
  p_user_id UUID,
  p_buff_id TEXT,
  p_value NUMERIC,
  p_expires_at BIGINT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID AS $$
DECLARE
  v_buff_data JSONB;
BEGIN
  -- Verify caller owns this account
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_user_id
      AND (auth_user_id = auth.uid() OR discord_id = auth.uid()::text)
  ) THEN
    RAISE EXCEPTION 'Not authorized to modify buffs for user %', p_user_id;
  END IF;

  -- Build buff data
  v_buff_data := jsonb_build_object(
    'value', p_value,
    'expires_at', p_expires_at,
    'metadata', p_metadata
  );

  -- Update user's active_buffs by merging in the new buff
  UPDATE public.users
  SET
    active_buffs = COALESCE(active_buffs, '{}'::jsonb) || jsonb_build_object(p_buff_id, v_buff_data),
    updated_at = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.set_user_buff IS
  'Add or update a buff for a user.
   If buff already exists, it will be replaced.

   Parameters:
   - p_user_id: User UUID
   - p_buff_id: Buff identifier (e.g., "slingshot_nov22")
   - p_value: Buff value (e.g., 0.25 for +25%)
   - p_expires_at: Expiration timestamp in milliseconds (NULL = permanent)
   - p_metadata: Optional metadata as JSONB';

-- ============================================================================
-- 4. HELPER FUNCTION: REMOVE BUFF
-- ============================================================================

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

COMMENT ON FUNCTION public.remove_user_buff IS
  'Remove a specific buff from a user.';

-- ============================================================================
-- 5. HELPER FUNCTION: CLEAR EXPIRED BUFFS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.clear_expired_buffs(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_active_buffs JSONB;
BEGIN
  -- Verify caller owns this account
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_user_id
      AND (auth_user_id = auth.uid() OR discord_id = auth.uid()::text)
  ) THEN
    RAISE EXCEPTION 'Not authorized to modify buffs for user %', p_user_id;
  END IF;

  -- Get active buffs (already filters expired)
  v_active_buffs := public.get_active_buffs(p_user_id);

  -- Update user with only active buffs
  UPDATE public.users
  SET
    active_buffs = v_active_buffs,
    updated_at = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.clear_expired_buffs IS
  'Remove all expired buffs from user.
   Should be called periodically or before XP calculations.';

-- ============================================================================
-- 6. MIGRATE EXISTING BOOST DATA
-- ============================================================================

-- Migrate existing pomodoro_boost_active to new buff system
DO $$
DECLARE
  v_user RECORD;
  v_now BIGINT;
BEGIN
  v_now := EXTRACT(EPOCH FROM NOW()) * 1000;

  FOR v_user IN
    SELECT id, pomodoro_boost_expires_at
    FROM public.users
    WHERE pomodoro_boost_active = true
      AND pomodoro_boost_expires_at IS NOT NULL
      AND pomodoro_boost_expires_at > v_now
  LOOP
    -- Add day10_boost to active_buffs
    PERFORM public.set_user_buff(
      v_user.id,
      'day10_boost',
      0.25,
      v_user.pomodoro_boost_expires_at,
      '{}'::jsonb
    );
  END LOOP;

  RAISE NOTICE 'Migrated % active boosts to new buff system',
    (SELECT COUNT(*) FROM public.users WHERE pomodoro_boost_active = true);
END $$;

-- ============================================================================
-- 7. GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.get_active_buffs(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_buff(UUID, TEXT, NUMERIC, BIGINT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_user_buff(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_expired_buffs(UUID) TO authenticated;

-- ============================================================================
-- 8. CREATE INDEX FOR PERFORMANCE
-- ============================================================================

-- GIN index for JSONB queries
CREATE INDEX IF NOT EXISTS idx_users_active_buffs ON public.users USING GIN (active_buffs);

COMMENT ON INDEX idx_users_active_buffs IS
  'GIN index for efficient JSONB queries on active_buffs column.';
