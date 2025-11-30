-- Create a secure function to get the current user's role
-- This bypasses RLS on the users table to ensure we can always check permissions
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role
  FROM public.users
  WHERE auth_user_id = auth.uid();
  
  RETURN v_role;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;

-- Create a secure function to get the current user's ID
CREATE OR REPLACE FUNCTION public.get_my_user_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id
  FROM public.users
  WHERE auth_user_id = auth.uid();
  
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_user_id() TO authenticated;

-- Update chat_messages policies

-- 1. Drop existing UPDATE policy
DROP POLICY IF EXISTS "Moderators can soft delete messages" ON public.chat_messages;

-- 2. Create new UPDATE policy that allows:
--    a) Admins and Moderators to update ANY message (soft delete)
--    b) Users to update THEIR OWN message (soft delete)
CREATE POLICY "Users can soft delete messages"
ON public.chat_messages
FOR UPDATE
TO authenticated
USING (
  -- Check if user is admin or moderator
  (public.get_my_role() IN ('admin', 'moderator'))
  OR
  -- Check if user owns the message
  (user_id = public.get_my_user_id())
)
WITH CHECK (
  -- Ensure they are only setting is_deleted to true (optional, but good practice)
  -- For now, we just mirror the USING clause to allow the update
  (public.get_my_role() IN ('admin', 'moderator'))
  OR
  (user_id = public.get_my_user_id())
);
