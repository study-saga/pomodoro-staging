-- Message Reactions Feature
-- Run this SQL in your Supabase SQL Editor

-- Create message_reactions table
CREATE TABLE IF NOT EXISTS message_reactions (
  message_id TEXT PRIMARY KEY,
  hearts INTEGER DEFAULT 0 NOT NULL,
  hearted_by TEXT[] DEFAULT '{}' NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read reactions
CREATE POLICY "Anyone can view message reactions"
  ON message_reactions
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Authenticated users can insert/update reactions (handled by function)
CREATE POLICY "Authenticated users can modify reactions"
  ON message_reactions
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id
  ON message_reactions(message_id);

-- Function to toggle message reaction (heart)
-- Atomically adds or removes user from hearted_by array
CREATE OR REPLACE FUNCTION toggle_message_reaction(
  p_message_id TEXT,
  p_user_id TEXT
)
RETURNS TABLE(
  success BOOLEAN,
  hearts INTEGER,
  hearted_by TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_hearted_by TEXT[];
  v_hearts INTEGER;
  v_is_hearted BOOLEAN;
BEGIN
  -- Check if reaction record exists
  SELECT
    message_reactions.hearted_by,
    message_reactions.hearts
  INTO v_hearted_by, v_hearts
  FROM message_reactions
  WHERE message_reactions.message_id = p_message_id;

  -- If no record exists, create one with this user
  IF NOT FOUND THEN
    INSERT INTO message_reactions (message_id, hearts, hearted_by)
    VALUES (p_message_id, 1, ARRAY[p_user_id])
    RETURNING message_reactions.hearts, message_reactions.hearted_by
    INTO v_hearts, v_hearted_by;

    RETURN QUERY SELECT true, v_hearts, v_hearted_by;
    RETURN;
  END IF;

  -- Check if user already hearted
  v_is_hearted := p_user_id = ANY(v_hearted_by);

  IF v_is_hearted THEN
    -- Remove heart
    UPDATE message_reactions
    SET
      hearts = GREATEST(0, message_reactions.hearts - 1),
      hearted_by = array_remove(message_reactions.hearted_by, p_user_id),
      updated_at = NOW()
    WHERE message_reactions.message_id = p_message_id
    RETURNING message_reactions.hearts, message_reactions.hearted_by
    INTO v_hearts, v_hearted_by;
  ELSE
    -- Add heart
    UPDATE message_reactions
    SET
      hearts = message_reactions.hearts + 1,
      hearted_by = array_append(message_reactions.hearted_by, p_user_id),
      updated_at = NOW()
    WHERE message_reactions.message_id = p_message_id
    RETURNING message_reactions.hearts, message_reactions.hearted_by
    INTO v_hearts, v_hearted_by;
  END IF;

  RETURN QUERY SELECT true, v_hearts, v_hearted_by;
END;
$$;

-- Enable realtime for message_reactions
ALTER PUBLICATION supabase_realtime ADD TABLE message_reactions;

-- Grant permissions
GRANT SELECT ON message_reactions TO authenticated;
GRANT INSERT, UPDATE ON message_reactions TO authenticated;
GRANT EXECUTE ON FUNCTION toggle_message_reaction TO authenticated;
