-- Create system_settings table for global configuration
CREATE TABLE IF NOT EXISTS public.system_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_system_settings_updated_at ON public.system_settings;
CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Policies
-- Everyone can read settings (needed for kill switch check)
DROP POLICY IF EXISTS "Everyone can read system settings" ON public.system_settings;
CREATE POLICY "Everyone can read system settings"
  ON public.system_settings
  FOR SELECT
  USING (key = 'chat_config');

-- Only admins/service role can update (we'll rely on dashboard/SQL editor for now)
-- or specific admin users if we had an admin role system fully set up.
-- For now, we'll restrict write access to service role (dashboard uses postgres role usually)
-- The "Admins can update system settings" policy will be added in 20251125050000_add_chat_moderation.sql
-- where the user_role type and role column are defined.

-- Insert default chat config
INSERT INTO public.system_settings (key, value, description)
VALUES (
  'chat_config',
  '{"enabled": true, "maintenance_message": "Chat is currently disabled for maintenance."}'::jsonb,
  'Global configuration for the chat system'
) ON CONFLICT (key) DO NOTHING;

-- Grant access
GRANT SELECT ON public.system_settings TO anon, authenticated;

-- Add to realtime publication
-- Add to realtime publication (idempotent)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.system_settings;
EXCEPTION
  WHEN duplicate_object THEN null;
  WHEN OTHERS THEN null; -- Handle "already member" error which might have different code depending on PG version
END $$;
