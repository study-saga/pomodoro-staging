-- Create system_notifications table for admin-triggered global toast notifications
-- This allows admins to send real-time notifications to all online users
--
-- Use cases:
-- - Bug fix deployed, ask users to refresh
-- - Scheduled maintenance announcements
-- - Critical security updates
-- - Feature releases
--
-- Created: 2025-12-13

-- Create the table
CREATE TABLE IF NOT EXISTS public.system_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message TEXT NOT NULL,
  notification_type TEXT NOT NULL DEFAULT 'info'
    CHECK (notification_type IN ('info', 'warning', 'error', 'success')),
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  action_label TEXT,
  action_url TEXT,

  -- Ensure expiry is in the future
  CONSTRAINT valid_expiry CHECK (
    expires_at IS NULL OR expires_at > created_at
  )
);

-- Enable Row Level Security
ALTER TABLE public.system_notifications ENABLE ROW LEVEL SECURITY;

-- Everyone can read active, non-expired notifications
CREATE POLICY "Anyone can read active notifications"
  ON public.system_notifications
  FOR SELECT
  USING (
    is_active = true
    AND (expires_at IS NULL OR expires_at > NOW())
  );

-- Only admins can insert/update/delete notifications
CREATE POLICY "Admins can manage notifications"
  ON public.system_notifications
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.auth_user_id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Index for performance when querying active notifications
CREATE INDEX idx_system_notifications_active
  ON public.system_notifications(is_active, expires_at, priority DESC)
  WHERE is_active = true;

-- Enable Realtime for instant delivery to connected clients
ALTER PUBLICATION supabase_realtime
  ADD TABLE public.system_notifications;

-- Helper function to create notifications (admin-only)
CREATE OR REPLACE FUNCTION public.create_system_notification(
  p_message TEXT,
  p_type TEXT DEFAULT 'info',
  p_duration_hours INTEGER DEFAULT NULL,
  p_action_label TEXT DEFAULT NULL,
  p_action_url TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_notification_id UUID;
BEGIN
  -- Check if user is admin
  SELECT id INTO v_user_id
  FROM public.users
  WHERE auth_user_id = auth.uid() AND role = 'admin';

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Only admins can create system notifications';
  END IF;

  -- Create notification
  INSERT INTO public.system_notifications (
    message,
    notification_type,
    created_by,
    expires_at,
    action_label,
    action_url
  )
  VALUES (
    p_message,
    p_type,
    v_user_id,
    CASE
      WHEN p_duration_hours IS NOT NULL
      THEN NOW() + (p_duration_hours || ' hours')::INTERVAL
      ELSE NULL
    END,
    p_action_label,
    p_action_url
  )
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$;

COMMENT ON FUNCTION public.create_system_notification IS
'Admin-only function to create global notifications. Duration in hours (NULL = never expires).';

-- Usage examples:
--
-- 1. Bug fix notification with refresh button:
-- SELECT create_system_notification(
--   p_message := 'We just pushed a fix! Please refresh your page.',
--   p_type := 'warning',
--   p_duration_hours := 2,
--   p_action_label := 'Refresh Now',
--   p_action_url := 'REFRESH'
-- );
--
-- 2. Maintenance announcement:
-- SELECT create_system_notification(
--   p_message := 'Scheduled maintenance in 30 minutes. Save your work!',
--   p_type := 'info',
--   p_duration_hours := 1
-- );
--
-- 3. Deactivate all notifications:
-- UPDATE system_notifications SET is_active = false WHERE is_active = true;
