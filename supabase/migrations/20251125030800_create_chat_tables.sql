-- Create private_messages table for secure direct messaging
CREATE TABLE IF NOT EXISTS private_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (length(content) <= 500 AND length(content) > 0),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  deleted_by_sender BOOLEAN DEFAULT FALSE NOT NULL,
  deleted_by_recipient BOOLEAN DEFAULT FALSE NOT NULL,

  -- Ensure users can't message themselves
  CONSTRAINT sender_recipient_different CHECK (sender_id != recipient_id)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_pm_recipient_time
  ON private_messages(recipient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pm_sender_time
  ON private_messages(sender_id, created_at DESC);

-- Index for conversation queries (sorted UUIDs for deterministic conversation IDs)
CREATE INDEX IF NOT EXISTS idx_pm_conversation
  ON private_messages(
    LEAST(sender_id, recipient_id),
    GREATEST(sender_id, recipient_id),
    created_at DESC
  );

-- Enable Row Level Security
ALTER TABLE private_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read messages they sent or received (excluding soft-deleted ones)
CREATE POLICY "Users can read own messages"
  ON private_messages
  FOR SELECT
  USING (
    (
      sender_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
      AND NOT deleted_by_sender
    )
    OR
    (
      recipient_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
      AND NOT deleted_by_recipient
    )
  );

-- Policy: Users can only insert messages as themselves
CREATE POLICY "Users can send messages"
  ON private_messages
  FOR INSERT
  WITH CHECK (
    sender_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

-- Policy: Users can soft-delete their own messages
CREATE POLICY "Users can delete own messages"
  ON private_messages
  FOR UPDATE
  USING (
    sender_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    OR recipient_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
  )
  WITH CHECK (
    -- Only allow updating deletion flags
    (
      sender_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
      AND deleted_by_sender
    )
    OR
    (
      recipient_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
      AND deleted_by_recipient
    )
  );

-- Add last_dm_check column to users table for tracking when user last viewed DMs
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_dm_check TIMESTAMPTZ;

-- Create function to get unread DM count for a user
CREATE OR REPLACE FUNCTION get_unread_dm_count(user_uuid UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM private_messages
  WHERE recipient_id = user_uuid
    AND NOT deleted_by_recipient
    AND created_at > COALESCE(
      (SELECT last_dm_check FROM users WHERE id = user_uuid),
      '1970-01-01'::TIMESTAMPTZ
    );
$$ LANGUAGE SQL STABLE;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION get_unread_dm_count TO authenticated;

COMMENT ON TABLE private_messages IS 'Stores private direct messages between users with soft deletion support';
COMMENT ON COLUMN private_messages.deleted_by_sender IS 'When true, message is hidden for sender but still visible to recipient';
COMMENT ON COLUMN private_messages.deleted_by_recipient IS 'When true, message is hidden for recipient but still visible to sender';
