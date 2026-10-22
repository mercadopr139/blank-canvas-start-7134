-- Grant Coach answers every question itself (Josh, 2026-10-22).
-- A question read off the funder's application now records where its answer
-- came from, so facts fill exactly from the Grant Vault and only the written
-- answers go to the writer.
--   vault_key     the Grant Vault field (grant_org_fields.key) a fact comes from,
--                 or 'doc:<key>' for an attachment slot matched to an org document
--   vault_part    the piece of that field the portal asks for: street, street2,
--                 city, state, zip, name, first, last, title (null = the whole value)
--   answer_source 'vault' | 'coach' | 'you' — who wrote the answer in the box
--   needs         one line: what Grant Coach still needs from a person, or null
alter table public.grant_checklist_items
  add column if not exists vault_key text,
  add column if not exists vault_part text,
  add column if not exists answer_source text,
  add column if not exists needs text;

alter table public.grant_checklist_items
  drop constraint if exists grant_checklist_items_answer_source_check;
alter table public.grant_checklist_items
  add constraint grant_checklist_items_answer_source_check
  check (answer_source is null or answer_source in ('vault', 'coach', 'you'));
