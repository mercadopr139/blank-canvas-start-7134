-- Strength & Conditioning Coach — Phase 1
--
-- One row per training week (keyed by the Monday date). The three training days'
-- workouts (Mon = Bench, Wed = Squat, Thu = Deadlift) are stored as structured
-- JSON produced by the strength-coach edge function. A week is a "draft" until the
-- coach reviews and locks it; locking freezes it for the gym board.
--
-- This is an internal gym tool with no login (the onsite coach opens one screen on
-- the big board), so RLS allows anon + authenticated read/write on THIS TABLE ONLY.
-- The data is non-sensitive (workout plans — no youth PII).

create table if not exists public.strength_weeks (
  id uuid primary key default gen_random_uuid(),
  week_start date not null unique,                       -- the Monday of the week
  status text not null default 'draft' check (status in ('draft', 'locked')),
  days jsonb not null default '{}'::jsonb,               -- { monday:{...}, wednesday:{...}, thursday:{...} }
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.strength_weeks is
  'S&C Coach weekly workouts (Phase 1). One row per Monday-keyed week; days jsonb holds Mon/Wed/Thu structured workouts.';

-- keep updated_at fresh on every write
create or replace function public.touch_strength_weeks_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_strength_weeks on public.strength_weeks;
create trigger trg_touch_strength_weeks
  before update on public.strength_weeks
  for each row execute function public.touch_strength_weeks_updated_at();

alter table public.strength_weeks enable row level security;

drop policy if exists "strength_weeks_read" on public.strength_weeks;
create policy "strength_weeks_read" on public.strength_weeks
  for select using (true);

drop policy if exists "strength_weeks_insert" on public.strength_weeks;
create policy "strength_weeks_insert" on public.strength_weeks
  for insert with check (true);

drop policy if exists "strength_weeks_update" on public.strength_weeks;
create policy "strength_weeks_update" on public.strength_weeks
  for update using (true) with check (true);

grant select, insert, update on public.strength_weeks to anon, authenticated;
