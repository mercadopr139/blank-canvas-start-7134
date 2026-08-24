-- Smile Lab Board (Phase 1) — weekly session journal
--
-- One row per Smile Lab session (per Tuesday). Coaches Jaime & Chrissy journal the
-- day's two stations (free-text), star standout moments, and attach photos — all on
-- the gym board with no login. This is the raw material the (Phase 2) grant report
-- will be written from. Attendance itself stays in attendance_records.
--
-- Internal gym tool, no login → RLS allows anon + authenticated read/write on this
-- table + its photo bucket only. Content is program notes/photos, not youth PII.

create table if not exists public.smile_lab_sessions (
  id           uuid primary key default gen_random_uuid(),
  session_date date not null unique,
  caring_note  text,                                  -- 🦷 Caring for Your Smile (Jaime)
  sharing_note text,                                  -- 😊 Sharing Your Smile (Chrissy)
  highlights   jsonb not null default '[]'::jsonb,    -- standout moments (one string per story)
  photos       jsonb not null default '[]'::jsonb,    -- array of public photo URLs
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.smile_lab_sessions is
  'Smile Lab weekly journal (Phase 1): per-Tuesday station notes, standout moments, photos. Feeds grant reporting.';

create or replace function public.touch_smile_lab_sessions_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists trg_touch_smile_lab_sessions on public.smile_lab_sessions;
create trigger trg_touch_smile_lab_sessions
  before update on public.smile_lab_sessions
  for each row execute function public.touch_smile_lab_sessions_updated_at();

alter table public.smile_lab_sessions enable row level security;

drop policy if exists "smile_lab_sessions_read" on public.smile_lab_sessions;
create policy "smile_lab_sessions_read" on public.smile_lab_sessions for select using (true);

drop policy if exists "smile_lab_sessions_insert" on public.smile_lab_sessions;
create policy "smile_lab_sessions_insert" on public.smile_lab_sessions for insert with check (true);

drop policy if exists "smile_lab_sessions_update" on public.smile_lab_sessions;
create policy "smile_lab_sessions_update" on public.smile_lab_sessions for update using (true) with check (true);

grant select, insert, update on public.smile_lab_sessions to anon, authenticated;

-- Who checked in for Smile Lab on a given date (names for the board's attendance panel).
create or replace function public.get_smile_lab_attendance(_date date)
returns table (child_first_name text, child_last_name text)
language sql stable security definer set search_path = public
as $$
  select yr.child_first_name, yr.child_last_name
  from public.attendance_records ar
  join public.youth_registrations yr on yr.id = ar.registration_id
  where ar.program_source = 'Smile Lab'
    and ar.check_in_date = _date
  order by yr.child_first_name asc, yr.child_last_name asc;
$$;

grant execute on function public.get_smile_lab_attendance(date) to anon, authenticated;

-- Public bucket for journal photos (board has no login → anon may upload/remove).
insert into storage.buckets (id, name, public)
values ('smile-lab-photos', 'smile-lab-photos', true)
on conflict (id) do nothing;

drop policy if exists "smile_lab_photos_read" on storage.objects;
create policy "smile_lab_photos_read" on storage.objects
  for select to public using (bucket_id = 'smile-lab-photos');

drop policy if exists "smile_lab_photos_insert" on storage.objects;
create policy "smile_lab_photos_insert" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'smile-lab-photos');

drop policy if exists "smile_lab_photos_delete" on storage.objects;
create policy "smile_lab_photos_delete" on storage.objects
  for delete to anon, authenticated using (bucket_id = 'smile-lab-photos');
