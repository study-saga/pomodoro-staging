-- Create chat_reports table
CREATE TABLE IF NOT EXISTS public.chat_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id UUID REFERENCES public.chat_messages(id) ON DELETE CASCADE NOT NULL,
    reporter_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.chat_reports ENABLE ROW LEVEL SECURITY;

-- Policies

-- Reporters can insert their own reports
CREATE POLICY "Users can insert their own reports"
ON public.chat_reports
FOR INSERT
TO authenticated
WITH CHECK (
    reporter_id IN (
        SELECT id FROM public.users WHERE auth_user_id = auth.uid()
    )
);

-- Moderators/Admins can view all reports
CREATE POLICY "Moderators and Admins can view all reports"
ON public.chat_reports
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE auth_user_id = auth.uid()
        AND role IN ('moderator', 'admin')
    )
);

-- Moderators/Admins can update reports (e.g. change status)
CREATE POLICY "Moderators and Admins can update reports"
ON public.chat_reports
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE auth_user_id = auth.uid()
        AND role IN ('moderator', 'admin')
    )
);
