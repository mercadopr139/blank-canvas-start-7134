-- Two RPCs that the message board UI calls per page load:
--
-- mb_unread_counts(uid): returns one row per conversation the user is a
-- member of, with the count of messages newer than the user's
-- last_read_at and not sent by themselves. Single round-trip replaces
-- the per-conversation N+1 the old code never wired up.
--
-- mb_search_messages(uid, q): full-text search across messages in any
-- conversation the user is a member of. Uses the GIN-indexed
-- content_tsv column for speed. Returns up to 30 most recent hits with
-- conversation name + sender name so the UI doesn't have to chase
-- separate joins on every result.

CREATE OR REPLACE FUNCTION public.mb_unread_counts(uid uuid)
RETURNS TABLE (conversation_id uuid, unread_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    cm.conversation_id,
    COUNT(m.id) AS unread_count
  FROM public.mb_conversation_members cm
  LEFT JOIN public.mb_messages m
    ON m.conversation_id = cm.conversation_id
   AND m.sender_id != cm.user_id
   AND m.created_at > COALESCE(cm.last_read_at, '1970-01-01'::timestamptz)
  WHERE cm.user_id = uid
    AND cm.archived_at IS NULL
  GROUP BY cm.conversation_id;
$$;

CREATE OR REPLACE FUNCTION public.mb_search_messages(uid uuid, q text)
RETURNS TABLE (
  message_id uuid,
  conversation_id uuid,
  conversation_name text,
  content text,
  sender_name text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.id,
    m.conversation_id,
    c.name,
    m.content,
    sp.full_name,
    m.created_at
  FROM public.mb_messages m
  JOIN public.mb_conversation_members cm
    ON cm.conversation_id = m.conversation_id
   AND cm.user_id = uid
  JOIN public.mb_conversations c ON c.id = m.conversation_id
  LEFT JOIN public.staff_profiles sp ON sp.user_id = m.sender_id
  WHERE m.content_tsv @@ plainto_tsquery('english', q)
  ORDER BY m.created_at DESC
  LIMIT 30;
$$;
