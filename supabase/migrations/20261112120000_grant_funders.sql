-- What NLA knows about each funder (Josh, 2026-11-12, writing the Avalon
-- Lions special grant: "should I always start the grant with some background
-- knowledge of the funder?"). The funder brief holds what the FUNDER wrote;
-- this holds what JOSH knows about them — who they are to NLA, who reads the
-- applications, what the regular gift has paid for, what they respond to,
-- past asks and outcomes. Kept per funder, not per folder, so it follows the
-- funder into every grant with them and into next year's "Apply again".
-- Matched to folders by the funder's name, case and spacing ignored.
-- Safe to run more than once.

create table if not exists public.grant_funders (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  name_key    text generated always as (lower(regexp_replace(btrim(name), '\s+', ' ', 'g'))) stored,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id) on delete set null
);

create unique index if not exists grant_funders_name_key_idx on public.grant_funders (name_key);

alter table public.grant_funders enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'grant_funders' and policyname = 'grant_funders_admin_select') then
    create policy grant_funders_admin_select on public.grant_funders for select to authenticated using (public.has_role(auth.uid(), 'admin'));
    create policy grant_funders_admin_insert on public.grant_funders for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
    create policy grant_funders_admin_update on public.grant_funders for update to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
    create policy grant_funders_admin_delete on public.grant_funders for delete to authenticated using (public.has_role(auth.uid(), 'admin'));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'grant_funders' and policyname = 'Box holders manage grant_funders') then
    create policy "Box holders manage grant_funders" on public.grant_funders for all to authenticated
      using (public.has_table('grant_funders')) with check (public.has_table('grant_funders'));
  end if;
end $$;
insert into public.app_tables (app_key, table_name) values ('app_grant_coach', 'grant_funders') on conflict do nothing;

notify pgrst, 'reload schema';

select 'grant funders ready' as done;
