-- Add prestige stars tracking with role information
-- Each prestige star records which role the user had when earning it

-- Add prestige_stars column to track earned stars
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS prestige_stars JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.users.prestige_stars IS
  'Array of prestige stars earned with role info: [{"role": "elf", "earnedAt": "2025-01-15T10:30:00Z"}, ...]';

-- Create function to award prestige star when reaching level 20
CREATE OR REPLACE FUNCTION public.trigger_award_prestige_star()
RETURNS TRIGGER AS $$
DECLARE
  v_star_count INTEGER;
BEGIN
  -- Only award star when transitioning TO level 20 (prestige up)
  IF NEW.level = 20 AND (OLD.level != 20 OR OLD IS NULL) THEN
    -- Count existing stars
    v_star_count := jsonb_array_length(COALESCE(NEW.prestige_stars, '[]'::jsonb));

    -- Only award if prestige_level matches star count (user just prestiged)
    IF v_star_count < NEW.prestige_level THEN
      -- Add new star with current role
      NEW.prestige_stars := COALESCE(NEW.prestige_stars, '[]'::jsonb) ||
        jsonb_build_array(
          jsonb_build_object(
            'role', NEW.level_path,
            'earnedAt', NOW()
          )
        );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.trigger_award_prestige_star IS
  'Awards a prestige star when user reaches level 20, recording their current role';

-- Create trigger to award stars
DROP TRIGGER IF EXISTS award_prestige_star_on_level_20 ON public.users;

CREATE TRIGGER award_prestige_star_on_level_20
  BEFORE INSERT OR UPDATE OF level, prestige_level ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_award_prestige_star();

COMMENT ON TRIGGER award_prestige_star_on_level_20 ON public.users IS
  'Triggers prestige star award when reaching level 20';

-- Backfill existing users: create stars based on current prestige level
UPDATE public.users
SET prestige_stars = (
  SELECT jsonb_agg(
    jsonb_build_object(
      'role', level_path,
      'earnedAt', created_at + (generate_series * interval '1 day')
    )
  )
  FROM generate_series(0, prestige_level - 1)
)
WHERE prestige_level > 0 AND (prestige_stars IS NULL OR jsonb_array_length(prestige_stars) = 0);
