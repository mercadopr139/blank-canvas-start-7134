-- After-the-fact "Flag as important" for already-sent message-board
-- messages. Once flagged, can't be unflagged (matches the spec: one-
-- way only, avoids accidental email re-fires from toggling on/off).
--
-- Messages are otherwise immutable (no UPDATE policy on mb_messages),
-- so this SECURITY DEFINER function is the gated path. It updates only
-- is_important, scopes to conversation members + super admin, and
-- never reverts a true back to false.

CREATE OR REPLACE FUNCTION public.mb_mark_message_important(msg_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conv_id uuid;
BEGIN
  SELECT conversation_id INTO conv_id FROM public.mb_messages WHERE id = msg_id;
  IF conv_id IS NULL THEN
    RAISE EXCEPTION 'Message not found' USING ERRCODE = 'no_data_found';
  END IF;

  IF NOT (
    public.is_mb_conversation_member(conv_id, auth.uid())
    OR public.is_super_admin(auth.uid())
  ) THEN
    RAISE EXCEPTION 'Not a member of this conversation' USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE public.mb_messages
  SET is_important = true
  WHERE id = msg_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mb_mark_message_important(uuid) TO authenticated;
