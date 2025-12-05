-- Simple timezone change history table for user reference
-- Read-only log, no manual review needed (fully automated enforcement)

CREATE TABLE IF NOT EXISTS public.timezone_change_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  old_timezone VARCHAR(255) NOT NULL,
  new_timezone VARCHAR(255) NOT NULL,
  old_weekend_days INTEGER[],
  new_weekend_days INTEGER[],

  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index for efficient user history queries
CREATE INDEX idx_timezone_history_user_id ON public.timezone_change_history(user_id);
CREATE INDEX idx_timezone_history_changed_at ON public.timezone_change_history(changed_at DESC);

-- Row Level Security: Users can only see their own history
ALTER TABLE public.timezone_change_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own timezone history"
  ON public.timezone_change_history FOR SELECT
  USING (user_id IN (SELECT id FROM public.users WHERE auth_user_id = auth.uid()));

COMMENT ON TABLE public.timezone_change_history IS
  'Read-only history log for user reference. No manual review needed - all enforcement is automated via database constraints and RPC validation.';
