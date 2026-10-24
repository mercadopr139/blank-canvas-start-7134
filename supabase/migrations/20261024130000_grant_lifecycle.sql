-- Grant Coach, the rest of the life of a grant (Josh, 2026-10-24):
-- submitted → awarded or declined → active → reporting → closed → apply again,
-- plus the fit check and budget help on each folder. Nothing existing changes;
-- every column is new and nullable, and reports get their own table so they
-- never mix with the application's questions.

alter table public.grant_folders
  add column if not exists submitted_at    timestamptz,
  add column if not exists decided_at      timestamptz,
  add column if not exists closed_at       timestamptz,
  -- What the funder said when they declined, kept for the next application.
  add column if not exists decline_reason  text,
  -- Awarded: were the reporting rules as written in the RFP, or changed by the award letter?
  add column if not exists reporting_basis text check (reporting_basis is null or reporting_basis in ('as_written', 'changed')),
  -- "Apply again" — the folder this one was started from.
  add column if not exists applied_from    uuid references public.grant_folders(id) on delete set null,
  add column if not exists fit_check       jsonb,
  add column if not exists fit_checked_at  timestamptz,
  add column if not exists budget          jsonb,
  add column if not exists budget_at       timestamptz;

create table if not exists public.grant_reports (
  id            uuid primary key default gen_random_uuid(),
  folder_id     uuid not null references public.grant_folders(id) on delete cascade,
  title         text not null,
  kind          text not null default 'narrative' check (kind in ('narrative', 'financial', 'data', 'reimbursement', 'other')),
  -- What the funder requires in it, in their words.
  detail        text,
  period_start  date,
  period_end    date,
  due_on        date,
  status        text not null default 'todo' check (status in ('todo', 'drafted', 'approved', 'submitted')),
  draft         text,
  submitted_at  timestamptz,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  updated_by    uuid references auth.users(id) on delete set null
);
create index if not exists grant_reports_folder_idx on public.grant_reports (folder_id, due_on);

alter table public.grant_reports enable row level security;
create policy grant_reports_admin_select on public.grant_reports for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy grant_reports_admin_insert on public.grant_reports for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy grant_reports_admin_update on public.grant_reports for update to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy grant_reports_admin_delete on public.grant_reports for delete to authenticated using (public.has_role(auth.uid(), 'admin'));
insert into public.app_tables (app_key, table_name) values ('app_grant_coach', 'grant_reports') on conflict do nothing;
create policy "Box holders manage grant_reports" on public.grant_reports for all to authenticated
  using (public.has_table('grant_reports')) with check (public.has_table('grant_reports'));
