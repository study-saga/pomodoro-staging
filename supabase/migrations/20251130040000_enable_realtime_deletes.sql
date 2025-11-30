-- CRITICAL: Enable full row replication for Realtime to work correctly
-- This ensures that UPDATE events include full row data (old and new values)
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;

-- Ensure RLS policy allows reading all messages (including deleted ones)
-- This is needed for Realtime to notify clients about deleted messages
DROP POLICY IF EXISTS "Authenticated users can read messages" ON public.chat_messages;
CREATE POLICY "Authenticated users can read messages"
ON public.chat_messages
FOR SELECT
TO authenticated
USING (true);

-- Verify the table is in the realtime publication
DO $$
BEGIN
  -- Add table to realtime publication if not already there
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
  END IF;
END $$;
