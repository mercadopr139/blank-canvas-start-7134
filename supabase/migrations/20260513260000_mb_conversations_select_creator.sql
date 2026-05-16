-- Fix RLS chicken-and-egg on conversation creation.
--
-- The original mb_conversations SELECT policy only allowed members and
-- super admin. But on conversation creation, the flow is:
--   1. INSERT into mb_conversations (creator: Alex)
--   2. Supabase auto-runs SELECT to return the new row to the client
--   3. Client uses that row's id to INSERT into mb_conversation_members
--
-- At step 2, Alex isn't yet a member of her own conversation (that's
-- step 3), so SELECT returns nothing, the JS .single() throws, and the
-- modal errors. Super admin (Josh) bypassed this because they always
-- pass the SELECT check. Replies into existing threads bypass this
-- because the user is already a member.
--
-- Adding `created_by = auth.uid()` to the SELECT lets creators see
-- their own conversations from the moment of creation onward. Same
-- access pattern is used elsewhere (e.g., GitHub: you can always see
-- repos you own).

DROP POLICY IF EXISTS mb_conversations_select ON public.mb_conversations;

CREATE POLICY mb_conversations_select ON public.mb_conversations
  FOR SELECT
  USING (
    public.is_mb_conversation_member(id, auth.uid())
    OR created_by = auth.uid()
    OR public.is_super_admin(auth.uid())
  );
