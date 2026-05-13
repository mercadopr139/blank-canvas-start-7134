-- Auto-unarchive: when any new message lands in a conversation, every
-- member who had archived that conversation gets it restored to their
-- active list (Gmail-style). This means archive is "hide until something
-- new happens," not "block until I manually re-add."
--
-- Trigger runs as SECURITY DEFINER so it can clear archived_at across
-- all member rows regardless of who posted the message.

CREATE OR REPLACE FUNCTION public.mb_unarchive_on_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.mb_conversation_members
  SET archived_at = NULL
  WHERE conversation_id = NEW.conversation_id
    AND archived_at IS NOT NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mb_messages_unarchive ON public.mb_messages;
CREATE TRIGGER mb_messages_unarchive
  AFTER INSERT ON public.mb_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.mb_unarchive_on_new_message();
