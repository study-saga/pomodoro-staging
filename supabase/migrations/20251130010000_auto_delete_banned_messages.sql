-- Create function to handle auto-deletion of messages
CREATE OR REPLACE FUNCTION public.handle_ban_auto_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Soft delete all messages from the banned user
    UPDATE public.chat_messages
    SET is_deleted = true
    WHERE user_id = NEW.user_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on chat_bans
DROP TRIGGER IF EXISTS on_ban_auto_delete ON public.chat_bans;
CREATE TRIGGER on_ban_auto_delete
    AFTER INSERT ON public.chat_bans
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_ban_auto_delete();
