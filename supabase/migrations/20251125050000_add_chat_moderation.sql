-- Create user_role enum (idempotent)
DO $$ BEGIN
    CREATE TYPE public.user_role AS ENUM ('user', 'moderator', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add role column to users table (idempotent)
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS role public.user_role NOT NULL DEFAULT 'user';

-- Create chat_bans table
CREATE TABLE IF NOT EXISTS public.chat_bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  banned_by uuid NOT NULL REFERENCES public.users(id),
  reason text,
  expires_at timestamp with time zone, -- null means permanent
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chat_bans ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Everyone can read bans" ON public.chat_bans;
CREATE POLICY "Everyone can read bans"
  ON public.chat_bans
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Moderators can create bans" ON public.chat_bans;
CREATE POLICY "Moderators can create bans"
  ON public.chat_bans
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_user_id = auth.uid()
      AND role IN ('moderator', 'admin')
    )
  );

DROP POLICY IF EXISTS "Moderators can delete bans" ON public.chat_bans;
CREATE POLICY "Moderators can delete bans"
  ON public.chat_bans
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE auth_user_id = auth.uid()
      AND role IN ('moderator', 'admin')
    )
  );

-- Update messages policy to prevent banned users from posting
-- (Skipped as public.messages table does not exist yet - chat is ephemeral)
-- If/when we move to persisted chat, we should add:
-- CREATE POLICY "Authenticated users can insert messages" ...

-- Add to realtime publication (idempotent)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_bans;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Set LEX (you) as admin
UPDATE public.users
SET role = 'admin'
WHERE discord_id = '157550333881483265';
