-- Message board: archiving clears a conversation for everyone in it (Josh,
-- 2026-10-20). Until now archived_at lived on each member's own row, so
-- Josh archiving a thread left it on Chrissy's list and on her Lap. The
-- Lap lists a pillar's live conversations at every checkpoint so stale
-- threads get archived; that only works if one archive is the archive.
--
-- A new message already un-archives for everyone (mb_unarchive_on_new_message),
-- so the two rules are symmetric. Members can only update their own row
-- under RLS, hence SECURITY DEFINER with a membership check.
CREATE OR REPLACE FUNCTION public.mb_set_archived(_ids uuid[], _archived boolean)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first';
  END IF;
  -- Only conversations the caller is in (or any, for the Super Admin).
  UPDATE public.mb_conversation_members m
     SET archived_at = CASE WHEN _archived THEN COALESCE(m.archived_at, now()) ELSE NULL END
   WHERE m.conversation_id = ANY(_ids)
     AND (public.is_mb_conversation_member(m.conversation_id, auth.uid()) OR public.is_super_admin(auth.uid()));
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.mb_set_archived(uuid[], boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.mb_set_archived(uuid[], boolean) TO authenticated;

-- Once, for what is already there: a thread any member archived is archived
-- for every member, as of that archive. (Josh cleared his whole board on
-- 2026-10-19; under the new rule that clears Chrissy's too.) Reversible from
-- the Archived tab — Restore now restores for everyone as well.
UPDATE public.mb_conversation_members m
   SET archived_at = a.at
  FROM (SELECT conversation_id, max(archived_at) AS at
          FROM public.mb_conversation_members
         WHERE archived_at IS NOT NULL
         GROUP BY conversation_id) a
 WHERE a.conversation_id = m.conversation_id
   AND m.archived_at IS NULL;
