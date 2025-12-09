-- 1. Truncate existing long messages to satisfy the new constraint
UPDATE public.chat_messages
SET content = substring(content from 1 for 197) || '...'
WHERE length(content) > 200;

-- 2. Update chat_messages content length constraint
ALTER TABLE public.chat_messages
DROP CONSTRAINT IF EXISTS chat_messages_content_check;

ALTER TABLE public.chat_messages
ADD CONSTRAINT chat_messages_content_check CHECK (length(content) <= 200);
