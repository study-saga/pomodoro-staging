-- Migration: Fix Invalid Background Defaults
-- Description: Fixes the issue where new users get 'default' as background_id,
--              which is not a valid background ID, causing blank white screens.
--              This migration:
--              1. Updates all existing users with invalid background_id values
--              2. Changes the column default to a valid background ID

-- Step 1: Fix existing users with invalid background_id values
-- Valid background IDs: 'road-video', 'room-video', 'eyes-video', 'anime-video', 'forest-video', 'landscape-video'
UPDATE public.users
SET background_id = 'room-video',
    updated_at = NOW()
WHERE background_id IS NULL
   OR background_id = 'default'
   OR background_id NOT IN (
      'road-video',
      'room-video',
      'eyes-video',
      'anime-video',
      'forest-video',
      'landscape-video'
   );

-- Step 2: Change column default from 'default' to 'room-video'
ALTER TABLE public.users
ALTER COLUMN background_id SET DEFAULT 'room-video';

-- Step 3: Add a comment documenting the valid values
COMMENT ON COLUMN public.users.background_id IS
  'Background video ID. Valid values: road-video, room-video, eyes-video, anime-video, forest-video, landscape-video. Default: room-video (desktop), anime-video (mobile - handled by app)';
