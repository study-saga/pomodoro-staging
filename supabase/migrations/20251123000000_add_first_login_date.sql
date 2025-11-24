-- Add first_login_date column to users table
-- This makes the first login tracking more explicit and decoupled from created_at

-- Add column with default value of created_at for existing users
ALTER TABLE users
ADD COLUMN IF NOT EXISTS first_login_date DATE;

-- Backfill first_login_date with created_at for existing users who don't have it set
UPDATE users
SET first_login_date = created_at::DATE
WHERE first_login_date IS NULL;

-- Set default for new users to use created_at
ALTER TABLE users
ALTER COLUMN first_login_date SET DEFAULT CURRENT_DATE;

-- Add index for performance (queries may filter/sort by this)
CREATE INDEX IF NOT EXISTS idx_users_first_login_date ON users(first_login_date);
