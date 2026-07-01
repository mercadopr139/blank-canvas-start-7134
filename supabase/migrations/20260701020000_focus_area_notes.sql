-- Per-focus-area "Notes": durable, detailed context that lives on a
-- focus-area board (e.g. PD / nla) alongside — but separate from — the
-- signals/tasks kanban. A note has a title + body and can carry link
-- attachments (Google Doc / Sheet / any URL) and file attachments
-- (uploaded to the private focus-area-files bucket, opened via short-lived
-- signed URLs). Scoped by (manager_type, focus_area), exactly like signals.
--
-- Visibility mirrors focus_areas: any authenticated admin can read/write.
-- Access to a given board is already gated upstream by the
-- task_manager_<KEY> permission, so notes are shared team context.

CREATE TABLE public.focus_area_notes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_type text NOT NULL,
  focus_area   text NOT NULL,
  title        text,
  body         text NOT NULL DEFAULT '',
  resolved     boolean NOT NULL DEFAULT false,
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_focus_area_notes_scope
  ON public.focus_area_notes (manager_type, focus_area, resolved);

CREATE TABLE public.focus_area_note_attachments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id      uuid NOT NULL REFERENCES public.focus_area_notes(id) ON DELETE CASCADE,
  kind         text NOT NULL CHECK (kind IN ('link', 'file')),
  label        text,
  url          text,          -- links: the URL. files: null.
  storage_path text,          -- files: path inside the focus-area-files bucket. links: null.
  mime_type    text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_focus_area_note_attachments_note
  ON public.focus_area_note_attachments (note_id);

ALTER TABLE public.focus_area_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.focus_area_note_attachments ENABLE ROW LEVEL SECURITY;

-- Notes: authenticated CRUD (mirrors focus_areas policy style).
CREATE POLICY "Auth read focus area notes"   ON public.focus_area_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert focus area notes" ON public.focus_area_notes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update focus area notes" ON public.focus_area_notes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth delete focus area notes" ON public.focus_area_notes FOR DELETE TO authenticated USING (true);

-- Attachments: same.
CREATE POLICY "Auth read note attachments"   ON public.focus_area_note_attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert note attachments" ON public.focus_area_note_attachments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update note attachments" ON public.focus_area_note_attachments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth delete note attachments" ON public.focus_area_note_attachments FOR DELETE TO authenticated USING (true);

-- Keep updated_at fresh on note edits.
CREATE OR REPLACE FUNCTION public.touch_focus_area_notes_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_focus_area_notes_updated_at
  BEFORE UPDATE ON public.focus_area_notes
  FOR EACH ROW EXECUTE FUNCTION public.touch_focus_area_notes_updated_at();

-- Private bucket for uploaded files (bylaws, PDFs, etc.). Private + signed
-- URLs so documents aren't world-readable by guessable URL.
INSERT INTO storage.buckets (id, name, public)
VALUES ('focus-area-files', 'focus-area-files', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Auth upload focus area files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'focus-area-files');

CREATE POLICY "Auth read focus area files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'focus-area-files');

CREATE POLICY "Auth delete focus area files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'focus-area-files');
