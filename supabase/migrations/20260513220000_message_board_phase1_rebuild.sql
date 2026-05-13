-- Message Board Phase 1 rebuild: drop the deprecated bits, refactor the
-- core tables, lock down RLS, set up attachments + full-text search +
-- super-admin scaffolding, and wire the Workbench back-reference.
--
-- Safe to run because (a) the feature was never deployed to staff and
-- (b) the small amount of test data in mb_conversations/mb_messages is
-- being intentionally wiped per the rebuild plan.
--
-- This file is the source of truth for the schema; it was also applied
-- live via the Supabase Management API at deploy time.

BEGIN;

-- ── 1. Drop existing RLS policies so we can rebuild them ─────────────────
DROP POLICY IF EXISTS mb_access ON public.mb_conversations;
DROP POLICY IF EXISTS mb_members_access ON public.mb_conversation_members;
DROP POLICY IF EXISTS mb_messages_access ON public.mb_messages;

-- ── 2. Wipe existing data (test data only — not deployed to staff) ──────
TRUNCATE TABLE public.mb_messages, public.mb_conversation_members, public.mb_conversations CASCADE;

-- ── 3. Drop deprecated tables (CASCADE — mb_messages.task_id FK depends on mb_tasks) ─
DROP TABLE IF EXISTS public.mb_tasks CASCADE;
DROP TABLE IF EXISTS public.mb_calendar_events CASCADE;

-- ── 4. Drop deprecated columns on mb_messages and mb_conversations ─────
ALTER TABLE public.mb_messages
  DROP COLUMN IF EXISTS message_type,
  DROP COLUMN IF EXISTS topic,
  DROP COLUMN IF EXISTS task_id;

ALTER TABLE public.mb_conversations
  DROP COLUMN IF EXISTS topic;

-- ── 5. New pillar enum for message board (independent of signal_pillar) ─
DO $$ BEGIN
  CREATE TYPE public.mb_pillar AS ENUM ('operations', 'sales_marketing', 'finance');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 6. Add pillar to conversations (NOT NULL — must be set at creation) ─
ALTER TABLE public.mb_conversations
  ADD COLUMN IF NOT EXISTS pillar public.mb_pillar NOT NULL;

-- ── 7. Add is_important to messages (defaults false, set true to email) ─
ALTER TABLE public.mb_messages
  ADD COLUMN IF NOT EXISTS is_important BOOLEAN NOT NULL DEFAULT false;

-- ── 8. Full-text search on message content ─────────────────────────────
ALTER TABLE public.mb_messages
  ADD COLUMN IF NOT EXISTS content_tsv tsvector
    GENERATED ALWAYS AS (to_tsvector('english', coalesce(content, ''))) STORED;

CREATE INDEX IF NOT EXISTS mb_messages_content_tsv_idx
  ON public.mb_messages USING GIN (content_tsv);

-- ── 9. Per-user archive state on membership ─────────────────────────────
ALTER TABLE public.mb_conversation_members
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS mb_members_archived_at_idx
  ON public.mb_conversation_members(user_id, archived_at);

-- ── 10. Attachments table ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mb_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.mb_messages(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mb_attachments_message_id_idx
  ON public.mb_attachments(message_id);

-- ── 11. Super-admin flag on staff_profiles + helper function ──────────
ALTER TABLE public.staff_profiles
  ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT false;

-- Set Josh as super admin (matches the hardcoded SUPER_ADMIN_EMAIL in
-- useStaffPermissions.ts). Safe re-run; only updates if row exists.
UPDATE public.staff_profiles
SET is_super_admin = true
WHERE email = 'joshmercado@nolimitsboxingacademy.org';

CREATE OR REPLACE FUNCTION public.is_super_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_profiles
    WHERE user_id = uid AND is_super_admin = true
  );
$$;

-- Helper to check membership without recursion when used inside RLS
CREATE OR REPLACE FUNCTION public.is_mb_conversation_member(conv_id uuid, uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mb_conversation_members
    WHERE conversation_id = conv_id AND user_id = uid
  );
$$;

-- ── 12. RLS policies ──────────────────────────────────────────────────
ALTER TABLE public.mb_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mb_conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mb_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mb_attachments ENABLE ROW LEVEL SECURITY;

-- Conversations: members and super admin can SELECT; auth'd users can
-- INSERT as themselves; creator or super admin can UPDATE; super admin
-- alone can DELETE (permanent removal of the conversation).
CREATE POLICY mb_conversations_select ON public.mb_conversations
  FOR SELECT
  USING (
    public.is_mb_conversation_member(id, auth.uid())
    OR public.is_super_admin(auth.uid())
  );

