-- Create Xero {NPC} Bot User
-- This migration creates the bot user and configuration for automated chat messages

-- Create bot user in users table
DO $$
DECLARE
  v_bot_id UUID;
BEGIN
  -- Check if bot already exists
  SELECT id INTO v_bot_id FROM public.users WHERE username = 'Xero {NPC}';

  IF v_bot_id IS NULL THEN
    -- Generate unique bot user
    INSERT INTO public.users (
      id,
      discord_id,
      username,
      avatar,
      role,
      level,
      xp,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      'bot-xero-npc', -- Unique discord_id for bot
      'Xero {NPC}',
      NULL, -- No avatar (can be set to custom hash later)
      'user', -- Regular user role (not moderator/admin)
      1,
      0,
      NOW(),
      NOW()
    )
    RETURNING id INTO v_bot_id;

    RAISE NOTICE 'Bot user "Xero {NPC}" created with ID: %', v_bot_id;
  ELSE
    RAISE NOTICE 'Bot user "Xero {NPC}" already exists with ID: %', v_bot_id;
  END IF;
END $$;

-- Store bot configuration in system_settings for runtime control
INSERT INTO public.system_settings (key, value)
VALUES (
  'xero_bot_config',
  jsonb_build_object(
    'enabled', true,
    'min_interval_minutes', 30,
    'max_interval_minutes', 60,
    'bot_username', 'Xero {NPC}',
    'description', 'Motivational chat bot that posts encouraging messages'
  )
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = NOW();

COMMENT ON TABLE public.system_settings IS 'System-wide settings including bot configuration';
