-- Server-authoritative weekend check RPC
-- Client CANNOT bypass this - all weekend detection goes through server

CREATE OR REPLACE FUNCTION public.is_weekend_for_user(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_user_timezone VARCHAR(255);
  v_weekend_days INTEGER[];
  v_server_utc_time TIMESTAMP WITH TIME ZONE;
  v_user_local_time TIMESTAMP;
  v_day_of_week INTEGER;
  v_is_weekend BOOLEAN;
BEGIN
  -- Get user's timezone and weekend days
  SELECT timezone, weekend_days
  INTO v_user_timezone, v_weekend_days
  FROM public.users
  WHERE id = p_user_id;

  -- Fallback to defaults if not found (guest mode)
  IF v_user_timezone IS NULL THEN
    v_user_timezone := 'America/New_York';
  END IF;
  IF v_weekend_days IS NULL THEN
    v_weekend_days := ARRAY[0, 6];
  END IF;

  -- Get current time in user's timezone
  v_server_utc_time := NOW();
  v_user_local_time := v_server_utc_time AT TIME ZONE v_user_timezone;
  v_day_of_week := EXTRACT(DOW FROM v_user_local_time)::INTEGER;

  -- Check if current day is in user's weekend_days
  v_is_weekend := (v_day_of_week = ANY(v_weekend_days));

  RETURN jsonb_build_object(
    'isWeekend', v_is_weekend,
    'dayOfWeek', v_day_of_week,
    'weekendDays', v_weekend_days,
    'userLocalTime', v_user_local_time,
    'serverUtcTime', v_server_utc_time,
    'timezone', v_user_timezone
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.is_weekend_for_user TO authenticated, anon;

COMMENT ON FUNCTION public.is_weekend_for_user IS
  'Server-authoritative weekend check. Client CANNOT override or manipulate.
   Uses server time + stored timezone to determine if user is currently in their weekend.
   Supports custom weekend days (e.g., Fri-Sat [5,6] for Middle East, Sat-Sun [0,6] standard).
   Callable by authenticated and anonymous users (guest mode fallback).';
