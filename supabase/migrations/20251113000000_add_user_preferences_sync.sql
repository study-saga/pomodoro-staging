-- Migration: Add User Preferences for Cross-Device Sync
-- This migration adds missing user preference fields to enable full cross-device synchronization
-- All user settings will be stored in the database instead of localStorage

-- ============================================================================
-- 1. ADD TIMER PREFERENCES TO USERS TABLE
-- ============================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS timer_pomodoro_minutes INTEGER DEFAULT 25 CHECK (timer_pomodoro_minutes > 0),
  ADD COLUMN IF NOT EXISTS timer_short_break_minutes INTEGER DEFAULT 5 CHECK (timer_short_break_minutes > 0),
  ADD COLUMN IF NOT EXISTS timer_long_break_minutes INTEGER DEFAULT 15 CHECK (timer_long_break_minutes > 0),
  ADD COLUMN IF NOT EXISTS pomodoros_before_long_break INTEGER DEFAULT 4 CHECK (pomodoros_before_long_break > 0),
  ADD COLUMN IF NOT EXISTS auto_start_breaks BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_start_pomodoros BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.users.timer_pomodoro_minutes IS 'Custom pomodoro duration in minutes (default: 25)';
COMMENT ON COLUMN public.users.timer_short_break_minutes IS 'Short break duration in minutes (default: 5)';
COMMENT ON COLUMN public.users.timer_long_break_minutes IS 'Long break duration in minutes (default: 15)';
COMMENT ON COLUMN public.users.pomodoros_before_long_break IS 'Number of pomodoros before triggering long break (default: 4)';
COMMENT ON COLUMN public.users.auto_start_breaks IS 'Automatically start break timers after pomodoro completion';
COMMENT ON COLUMN public.users.auto_start_pomodoros IS 'Automatically start next pomodoro after break completion';

-- ============================================================================
-- 2. ADD VISUAL/UI PREFERENCES TO USERS TABLE
-- ============================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS background_id TEXT DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS playlist TEXT DEFAULT 'lofi' CHECK (playlist IN ('lofi', 'synthwave')),
  ADD COLUMN IF NOT EXISTS ambient_volumes JSONB DEFAULT '{}';

COMMENT ON COLUMN public.users.background_id IS 'Selected background image identifier';
COMMENT ON COLUMN public.users.playlist IS 'Music playlist selection (lofi or synthwave)';
COMMENT ON COLUMN public.users.ambient_volumes IS 'JSON object storing volume levels for each ambient sound';

-- ============================================================================
-- 3. ADD USERNAME CHANGE TRACKING
-- ============================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS last_username_change TIMESTAMPTZ;

COMMENT ON COLUMN public.users.last_username_change IS 'Timestamp of last username change (for cooldown enforcement)';

-- ============================================================================
-- 4. CREATE USER_UNLOCKED_REWARDS TABLE FOR MILESTONE SYSTEM
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_unlocked_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reward_type TEXT NOT NULL CHECK (reward_type IN ('background', 'theme', 'badge', 'playlist')),
  unlock_id TEXT NOT NULL,
  milestone_id TEXT,
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate unlocks
  UNIQUE(user_id, reward_type, unlock_id)
);

COMMENT ON TABLE public.user_unlocked_rewards IS 'Tracks rewards (backgrounds, badges, themes) unlocked by users through milestones';
COMMENT ON COLUMN public.user_unlocked_rewards.reward_type IS 'Type of reward: background, theme, badge, or playlist';
COMMENT ON COLUMN public.user_unlocked_rewards.unlock_id IS 'Identifier for the specific reward (e.g., "ocean-waves", "dark-forest")';
COMMENT ON COLUMN public.user_unlocked_rewards.milestone_id IS 'Reference to milestone that unlocked this reward';

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_user_unlocked_rewards_user_id ON public.user_unlocked_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_user_unlocked_rewards_reward_type ON public.user_unlocked_rewards(user_id, reward_type);

-- ============================================================================
-- 5. ROW LEVEL SECURITY POLICIES FOR USER_UNLOCKED_REWARDS
-- ============================================================================

