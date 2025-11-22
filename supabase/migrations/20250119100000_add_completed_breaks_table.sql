-- Create completed_breaks table for break session history
-- Tracks short breaks and long breaks for XP and cross-device sync

CREATE TABLE IF NOT EXISTS public.completed_breaks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  discord_id TEXT NOT NULL,

  -- Session data
  break_type TEXT NOT NULL CHECK (break_type IN ('short', 'long')),
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  xp_earned INTEGER NOT NULL DEFAULT 0,

  -- Timestamps
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on user_id for user queries
CREATE INDEX IF NOT EXISTS idx_completed_breaks_user_id
  ON public.completed_breaks(user_id);

-- Create index on discord_id for Discord-based queries
CREATE INDEX IF NOT EXISTS idx_completed_breaks_discord_id
  ON public.completed_breaks(discord_id);

-- Create index on completed_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_completed_breaks_completed_at
  ON public.completed_breaks(completed_at DESC);

-- Enable Row Level Security
ALTER TABLE public.completed_breaks ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can read their own breaks
CREATE POLICY "Users can read own breaks"
  ON public.completed_breaks
  FOR SELECT
  USING (discord_id = auth.uid()::text OR true);

-- Create policy: Users can insert their own breaks
CREATE POLICY "Users can insert own breaks"
  ON public.completed_breaks
  FOR INSERT
  WITH CHECK (true);

COMMENT ON TABLE public.completed_breaks IS 'History of completed break sessions (short and long breaks)';
COMMENT ON COLUMN public.completed_breaks.break_type IS 'Type of break: short or long';
COMMENT ON COLUMN public.completed_breaks.duration_minutes IS 'Duration of the break in minutes';
COMMENT ON COLUMN public.completed_breaks.xp_earned IS 'XP earned from this break (1 XP per minute)';
