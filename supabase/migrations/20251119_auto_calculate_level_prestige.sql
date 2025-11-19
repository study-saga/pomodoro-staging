-- Auto-calculate level and prestige from total XP
-- Trigger fires on any XP change (INSERT or UPDATE)

-- Step 0: Drop old trigger that doesn't handle prestige
DROP TRIGGER IF EXISTS update_level_on_xp_change ON public.users;
DROP FUNCTION IF EXISTS public.trigger_update_level_from_xp();
DROP FUNCTION IF EXISTS public.calculate_level_from_xp(INTEGER);

-- Step 1: Create function to calculate level and prestige
CREATE OR REPLACE FUNCTION public.trigger_calculate_level_prestige()
RETURNS TRIGGER AS $$
DECLARE
  v_xp_per_cycle INTEGER := 19000; -- Sum(100+200+...+1900)
  v_max_level INTEGER := 20;
  v_prestige INTEGER;
  v_remaining INTEGER;
  v_level INTEGER;
BEGIN
  -- Only recalculate if XP changed
  IF NEW.xp IS DISTINCT FROM OLD.xp OR TG_OP = 'INSERT' THEN
    -- Calculate prestige (full cycles of 19000 XP)
    v_prestige := COALESCE(NEW.xp, 0) / v_xp_per_cycle;
    v_remaining := COALESCE(NEW.xp, 0) % v_xp_per_cycle;

    -- Calculate level from remaining XP
    v_level := 1;
    WHILE v_level < v_max_level AND v_remaining >= (v_level * 100) LOOP
      v_remaining := v_remaining - (v_level * 100);
      v_level := v_level + 1;
    END LOOP;

    -- Set calculated values
    NEW.level := v_level;
    NEW.prestige_level := v_prestige;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.trigger_calculate_level_prestige IS
  'Auto-calculates level and prestige_level from total XP.
   Formula: prestige = floor(xp/19000), level derived from remainder.';

-- Step 2: Create trigger on users table
DROP TRIGGER IF EXISTS calculate_level_prestige_on_xp_change ON public.users;

CREATE TRIGGER calculate_level_prestige_on_xp_change
  BEFORE INSERT OR UPDATE OF xp ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_calculate_level_prestige();

COMMENT ON TRIGGER calculate_level_prestige_on_xp_change ON public.users IS
  'Auto-calculates level and prestige whenever XP changes.';

-- Step 3: Fix all existing users by forcing trigger to fire
-- Update xp to itself to trigger recalculation
UPDATE public.users SET xp = xp;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_users_prestige_level ON public.users(prestige_level);
