-- Add cron job to automatically apply pending timezone changes
-- This job runs daily at midnight UTC and applies any pending timezone changes
-- that have reached their scheduled apply time.
--
-- Context: Users can request timezone changes which are delayed by 24 hours
-- to prevent abuse. This cron job ensures those changes are applied automatically.
--
-- Created: 2025-12-13
-- Issue: Production users reported timezone changes not applying after 24 hours
-- Root cause: Cron job was never created, despite function existing

-- Create the cron job (runs daily at midnight UTC)
SELECT cron.schedule(
  'apply-pending-timezone-changes',  -- Job name
  '0 0 * * *',                        -- Schedule: Every day at 00:00 UTC
  $$SELECT apply_pending_timezone_changes()$$
);

-- Verify the job was created
-- You can check with: SELECT * FROM cron.job WHERE jobname = 'apply-pending-timezone-changes';
