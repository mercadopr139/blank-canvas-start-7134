-- The funder brief (Josh, 2026-10-22): every document the funder sent (RFP,
-- guidelines, rubric, session slides, budget template) is read once into a
-- brief saved with the grant. The strategy session, every answer and the
-- reviewer work from it — what the funder actually said, not an assumption.
alter table public.grant_folders
  add column if not exists funder_brief jsonb,
  add column if not exists funder_brief_at timestamptz,
  -- Which grant_documents the brief was read from, to tell when it is out of date.
  add column if not exists funder_brief_docs uuid[] not null default '{}';