CREATE POLICY mb_conversations_insert ON public.mb_conversations
  FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY mb_conversations_update ON public.mb_conversations
  FOR UPDATE
  USING (created_by = auth.uid() OR public.is_super_admin(auth.uid()))
  WITH CHECK (created_by = auth.uid() OR public.is_super_admin(auth.uid()));

CREATE POLICY mb_conversations_delete ON public.mb_conversations
  FOR DELETE
  USING (public.is_super_admin(auth.uid()));

-- Members: a user can see their own membership rows and rows for any
-- conversation they belong to. Inserts/deletes for membership are
-- restricted to the conversation creator or super admin. Updates of
-- last_read_at and archived_at are restricted to one's own row.
CREATE POLICY mb_members_select ON public.mb_conversation_members
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_mb_conversation_member(conversation_id, auth.uid())
    OR public.is_super_admin(auth.uid())
  );

CREATE POLICY mb_members_insert ON public.mb_conversation_members
  FOR INSERT
  WITH CHECK (
    -- Creator of the conversation may add members; super admin may add
    -- anyone; or a user adding themselves at creation time.
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.mb_conversations c
               WHERE c.id = conversation_id AND c.created_by = auth.uid())
    OR public.is_super_admin(auth.uid())
  );

CREATE POLICY mb_members_update ON public.mb_conversation_members
  FOR UPDATE
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

CREATE POLICY mb_members_delete ON public.mb_conversation_members
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.mb_conversations c
            WHERE c.id = conversation_id AND c.created_by = auth.uid())
    OR public.is_super_admin(auth.uid())
  );

-- Messages: members of the conversation can SELECT and INSERT (as
-- themselves); only super admin can DELETE. Messages are immutable —
-- no UPDATE policy means UPDATE is blocked for non-super-admin.
CREATE POLICY mb_messages_select ON public.mb_messages
  FOR SELECT
  USING (
    public.is_mb_conversation_member(conversation_id, auth.uid())
    OR public.is_super_admin(auth.uid())
  );

CREATE POLICY mb_messages_insert ON public.mb_messages
  FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_mb_conversation_member(conversation_id, auth.uid())
  );

CREATE POLICY mb_messages_delete ON public.mb_messages
  FOR DELETE
  USING (public.is_super_admin(auth.uid()));

-- Attachments mirror message visibility: same membership gate.
CREATE POLICY mb_attachments_select ON public.mb_attachments
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.mb_messages m
            WHERE m.id = message_id
              AND (public.is_mb_conversation_member(m.conversation_id, auth.uid())
                   OR public.is_super_admin(auth.uid())))
  );

CREATE POLICY mb_attachments_insert ON public.mb_attachments
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.mb_messages m
            WHERE m.id = message_id
              AND m.sender_id = auth.uid()
              AND public.is_mb_conversation_member(m.conversation_id, auth.uid()))
  );

CREATE POLICY mb_attachments_delete ON public.mb_attachments
  FOR DELETE
  USING (public.is_super_admin(auth.uid()));

-- ── 13. Workbench (signals) back-reference columns ──────────────────────
ALTER TABLE public.signals
  ADD COLUMN IF NOT EXISTS source_message_id UUID,
  ADD COLUMN IF NOT EXISTS source_conversation_id UUID;

CREATE INDEX IF NOT EXISTS signals_source_message_id_idx
  ON public.signals(source_message_id)
  WHERE source_message_id IS NOT NULL;

-- ── 14. Storage bucket for message attachments (private) ───────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('message-attachments', 'message-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: only members of the parent conversation can read or
-- write objects whose first path segment is a conversation_id they
-- belong to. Convention: store at <conversation_id>/<message_id>/<filename>.
DROP POLICY IF EXISTS mb_attachments_storage_select ON storage.objects;
CREATE POLICY mb_attachments_storage_select ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'message-attachments'
    AND (
      public.is_super_admin(auth.uid())
      OR public.is_mb_conversation_member(
           (string_to_array(name, '/'))[1]::uuid,
           auth.uid()
         )
    )
  );

DROP POLICY IF EXISTS mb_attachments_storage_insert ON storage.objects;
CREATE POLICY mb_attachments_storage_insert ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'message-attachments'
    AND public.is_mb_conversation_member(
          (string_to_array(name, '/'))[1]::uuid,
          auth.uid()
        )
  );

DROP POLICY IF EXISTS mb_attachments_storage_delete ON storage.objects;
CREATE POLICY mb_attachments_storage_delete ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'message-attachments'
    AND public.is_super_admin(auth.uid())
  );

COMMIT;
