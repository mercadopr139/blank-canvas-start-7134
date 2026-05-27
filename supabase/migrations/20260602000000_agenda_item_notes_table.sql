-- Threaded notes log for agenda items.
--
-- Replaces the single-blob `agenda_items.notes` text column with a
-- proper per-note table. The old column stays on agenda_items for
-- safety (legacy data + a fallback if we ever need it back), but
-- the UI stops reading it once this migration runs.
--
-- Backfill: any non-empty existing `notes` value becomes the first
-- entry in the new table for that item, preserving the original
-- created_at and created_by so the log timestamp is honest.

CREATE TABLE IF NOT EXISTS public.agenda_item_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.agenda_items(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agenda_item_notes_item_created
  ON public.agenda_item_notes(item_id, created_at);

ALTER TABLE public.agenda_item_notes ENABLE ROW LEVEL SECURITY;

-- Matches the existing pattern on every other agenda_* table — any
-- admin can read/write.
DROP POLICY IF EXISTS "agenda_item_notes_admin_all" ON public.agenda_item_notes;
CREATE POLICY "agenda_item_notes_admin_all"
  ON public.agenda_item_notes
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Backfill the existing single-blob notes into the new table. Skipped
-- for empty / whitespace-only content. Uses each item's own created_at
-- so the first note in the log reflects when the item was actually
-- created (and gives the user an honest timeline going forward).
INSERT INTO public.agenda_item_notes (item_id, content, created_at, created_by)
SELECT id, notes, created_at, created_by
FROM public.agenda_items
WHERE notes IS NOT NULL
  AND TRIM(notes) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.agenda_item_notes
    WHERE item_id = public.agenda_items.id
  );

-- Realtime so the threaded log live-updates the same way attachments
-- and links do.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'agenda_item_notes'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.agenda_item_notes';
  END IF;
END $$;
