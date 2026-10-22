-- An answer already typed into the funder's portal comes in with its question
-- (Josh, 2026-10-22): answer_source 'portal'.
alter table public.grant_checklist_items drop constraint if exists grant_checklist_items_answer_source_check;
alter table public.grant_checklist_items
  add constraint grant_checklist_items_answer_source_check
  check (answer_source is null or answer_source in ('vault', 'coach', 'you', 'portal'));
