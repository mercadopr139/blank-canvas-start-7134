-- What a drafted answer leaves out of what NLA does, and why (Josh, 2026-10-22:
-- a funding purpose silently dropped the summer excursions). Shown under the
-- answer so nothing is ever left out without him seeing it.
alter table public.grant_checklist_items add column if not exists left_out text[] not null default '{}';
