-- Under each story answer, one line: which of the funder's scoring criteria it
-- earns points on, and the evidence in it that earns them (Josh, 2026-10-22).
alter table public.grant_checklist_items add column if not exists score_note text;
