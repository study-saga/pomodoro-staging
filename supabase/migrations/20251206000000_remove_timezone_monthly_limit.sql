-- Remove monthly timezone change counter
-- The 14-day cooldown naturally limits changes to ~2 per month
-- Monthly counter is redundant and adds unnecessary complexity

ALTER TABLE public.users
DROP COLUMN IF EXISTS timezone_change_count_month;

COMMENT ON TABLE public.users IS
  'User profiles with timezone settings enforced by 14-day cooldown only.';
