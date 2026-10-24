-- Grant Coach learns from Josh's edits (Josh, 2026-10-24): "if I modify it,
-- there is a reason." Memory keeps Grant Coach's own draft next to the
-- answer Josh approved, so the change can be read; the lesson from it is
-- written into the Grant Vault's "Josh's corrections" field (grant_org_fields
-- key 'corrections'), which every draft follows.
alter table public.grant_answer_memory
  add column if not exists coach_draft text;
