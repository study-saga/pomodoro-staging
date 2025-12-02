-- Add last_role_change_date column to users table
-- This tracks when a user last changed their role (elf/human)
-- Allows NULL for existing users (they can change immediately)

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS last_role_change_date DATE;

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_users_last_role_change_date
  ON public.users(last_role_change_date);

-- Add comment for documentation
COMMENT ON COLUMN public.users.last_role_change_date IS
  'Last date user changed role (YYYY-MM-DD format). NULL means user can change role immediately.';
