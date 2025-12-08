-- Drop the old function if it exists to ensure clean slate
DROP FUNCTION IF EXISTS public.request_timezone_change(uuid, text, integer[]);

-- Recreate the function with NO monthly limit check
CREATE OR REPLACE FUNCTION public.request_timezone_change(
    user_id_param uuid,
    new_timezone text,
    weekend_days integer[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    last_change timestamptz;
    pending_change_data jsonb;
    hours_until_apply int;
    apply_at timestamptz;
    user_exists boolean;
BEGIN
    -- 1. Check if user exists
    SELECT EXISTS (
        SELECT 1 FROM public.users
        WHERE id = user_id_param
    ) INTO user_exists;

    IF NOT user_exists THEN
        RETURN jsonb_build_object(
            'status', 'error',
            'message', 'User not found'
        );
    END IF;

    -- 2. Check for cooldown (14 days)
    SELECT last_timezone_change_at INTO last_change
    FROM public.user_settings
    WHERE user_id = user_id_param;

    IF last_change IS NOT NULL AND last_change > (now() - interval '14 days') THEN
        RETURN jsonb_build_object(
            'status', 'error',
            'message', 'Timezone changes are limited to once every 14 days',
            'next_change_available', last_change + interval '14 days'
        );
    END IF;

    -- 3. Check if there's already a pending change
    SELECT pending_timezone_change INTO pending_change_data
    FROM public.user_settings
    WHERE user_id = user_id_param;

    IF pending_change_data IS NOT NULL THEN
        RETURN jsonb_build_object(
            'status', 'error',
            'message', 'You already have a pending timezone change'
        );
    END IF;

    -- 4. Calculate application time (Next Midnight UTC)
    -- If it's currently 23:00 UTC, next midnight is in 1 hour.
    -- If it's 01:00 UTC, next midnight is in 23 hours.
    apply_at := (current_date + interval '1 day')::timestamptz;
    
    -- Calculate hours only for display
    hours_until_apply := EXTRACT(EPOCH FROM (apply_at - now())) / 3600;

    -- 5. Store the pending change
    UPDATE public.user_settings
    SET pending_timezone_change = jsonb_build_object(
        'timezone', new_timezone,
        'weekend_days', weekend_days,
        'applies_at', apply_at
    )
    WHERE user_id = user_id_param;

    RETURN jsonb_build_object(
        'status', 'pending',
        'message', 'Timezone change scheduled for next midnight (UTC)',
        'applies_at', apply_at,
        'hours_until_applied', hours_until_apply
    );
END;
$$;
