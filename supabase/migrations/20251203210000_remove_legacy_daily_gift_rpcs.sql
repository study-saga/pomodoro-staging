-- Remove old login streak RPC functions (replaced by calendar grid system)
-- These functions are no longer called from the codebase after auth refactor

-- Drop old login streak daily gift functions
DROP FUNCTION IF EXISTS public.claim_daily_gift_xp(UUID);
DROP FUNCTION IF EXISTS public.claim_daily_gift_xp_discord(TEXT);

-- Note: Keep claim_daily_gift() and claim_daily_gift_discord() - these are active for calendar grid system
