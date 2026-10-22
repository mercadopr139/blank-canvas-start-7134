-- A dropdown or set of options on a funder's application is its own kind of
-- question: the writer answers it with only the option to pick. The reader
-- has always reported it as 'choice'; the column now accepts it.
alter table public.grant_checklist_items drop constraint if exists grant_checklist_items_kind_check;
alter table public.grant_checklist_items
  add constraint grant_checklist_items_kind_check
  check (kind in ('eligibility', 'field', 'narrative', 'upload', 'acknowledgment', 'signature', 'task', 'choice'));
