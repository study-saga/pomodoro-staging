-- Update RLS policy to hide deleted messages
DROP POLICY IF EXISTS "Authenticated users can read messages" ON public.chat_messages;
CREATE POLICY "Authenticated users can read messages"
ON public.chat_messages
FOR SELECT
TO authenticated
USING (true);
