-- ═══════════════════════════════════════════════════════════════════
-- Message board: last-message-per-conversation in one round-trip
-- ═══════════════════════════════════════════════════════════════════
-- The board's conversation list used to fetch the latest message with one
-- query PER conversation (an N+1) — the main reason it was slow to open.
-- This helper returns the newest message for every conversation in a single
-- call. SECURITY INVOKER (the default) so mb_messages RLS still applies: a
-- caller only ever gets the last message of conversations they're allowed
-- to see, exactly like the direct query it replaces.
--
-- Idempotent (CREATE OR REPLACE) — safe to run via the SQL Editor now and
-- `supabase db push` later.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.mb_last_messages(conv_ids uuid[])
RETURNS TABLE (conversation_id uuid, message_id uuid, content text, created_at timestamptz)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT DISTINCT ON (m.conversation_id)
    m.conversation_id, m.id, m.content, m.created_at
  FROM public.mb_messages m
  WHERE m.conversation_id = ANY(conv_ids)
  ORDER BY m.conversation_id, m.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.mb_last_messages(uuid[]) TO authenticated;
