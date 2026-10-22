-- Grant Coach remembers every answer Josh approves (2026-10-22).
-- One row per approved question: what the funder asked, what NLA answered,
-- for whom and when. The next grant checks here before writing: the same
-- question gets the past answer (a fact as is, a written answer as the
-- starting draft). The Grant Vault holds NLA's facts; this holds NLA's answers.
create table if not exists public.grant_answer_memory (
  id           uuid primary key default gen_random_uuid(),
  question     text not null,
  help         text,
  kind         text not null default 'field',
  answer       text not null,
  funder       text,
  folder_id    uuid references public.grant_folders(id) on delete set null,
  -- The approved question this came from; one memory per question, replaced on re-approval.
  item_id      uuid unique references public.grant_checklist_items(id) on delete set null,
  source       text,
  limit_kind   text,
  limit_value  integer,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id) on delete set null
);
create index if not exists grant_answer_memory_updated_idx on public.grant_answer_memory (updated_at desc);

alter table public.grant_answer_memory enable row level security;
drop policy if exists grant_answer_memory_admin_select on public.grant_answer_memory;
drop policy if exists grant_answer_memory_admin_insert on public.grant_answer_memory;
drop policy if exists grant_answer_memory_admin_update on public.grant_answer_memory;
drop policy if exists grant_answer_memory_admin_delete on public.grant_answer_memory;
create policy grant_answer_memory_admin_select on public.grant_answer_memory for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy grant_answer_memory_admin_insert on public.grant_answer_memory for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy grant_answer_memory_admin_update on public.grant_answer_memory for update to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy grant_answer_memory_admin_delete on public.grant_answer_memory for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

-- The Grant Coach box reaches it like the other grant tables.
insert into public.app_tables (app_key, table_name) values ('app_grant_coach', 'grant_answer_memory')
on conflict do nothing;
drop policy if exists "Box holders manage grant_answer_memory" on public.grant_answer_memory;
create policy "Box holders manage grant_answer_memory" on public.grant_answer_memory for all to authenticated
  using (public.has_table('grant_answer_memory')) with check (public.has_table('grant_answer_memory'));

-- A question answered from a past grant points at the answer it reused.
alter table public.grant_checklist_items
  add column if not exists memory_id uuid references public.grant_answer_memory(id) on delete set null;

alter table public.grant_checklist_items drop constraint if exists grant_checklist_items_answer_source_check;
alter table public.grant_checklist_items
  add constraint grant_checklist_items_answer_source_check
  check (answer_source is null or answer_source in ('vault', 'coach', 'you', 'portal', 'memory'));
