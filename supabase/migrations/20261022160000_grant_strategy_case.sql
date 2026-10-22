-- Grant Coach's strategy session and the locked case (Josh, 2026-10-22).
-- Story questions (program name, purpose, need, outcomes, amount, dates) wait
-- until Josh and Grant Coach agree the case; every story answer is then
-- written from it, so one application tells one story.
alter table public.grant_folders
  add column if not exists case_brief jsonb,
  add column if not exists case_locked_at timestamptz;

-- A question that depends on the case waits for it.
alter table public.grant_checklist_items
  add column if not exists needs_case boolean not null default false;

-- A strategy message can carry structure: the program options, or a proposed case.
alter table public.grant_messages
  add column if not exists payload jsonb;
