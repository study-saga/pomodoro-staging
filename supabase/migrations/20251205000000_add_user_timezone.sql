-- Add timezone and weekend days support for timezone-aware weekend buffs
-- Allows users to set their timezone for correct weekend detection
-- Supports custom weekend days (Fri-Sat for Middle East, Sat-Sun for most regions)

ALTER TABLE public.users
  -- Current timezone (IANA format: America/New_York, Europe/London, etc.)
  ADD COLUMN IF NOT EXISTS timezone VARCHAR(255) DEFAULT 'America/New_York',

  -- Custom weekend days array (0=Sunday, 1=Monday, ..., 6=Saturday)
  -- Default [0,6] = Saturday-Sunday
  -- Middle East [5,6] = Friday-Saturday
  ADD COLUMN IF NOT EXISTS weekend_days INTEGER[] DEFAULT ARRAY[0,6],

  -- Pending timezone change (applies at next midnight 00:00 UTC)
  ADD COLUMN IF NOT EXISTS pending_timezone VARCHAR(255),
  ADD COLUMN IF NOT EXISTS pending_timezone_applies_at TIMESTAMP WITH TIME ZONE,

  -- Rate limiting fields
  ADD COLUMN IF NOT EXISTS timezone_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS timezone_change_count_month INTEGER DEFAULT 0
    CHECK (timezone_change_count_month >= 0 AND timezone_change_count_month <= 5),
  ADD COLUMN IF NOT EXISTS last_timezone_change_at TIMESTAMP WITH TIME ZONE;

-- Validate IANA timezone format (e.g., America/New_York, Europe/Paris)
ALTER TABLE public.users
  ADD CONSTRAINT valid_iana_timezone
  CHECK (
    timezone ~ '^[A-Za-z_]+/[A-Za-z_]+$'
    OR timezone = 'UTC'
  );

-- Validate weekend_days array (must be 2 elements with values 0-6)
ALTER TABLE public.users
  ADD CONSTRAINT valid_weekend_days
  CHECK (
    array_length(weekend_days, 1) = 2
    AND weekend_days[1] BETWEEN 0 AND 6
    AND weekend_days[2] BETWEEN 0 AND 6
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_timezone ON public.users(timezone);
CREATE INDEX IF NOT EXISTS idx_users_pending_timezone ON public.users(pending_timezone)
  WHERE pending_timezone IS NOT NULL;

COMMENT ON COLUMN public.users.timezone IS
  'User timezone in IANA format (e.g., America/New_York). Used for server-authoritative weekend buff detection.';

COMMENT ON COLUMN public.users.weekend_days IS
  'Custom weekend days array. [0,6]=Sat-Sun, [5,6]=Fri-Sat (Middle East). 0=Sunday, 6=Saturday.';

COMMENT ON COLUMN public.users.pending_timezone IS
  'Pending timezone change that will apply at pending_timezone_applies_at timestamp. Enforces 24-hour delay.';
