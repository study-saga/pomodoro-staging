-- Add pomodoro boost fields to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS pomodoro_boost_active BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS pomodoro_boost_expires_at BIGINT DEFAULT NULL;

COMMENT ON COLUMN public.users.pomodoro_boost_active IS 'Whether +25% XP boost is currently active';
COMMENT ON COLUMN public.users.pomodoro_boost_expires_at IS 'Unix timestamp (milliseconds) when boost expires';
