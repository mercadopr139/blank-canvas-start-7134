-- How a grant is delivered (Josh, 2026-11-12, the Avalon Lions special grant:
-- "this is supposed to be a narrative"). Until now every grant was an online
-- portal with copy/paste boxes. A letter RFP that wants a written proposal
-- mailed or emailed back is a different delivery: one document under the
-- funder's headings, an itemized cost estimate, a letterhead, a signature.
--   delivery  'portal' (the default, every existing folder) | 'proposal'
--   proposal  the proposal's setup: who it goes to, the subject line, who signs
--             {to_name, to_title, to_org, to_address, subject, signer}
-- Safe to run more than once.

alter table public.grant_folders
  add column if not exists delivery text not null default 'portal',
  add column if not exists proposal jsonb;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'grant_folders_delivery_check') then
    alter table public.grant_folders add constraint grant_folders_delivery_check check (delivery in ('portal', 'proposal'));
  end if;
end $$;

notify pgrst, 'reload schema';

select 'grant delivery ready' as done;
