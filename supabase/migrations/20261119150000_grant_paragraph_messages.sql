-- Talk to Grant Coach on a standard paragraph (Josh, 2026-11-19): the thread
-- under each paragraph of a program year, kept so next month shows why a line
-- is there. One row per message; "after" in the payload is the paragraph with
-- the one change Grant Coach proposed, "used" once Josh put it in the box.
create table if not exists public.grant_paragraph_messages (
  id            uuid primary key default gen_random_uuid(),
  program_year  text not null,
  section_key   text not null,
  role          text not null check (role in ('user', 'coach')),
  content       text not null,
  payload       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id) on delete set null
);
create index if not exists grant_paragraph_messages_thread_idx on public.grant_paragraph_messages (program_year, section_key, created_at);

alter table public.grant_paragraph_messages enable row level security;
create policy grant_paragraph_messages_admin_select on public.grant_paragraph_messages for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy grant_paragraph_messages_admin_insert on public.grant_paragraph_messages for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy grant_paragraph_messages_admin_update on public.grant_paragraph_messages for update to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy grant_paragraph_messages_admin_delete on public.grant_paragraph_messages for delete to authenticated using (public.has_role(auth.uid(), 'admin'));
insert into public.app_tables (app_key, table_name) values ('app_grant_coach', 'grant_paragraph_messages') on conflict do nothing;
create policy "Box holders manage grant_paragraph_messages" on public.grant_paragraph_messages for all to authenticated
  using (public.has_table('grant_paragraph_messages')) with check (public.has_table('grant_paragraph_messages'));

notify pgrst, 'reload schema';
