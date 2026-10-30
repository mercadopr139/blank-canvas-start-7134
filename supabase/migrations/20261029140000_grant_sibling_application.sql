-- A second application to the same funder in the same cycle (Josh, 2026-10-29:
-- "I need to submit another grant to O.C.E.A.N. … for our Non-Battle Team and
-- Littles program"). "Start the next one from this folder" clones the setup —
-- the funder's files, the rules, the numbers — and carries every question over.
-- Facts come across as they are; every written answer comes across EMPTY and
-- is rewritten fresh for the new program, with the first application's answer
-- as context only. Each rewritten row remembers the row it was written from,
-- so the page can show how much of it still matches (the sameness check).
-- Safe to run more than once.

ALTER TABLE public.grant_folders
  ADD COLUMN IF NOT EXISTS sibling_of uuid REFERENCES public.grant_folders(id) ON DELETE SET NULL;

ALTER TABLE public.grant_checklist_items
  ADD COLUMN IF NOT EXISTS rewrite_from uuid REFERENCES public.grant_checklist_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS grant_folders_sibling_idx ON public.grant_folders (sibling_of);

NOTIFY pgrst, 'reload schema';

SELECT 'sibling applications ready' AS done;
