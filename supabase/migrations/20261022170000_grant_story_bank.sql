-- Grant Coach's story bank (Josh, 2026-10-22): the real moments that prove
-- NLA works, told once — in a strategy session or in the Grant Vault — and
-- drawn on by every grant after. Each story carries a consent mark; a story
-- marked 'private' is never used in writing, an 'anonymous' one never names
-- anyone, and no story ever carries a minor's last name, school, address, or
-- any court or medical detail.
create table if not exists public.grant_stories (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  story       text not null,
  raw         text,
  program     text,
  proves      text[] not null default '{}',
  people      text,
  year        text,
  consent     text not null check (consent in ('named', 'anonymous', 'private')),
  folder_id   uuid references public.grant_folders(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id) on delete set null
);

alter table public.grant_stories enable row level security;
create policy grant_stories_admin_select on public.grant_stories for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy grant_stories_admin_insert on public.grant_stories for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy grant_stories_admin_update on public.grant_stories for update to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy grant_stories_admin_delete on public.grant_stories for delete to authenticated using (public.has_role(auth.uid(), 'admin'));
insert into public.app_tables (app_key, table_name) values ('app_grant_coach', 'grant_stories') on conflict do nothing;
create policy "Box holders manage grant_stories" on public.grant_stories for all to authenticated
  using (public.has_table('grant_stories')) with check (public.has_table('grant_stories'));

-- Which story an answer tells, so one application doesn't lean on the same one twice.
alter table public.grant_checklist_items
  add column if not exists story_id uuid references public.grant_stories(id) on delete set null;
