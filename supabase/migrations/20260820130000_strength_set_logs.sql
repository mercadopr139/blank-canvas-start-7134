-- Strength & Conditioning Coach — per-athlete working-set logging
--
-- One row per athlete per training day: the weight + reps they hit on each of the
-- main lift's working sets. Accessories are NOT logged (by design). This is the raw
-- data behind future S&C intelligence (progress, PRs, "beat last week").
--
-- Same access model as strength_weeks: an internal gym tool with no login (kids log
-- on the big board), so RLS allows anon + authenticated read/write on THIS TABLE ONLY.

create table if not exists public.strength_set_logs (
  id uuid primary key default gen_random_uuid(),
  workout_date date not null,                              -- the actual Mon/Wed/Thu date
  week_start date not null,                                -- the Monday (ties back to strength_weeks)
  day_key text not null check (day_key in ('monday', 'wednesday', 'thursday')),
  youth_id uuid references public.youth_registrations(id) on delete set null,
  athlete_name text not null,
  lift text not null,                                      -- e.g. "Bench Press"
  sets jsonb not null default '[]'::jsonb,                 -- [{ set:1, weight:number|null, reps:number|null }, ...]
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workout_date, youth_id)                          -- one log per athlete per session (upsert target)
);

create index if not exists idx_strength_set_logs_youth on public.strength_set_logs (youth_id, workout_date desc);
create index if not exists idx_strength_set_logs_date on public.strength_set_logs (workout_date);

comment on table public.strength_set_logs is
  'S&C per-athlete working-set logs (weight + reps for the main lift). Feeds S&C intelligence / PRs.';

create or replace function public.touch_strength_set_logs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_strength_set_logs on public.strength_set_logs;
create trigger trg_touch_strength_set_logs
  before update on public.strength_set_logs
  for each row execute function public.touch_strength_set_logs_updated_at();

alter table public.strength_set_logs enable row level security;

drop policy if exists "strength_set_logs_read" on public.strength_set_logs;
create policy "strength_set_logs_read" on public.strength_set_logs
  for select using (true);

drop policy if exists "strength_set_logs_insert" on public.strength_set_logs;
create policy "strength_set_logs_insert" on public.strength_set_logs
  for insert with check (true);

drop policy if exists "strength_set_logs_update" on public.strength_set_logs;
create policy "strength_set_logs_update" on public.strength_set_logs
  for update using (true) with check (true);

drop policy if exists "strength_set_logs_delete" on public.strength_set_logs;
create policy "strength_set_logs_delete" on public.strength_set_logs
  for delete using (true);

grant select, insert, update, delete on public.strength_set_logs to anon, authenticated;
