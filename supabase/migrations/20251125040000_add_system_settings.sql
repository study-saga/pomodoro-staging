-- Create system_settings table for global configuration
CREATE TABLE IF NOT EXISTS public.system_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Policies
-- Everyone can read settings (needed for kill switch check)
CREATE POLICY "Everyone can read system settings"
  ON public.system_settings
  FOR SELECT
  USING (true);

-- Only admins/service role can update (we'll rely on dashboard/SQL editor for now)
-- or specific admin users if we had an admin role system fully set up.
-- For now, we'll restrict write access to service role (dashboard uses postgres role usually)
-- But to allow "admins" via RLS if we add that later:
CREATE POLICY "Admins can update system settings"
  ON public.system_settings
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT id FROM public.users WHERE discord_id IN (
        '157550333881483265' -- LEX (You)
      )
    )
  );

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
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_settings;
