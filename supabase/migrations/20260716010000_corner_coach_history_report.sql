-- Persist a drafted Corner Coach report on its history row, so reopening
-- "Make Report" brings back the operator's edited/downloaded version instead
-- of regenerating a fresh draft. Shape: { title, periodLabel, narrative,
-- stats[], table } — nullable until a report is drafted for that question.
alter table public.corner_coach_history
  add column if not exists report jsonb;