-- Enable RLS
ALTER TABLE public.user_unlocked_rewards ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own unlocked rewards
CREATE POLICY "Users can view own unlocked rewards"
  ON public.user_unlocked_rewards
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = user_unlocked_rewards.user_id
      AND users.auth_user_id = auth.uid()
    )
  );

-- Policy: Users can insert their own unlocked rewards
CREATE POLICY "Users can insert own unlocked rewards"
  ON public.user_unlocked_rewards
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = user_id
      AND users.auth_user_id = auth.uid()
    )
  );

-- Policy: Users cannot update unlocked rewards (immutable once granted)
-- No UPDATE policy = users cannot modify existing rewards

-- Policy: Users can delete their own unlocked rewards (for admin/debugging only)
CREATE POLICY "Users can delete own unlocked rewards"
  ON public.user_unlocked_rewards
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = user_unlocked_rewards.user_id
      AND users.auth_user_id = auth.uid()
    )
  );

-- ============================================================================
-- 6. RPC FUNCTION: UPDATE USER PREFERENCES (ATOMIC)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_user_preferences(
  p_user_id UUID,
  p_timer_pomodoro_minutes INTEGER DEFAULT NULL,
  p_timer_short_break_minutes INTEGER DEFAULT NULL,
  p_timer_long_break_minutes INTEGER DEFAULT NULL,
  p_pomodoros_before_long_break INTEGER DEFAULT NULL,
  p_auto_start_breaks BOOLEAN DEFAULT NULL,
  p_auto_start_pomodoros BOOLEAN DEFAULT NULL,
  p_background_id TEXT DEFAULT NULL,
  p_playlist TEXT DEFAULT NULL,
  p_ambient_volumes JSONB DEFAULT NULL,
  p_sound_enabled BOOLEAN DEFAULT NULL,
  p_volume INTEGER DEFAULT NULL,
  p_music_volume INTEGER DEFAULT NULL,
  p_level_system_enabled BOOLEAN DEFAULT NULL
)
RETURNS public.users AS $$
DECLARE
  v_updated_user public.users;
BEGIN
  -- SECURITY: Verify caller owns this user profile
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_user_id AND auth_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Cannot update another user''s preferences';
  END IF;

  -- Update only provided fields (NULL means no change)
  UPDATE public.users
  SET
    timer_pomodoro_minutes = COALESCE(p_timer_pomodoro_minutes, timer_pomodoro_minutes),
    timer_short_break_minutes = COALESCE(p_timer_short_break_minutes, timer_short_break_minutes),
    timer_long_break_minutes = COALESCE(p_timer_long_break_minutes, timer_long_break_minutes),
    pomodoros_before_long_break = COALESCE(p_pomodoros_before_long_break, pomodoros_before_long_break),
    auto_start_breaks = COALESCE(p_auto_start_breaks, auto_start_breaks),
    auto_start_pomodoros = COALESCE(p_auto_start_pomodoros, auto_start_pomodoros),
    background_id = COALESCE(p_background_id, background_id),
    playlist = COALESCE(p_playlist, playlist),
    ambient_volumes = COALESCE(p_ambient_volumes, ambient_volumes),
    sound_enabled = COALESCE(p_sound_enabled, sound_enabled),
    volume = COALESCE(p_volume, volume),
    music_volume = COALESCE(p_music_volume, music_volume),
    level_system_enabled = COALESCE(p_level_system_enabled, level_system_enabled),
    updated_at = NOW()
  WHERE id = p_user_id
  RETURNING * INTO v_updated_user;

  RETURN v_updated_user;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.update_user_preferences IS 'Atomically updates user preferences with authorization check. Only updates provided fields.';

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.update_user_preferences TO authenticated;

