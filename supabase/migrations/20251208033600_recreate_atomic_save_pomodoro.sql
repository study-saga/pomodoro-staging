-- Recreate the atomic_save_completed_pomodoro function
CREATE OR REPLACE FUNCTION public.atomic_save_completed_pomodoro(
    user_id_param uuid,
    duration_minutes integer,
    xp_gained integer,
    stats_data jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_xp integer;
    current_level integer;
    new_xp integer;
    new_level integer;
    xp_needed integer;
    user_exists boolean;
    debug_info jsonb;
BEGIN
    -- 1. Check if user exists
    SELECT EXISTS (
        SELECT 1 FROM public.users WHERE id = user_id_param
    ) INTO user_exists;

    IF NOT user_exists THEN
        RAISE EXCEPTION 'User not found: %', user_id_param;
    END IF;

    -- 2. Get current stats
    SELECT 
        COALESCE(xp, 0),
        COALESCE(level, 1)
    INTO 
        current_xp,
        current_level
    FROM public.users 
    WHERE id = user_id_param
    FOR UPDATE; -- Lock the row to prevent race conditions

    -- 3. Calculate new values
    new_xp := current_xp + xp_gained;
    
    -- Simple level calculation (can be replaced with complex formula)
    -- Example: Level = floor(sqrt(new_xp / 100)) + 1
    new_level := floor(sqrt(new_xp::float / 100)) + 1;
    
    -- Ensure level never drops
    IF new_level < current_level THEN
        new_level := current_level;
    END IF;

    -- 4. Update user stats
    UPDATE public.users
    SET 
        xp = new_xp,
        level = new_level,
        total_pomodoros = total_pomodoros + 1,
        total_study_minutes = total_study_minutes + duration_minutes,
        last_active_at = now(),
        updated_at = now()
    WHERE id = user_id_param;

    -- 5. Return result
    RETURN jsonb_build_object(
        'success', true,
        'new_xp', new_xp,
        'new_level', new_level,
        'xp_gained', xp_gained
    );

EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS debug_info = PG_EXCEPTION_CONTEXT;
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'detail', debug_info
    );
END;
$$;
