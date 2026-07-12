-- ─────────────────────────────────────────────────────────────────────
-- Standalone Form Builder
-- Lets admins create arbitrary public forms (e.g. a one-day waiver),
-- publish them to a public URL, and collect responses. This is separate
-- from `registration_form_fields`, which only configures the single youth
-- registration form.
-- ─────────────────────────────────────────────────────────────────────

create table if not exists public.forms (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  title       text not null default 'Untitled Form',
  description text,
  -- Ordered array of field definitions, same shape the Form Builder UI uses:
  -- { id, field_key, field_type, label, help_text, placeholder, required,
  --   options, sort_order }
  fields      jsonb not null default '[]'::jsonb,
  -- { notifyEmail, confirmationTitle, confirmationMessage }
  settings    jsonb not null default '{}'::jsonb,
  status      text not null default 'draft' check (status in ('draft','published')),
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.form_responses (
  id           uuid primary key default gen_random_uuid(),
  form_id      uuid not null references public.forms(id) on delete cascade,
  -- Answers keyed by field_key. Signature fields store a PNG data URL.
  data         jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now()
);

create index if not exists form_responses_form_id_idx on public.form_responses(form_id);
create index if not exists forms_slug_idx on public.forms(slug);

alter table public.forms          enable row level security;
alter table public.form_responses enable row level security;

-- ── FORMS ──
-- Anyone (including anonymous visitors) may read a PUBLISHED form so the
-- public page can render it; admins may read everything (drafts included).
drop policy if exists "forms_select_published_or_admin" on public.forms;
drop policy if exists "forms_admin_insert" on public.forms;
drop policy if exists "forms_admin_update" on public.forms;
drop policy if exists "forms_admin_delete" on public.forms;
drop policy if exists "form_responses_public_insert" on public.form_responses;
drop policy if exists "form_responses_admin_select" on public.form_responses;
drop policy if exists "form_responses_admin_delete" on public.form_responses;

create policy "forms_select_published_or_admin" on public.forms
  for select
  using (status = 'published' or public.has_role(auth.uid(), 'admin'::public.app_role));

create policy "forms_admin_insert" on public.forms
  for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

create policy "forms_admin_update" on public.forms
  for update to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

create policy "forms_admin_delete" on public.forms
  for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ── FORM RESPONSES ──
-- Anyone may submit a response to a PUBLISHED form (public waiver signing).
create policy "form_responses_public_insert" on public.form_responses
  for insert
  with check (
    exists (select 1 from public.forms f where f.id = form_id and f.status = 'published')
  );

-- Only admins may read or delete responses.
create policy "form_responses_admin_select" on public.form_responses
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role));

create policy "form_responses_admin_delete" on public.form_responses
  for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Table-level grants (RLS still filters rows). anon reads published forms +
-- inserts responses; authenticated admins get full CRUD (gated by policies).
grant select on public.forms to anon, authenticated;
grant insert, update, delete on public.forms to authenticated;
grant insert on public.form_responses to anon, authenticated;
grant select, delete on public.form_responses to authenticated;

-- Keep updated_at fresh on edits.
create or replace function public.set_forms_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists forms_set_updated_at on public.forms;
create trigger forms_set_updated_at
  before update on public.forms
  for each row execute function public.set_forms_updated_at();