-- ============================================================================
-- 7. RPC FUNCTION: UNLOCK MILESTONE REWARD (ATOMIC)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.unlock_milestone_reward(
  p_user_id UUID,
  p_reward_type TEXT,
  p_unlock_id TEXT,
  p_milestone_id TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_reward_id UUID;
BEGIN
  -- SECURITY: Verify caller owns this user profile
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_user_id AND auth_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Cannot unlock rewards for another user';
  END IF;

  -- Validate reward_type
  IF p_reward_type NOT IN ('background', 'theme', 'badge', 'playlist') THEN
    RAISE EXCEPTION 'Invalid reward_type: %', p_reward_type;
  END IF;

  -- Insert reward (or return existing if already unlocked)
  INSERT INTO public.user_unlocked_rewards (user_id, reward_type, unlock_id, milestone_id)
  VALUES (p_user_id, p_reward_type, p_unlock_id, p_milestone_id)
  ON CONFLICT (user_id, reward_type, unlock_id) DO NOTHING
  RETURNING id INTO v_reward_id;

  -- If already unlocked, fetch existing ID
  IF v_reward_id IS NULL THEN
    SELECT id INTO v_reward_id
    FROM public.user_unlocked_rewards
    WHERE user_id = p_user_id
      AND reward_type = p_reward_type
      AND unlock_id = p_unlock_id;
  END IF;

  RETURN v_reward_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.unlock_milestone_reward IS 'Unlocks a reward for a user. Idempotent - safe to call multiple times.';

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.unlock_milestone_reward TO authenticated;

-- ============================================================================
-- 8. RPC FUNCTION: GET USER UNLOCKED REWARDS (HELPER)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_unlocked_rewards(
  p_user_id UUID,
  p_reward_type TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  reward_type TEXT,
  unlock_id TEXT,
  milestone_id TEXT,
  unlocked_at TIMESTAMPTZ
) AS $$
BEGIN
  -- SECURITY: Verify caller owns this user profile
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = p_user_id AND users.auth_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Cannot view another user''s rewards';
  END IF;

  -- Return rewards, optionally filtered by type
  RETURN QUERY
  SELECT
    r.id,
    r.reward_type,
    r.unlock_id,
    r.milestone_id,
    r.unlocked_at
  FROM public.user_unlocked_rewards r
  WHERE r.user_id = p_user_id
    AND (p_reward_type IS NULL OR r.reward_type = p_reward_type)
  ORDER BY r.unlocked_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_user_unlocked_rewards IS 'Retrieves all unlocked rewards for a user, optionally filtered by reward_type';

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_unlocked_rewards TO authenticated;

-- ============================================================================
-- 9. RPC FUNCTION: UPDATE USERNAME WITH COOLDOWN CHECK
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_username_with_cooldown(
  p_user_id UUID,
  p_new_username TEXT,
  p_cooldown_hours INTEGER DEFAULT 720 -- 30 days default
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  user_data public.users
) AS $$
DECLARE
  v_last_change TIMESTAMPTZ;
  v_hours_since_change NUMERIC;
  v_updated_user public.users;
BEGIN
  -- SECURITY: Verify caller owns this user profile
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_user_id AND auth_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Cannot update another user''s username';
  END IF;

  -- Get last username change timestamp
  SELECT last_username_change INTO v_last_change
  FROM public.users
  WHERE id = p_user_id;

  -- Check cooldown (if user has changed username before)
  IF v_last_change IS NOT NULL THEN
    v_hours_since_change := EXTRACT(EPOCH FROM (NOW() - v_last_change)) / 3600;

    IF v_hours_since_change < p_cooldown_hours THEN
      RETURN QUERY SELECT
        false AS success,
        format('Username can only be changed once every %s hours. You last changed it %s hours ago.',
               p_cooldown_hours,
               ROUND(v_hours_since_change, 1)) AS message,
        NULL::public.users AS user_data;
      RETURN;
    END IF;
  END IF;

  -- Cooldown passed - update username
  UPDATE public.users
  SET
    username = p_new_username,
    last_username_change = NOW(),
    updated_at = NOW()
  WHERE id = p_user_id
  RETURNING * INTO v_updated_user;

  RETURN QUERY SELECT
    true AS success,
    'Username updated successfully' AS message,
    v_updated_user AS user_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.update_username_with_cooldown IS 'Updates username with cooldown enforcement. Returns success status and message.';

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.update_username_with_cooldown TO authenticated;

-- ============================================================================
-- 10. MIGRATION COMPLETE
-- ============================================================================

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Migration 20251113000000_add_user_preferences_sync.sql completed successfully';
  RAISE NOTICE 'Added columns: timer preferences, visual preferences, username tracking';
  RAISE NOTICE 'Created table: user_unlocked_rewards';
  RAISE NOTICE 'Created functions: update_user_preferences, unlock_milestone_reward, get_user_unlocked_rewards, update_username_with_cooldown';
END $$;
