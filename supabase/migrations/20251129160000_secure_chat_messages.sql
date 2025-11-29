-- Create chat_messages table
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL CHECK (length(content) <= 500),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    is_deleted BOOLEAN DEFAULT false,
    
    -- Metadata for role/username snapshot (optional, but good for history)
    user_role TEXT,
    username TEXT
);

-- Enable RLS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Create index for faster queries and cleanup
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON public.chat_messages(user_id);

-- RLS Policies

-- 1. SELECT: Authenticated users can read all non-deleted messages
DROP POLICY IF EXISTS "Authenticated users can read messages" ON public.chat_messages;
CREATE POLICY "Authenticated users can read messages"
ON public.chat_messages
FOR SELECT
TO authenticated
USING (true);

-- 2. INSERT: Authenticated users can insert their own messages if NOT banned
DROP POLICY IF EXISTS "Users can insert messages if not banned" ON public.chat_messages;
CREATE POLICY "Users can insert messages if not banned"
ON public.chat_messages
FOR INSERT
TO authenticated
WITH CHECK (
    -- 1. Ensure the user is inserting as themselves (map auth.uid -> public.users.id)
    user_id IN (
        SELECT id FROM public.users WHERE auth_user_id = auth.uid()
    )
    AND
    -- 2. Ensure not banned
    NOT EXISTS (
        SELECT 1 FROM public.chat_bans
        WHERE user_id = (
            SELECT id FROM public.users WHERE auth_user_id = auth.uid()
        )
        AND (expires_at IS NULL OR expires_at > now())
    )
);

-- 3. UPDATE: Only admins/moderators can update (soft delete)
DROP POLICY IF EXISTS "Moderators can soft delete messages" ON public.chat_messages;
CREATE POLICY "Moderators can soft delete messages"
ON public.chat_messages
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE auth_user_id = auth.uid() -- Correctly check auth_user_id
        AND role IN ('admin', 'moderator')
    )
);

-- Function to clean up old messages (Rolling Window)
CREATE OR REPLACE FUNCTION cleanup_old_chat_messages()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Delete messages older than 24 hours
    DELETE FROM public.chat_messages
    WHERE created_at < (now() - INTERVAL '24 hours');
END;
$$;

-- Note: You need to schedule this function using pg_cron or an Edge Function.
-- Example pg_cron (if extension enabled):
-- SELECT cron.schedule('cleanup-chat-every-hour', '0 * * * *', 'SELECT cleanup_old_chat_messages()');

-- Add to realtime publication
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
