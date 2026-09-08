-- Non-Battle Team S&C board.
--
-- Separate from the Battle Team board on purpose. Different training days
-- (Mon/Tue/Thu rather than Mon/Wed/Thu), a different session shape (prep →
-- learn+lift → work → reset), three ability tracks side by side, and — the part
-- that actually drives the schema — CONTINUITY. The programming rules forbid
-- random weeks: primary movements hold for a block while the challenge rises.
-- So the unit here is a BLOCK (one calendar month), not a week.
--
-- Like the Battle Team board this is an onsite gym screen with no login, so the
-- workout tables allow anon read/write. They hold no youth PII. The two tables
-- that DO name children — levels and logs — are admin-only.

/* ── A block: one calendar month of training ── */
create table if not exists public.nbt_blocks (
  id            uuid primary key default gen_random_uuid(),
  -- First of the month. One block per month.
  month_start   date not null unique,
  -- The short coaching emphasis for the month: "Own the basics", "Pace yourself".
  focus         text,
  status        text not null default 'draft' check (status in ('draft', 'locked')),
  locked_at     timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.nbt_blocks is
  'One month of Non-Battle Team training. Primary movements hold across the block; the challenge progresses.';

/* ── A week inside a block ── */
create table if not exists public.nbt_weeks (
  id            uuid primary key default gen_random_uuid(),
  block_id      uuid not null references public.nbt_blocks(id) on delete cascade,
  week_start    date not null unique,          -- the Monday
  week_in_block smallint not null check (week_in_block between 1 and 6),
  -- { monday: {...}, tuesday: {...}, thursday: {...} }
  -- Each day: { focus, prep[], lift{ name, charlie{}, bravo{}, alpha{}, cues[] },
  --             work{ emphasis, charlie, bravo, alpha, result_type }, reset[] }
  days          jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_nbt_weeks_block on public.nbt_weeks (block_id, week_in_block);

/* ── Which track an athlete is currently on ──
   A default, not a label. The coach sets it once and the board pre-fills, but a
   youth can be Charlie on the squat and Bravo on the pull, and can move up mid
   block. What they ACTUALLY trained at is recorded on each log row below. */
create table if not exists public.nbt_athlete_levels (
  id              uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.youth_registrations(id) on delete cascade,
  level           text not null default 'charlie' check (level in ('charlie', 'bravo', 'alpha')),
  updated_by      text,
  updated_at      timestamptz not null default now(),
  unique (registration_id)
);

/* ── What a youth actually did ──
   Two numbers a session and no more: the lift, and one result for the circuit.
   Anything longer does not get filled in on a gym floor with thirty kids
   waiting to box. */
create table if not exists public.nbt_logs (
  id              uuid primary key default gen_random_uuid(),
  week_id         uuid references public.nbt_weeks(id) on delete set null,
  workout_date    date not null,
  day_key         text not null check (day_key in ('monday', 'tuesday', 'thursday')),
  registration_id uuid references public.youth_registrations(id) on delete set null,
  athlete_name    text not null,

  -- The track trained THAT DAY. Deliberately copied rather than joined to
  -- nbt_athlete_levels: when a youth moves from Charlie to Alpha in week three,
  -- the history has to keep showing they were Charlie in week one.
  level           text not null check (level in ('charlie', 'bravo', 'alpha')),

  lift            text,                                  -- e.g. "Goblet Squat"
  sets            jsonb not null default '[]'::jsonb,    -- [{ set, weight, reps }]

  -- One number for the conditioning piece, in whatever unit that day asked for.
  work_result     numeric,
  work_unit       text check (work_unit in ('rounds', 'minutes', 'seconds', 'meters', 'reps')),
  notes           text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (workout_date, registration_id)                 -- one log per athlete per session
);

create index if not exists idx_nbt_logs_athlete on public.nbt_logs (registration_id, workout_date desc);
create index if not exists idx_nbt_logs_date on public.nbt_logs (workout_date desc);

/* ── updated_at ── */
create or replace function public.touch_nbt_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists nbt_blocks_touch on public.nbt_blocks;
create trigger nbt_blocks_touch before update on public.nbt_blocks
  for each row execute function public.touch_nbt_updated_at();

drop trigger if exists nbt_weeks_touch on public.nbt_weeks;
create trigger nbt_weeks_touch before update on public.nbt_weeks
  for each row execute function public.touch_nbt_updated_at();

drop trigger if exists nbt_logs_touch on public.nbt_logs;
create trigger nbt_logs_touch before update on public.nbt_logs
  for each row execute function public.touch_nbt_updated_at();

/* ── RLS ──
   Blocks and weeks are workout plans with no PII, and the gym screen has no
   login — same posture as the Battle Team board. Levels and logs name children,
   so they stay admin-only. */
alter table public.nbt_blocks enable row level security;
alter table public.nbt_weeks enable row level security;
alter table public.nbt_athlete_levels enable row level security;
alter table public.nbt_logs enable row level security;

drop policy if exists "nbt_blocks_open" on public.nbt_blocks;
create policy "nbt_blocks_open" on public.nbt_blocks
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "nbt_weeks_open" on public.nbt_weeks;
create policy "nbt_weeks_open" on public.nbt_weeks
  for all to anon, authenticated using (true) with check (true);

-- The board pre-fills a youth's track, so it has to be able to READ the levels.
-- Deciding someone's track is a coaching judgement, so only an admin writes.
drop policy if exists "nbt_levels_read" on public.nbt_athlete_levels;
create policy "nbt_levels_read" on public.nbt_athlete_levels
  for select to anon, authenticated using (true);

drop policy if exists "nbt_levels_write" on public.nbt_athlete_levels;
create policy "nbt_levels_write" on public.nbt_athlete_levels
  for all to authenticated
  using (has_role(auth.uid(), 'admin'))
  with check (has_role(auth.uid(), 'admin'));

-- Logs are written BY THE ATHLETES on the gym screen, which has no login — the
-- same posture as the Battle Team's set logs. A log holds a first and last name
-- and some weights, nothing more; the youth is found through the existing
-- search_kiosk_youth RPC rather than by exposing the registrations table.
drop policy if exists "nbt_logs_open" on public.nbt_logs;
create policy "nbt_logs_open" on public.nbt_logs
  for all to anon, authenticated using (true) with check (true);

grant select, insert, update, delete on public.nbt_logs to anon, authenticated;
grant select on public.nbt_athlete_levels to anon, authenticated;
grant select, insert, update, delete on public.nbt_blocks to anon, authenticated;
grant select, insert, update, delete on public.nbt_weeks to anon, authenticated;
