-- The reviewer's last read of the application (Josh, 2026-10-22): a score per
-- criterion, the weakest answers with fixes, contradictions between answers.
alter table public.grant_folders
  add column if not exists review jsonb,
  add column if not exists reviewed_at timestamptz;
