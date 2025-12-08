-- Update RPC to remove monthly limit (5/month) - keep only 14-day cooldown
-- Monthly limit was unreachable due to 14-day cooldown (~2 changes/month max)
-- This migration fixes the 'column timezone_change_count_month does not exist' error

CREATE OR REPLACE FUNCTION public.request_timezone_change(
  p_user_id UUID,
  p_new_timezone VARCHAR(255),
  p_new_weekend_days INTEGER[] DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_current_timezone VARCHAR(255);
  v_current_weekend_days INTEGER[];
  v_last_change_at TIMESTAMP WITH TIME ZONE;
  v_account_age_days INTEGER;
  v_applies_at TIMESTAMP WITH TIME ZONE;
  v_user_auth_id UUID;
BEGIN
  -- Auth check: verify user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Auth check: verify user owns this user_id
  SELECT auth_user_id INTO v_user_auth_id
  FROM public.users
  WHERE id = p_user_id;

  IF v_user_auth_id IS NULL OR v_user_auth_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Get current state
  SELECT
    timezone,
    weekend_days,
    last_timezone_change_at,
    EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400
  INTO
    v_current_timezone,
    v_current_weekend_days,
    v_last_change_at,
    v_account_age_days
  FROM public.users
  WHERE id = p_user_id;

  -- Default weekend days to current if not provided
  IF p_new_weekend_days IS NULL THEN
    p_new_weekend_days := v_current_weekend_days;
  END IF;

  -- Validate: same timezone + weekend days
  IF v_current_timezone = p_new_timezone AND v_current_weekend_days = p_new_weekend_days THEN
    RETURN jsonb_build_object(
      'status', 'rejected',
      'message', 'Already using this timezone and weekend configuration'
    );
  END IF;

  -- Validate: IANA format
  IF p_new_timezone !~ '^[A-Za-z_]+/[A-Za-z_]+$' AND p_new_timezone != 'UTC' THEN
    RETURN jsonb_build_object(
      'status', 'rejected',
      'message', 'Invalid timezone format. Use IANA format (e.g., America/New_York)'
    );
  END IF;

  -- Validate: weekend_days format
  IF array_length(p_new_weekend_days, 1) != 2
     OR p_new_weekend_days[1] NOT BETWEEN 0 AND 6
     OR p_new_weekend_days[2] NOT BETWEEN 0 AND 6 THEN
    RETURN jsonb_build_object(
      'status', 'rejected',
      'message', 'Invalid weekend_days. Must be 2-element array with values 0-6'
    );
  END IF;

  -- Check cooldown (14 days, exempt new accounts <7 days old)
  IF v_last_change_at IS NOT NULL
     AND NOW() - v_last_change_at < INTERVAL '14 days'
     AND v_account_age_days > 7 THEN
    RETURN jsonb_build_object(
      'status', 'rejected',
      'message', 'Timezone changes limited to once per 14 days',
      'cooldownUntil', v_last_change_at + INTERVAL '14 days',
      'hoursRemaining', CEIL(EXTRACT(EPOCH FROM (v_last_change_at + INTERVAL '14 days' - NOW())) / 3600)
    );
  END IF;

  -- Calculate application time: next midnight 00:00 UTC
  v_applies_at := DATE_TRUNC('day', NOW()) + INTERVAL '1 day';

  -- Log change in history (for user reference only)
  INSERT INTO public.timezone_change_history (
    user_id,
    old_timezone,
    new_timezone,
    old_weekend_days,
    new_weekend_days,
    changed_at
  ) VALUES (
    p_user_id,
    v_current_timezone,
    p_new_timezone,
    v_current_weekend_days,
    p_new_weekend_days,
    NOW()
  );

  -- Update user with PENDING timezone
  UPDATE public.users
  SET pending_timezone = p_new_timezone,
      pending_timezone_applies_at = v_applies_at,
      weekend_days = p_new_weekend_days,
      last_timezone_change_at = NOW()
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'status', 'pending',
    'message', 'Timezone change scheduled. Will apply at next midnight (00:00 UTC)',
    'newTimezone', p_new_timezone,
    'newWeekendDays', p_new_weekend_days,
    'appliesAt', v_applies_at,
    'hoursUntilApplied', CEIL(EXTRACT(EPOCH FROM (v_applies_at - NOW())) / 3600)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.request_timezone_change TO authenticated;

COMMENT ON FUNCTION public.request_timezone_change IS
  'Request timezone change with automated validation and rate limiting.
   Changes apply at next midnight UTC (24-hour minimum delay).
   Enforces 14-day cooldown (waived for accounts <7 days old).
   Fully automated - no manual review needed.';
