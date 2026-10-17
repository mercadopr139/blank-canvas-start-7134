-- Grant Coach, revised (Josh, 2026-10-17): questions come in by screenshot,
-- each question is a conversation, and the folder keeps the application.
--
-- The checklist row is the question. Three things are added to it: the
-- funder's length limit, where the screenshot it came from lives, and when
-- the approved answer was pasted into the funder's portal. The conversation
-- with Grant Coach about a question (or about the grant as a whole) lives in
-- grant_messages.

ALTER TABLE public.grant_checklist_items
  ADD COLUMN IF NOT EXISTS limit_kind  text CHECK (limit_kind IN ('words', 'characters')),
  ADD COLUMN IF NOT EXISTS limit_value integer,
  ADD COLUMN IF NOT EXISTS source_path text,
  ADD COLUMN IF NOT EXISTS pasted_at   timestamptz;

CREATE TABLE IF NOT EXISTS public.grant_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id   uuid NOT NULL REFERENCES public.grant_folders(id) ON DELETE CASCADE,
  /** Null: a conversation about the grant as a whole (which program, how much). */
  item_id     uuid REFERENCES public.grant_checklist_items(id) ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN ('user', 'coach')),
  content     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS grant_messages_item_idx ON public.grant_messages (folder_id, item_id, created_at);
ALTER TABLE public.grant_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY grant_messages_admin_select ON public.grant_messages FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY grant_messages_admin_insert ON public.grant_messages FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY grant_messages_admin_delete ON public.grant_messages FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

NOTIFY pgrst, 'reload schema';

SELECT 'Grant Coach questions and conversations ready' AS result;
