-- SUPERSEDED (2026-09-05). This built the abandoned first Practice Plan —
-- one timeline per night. Replaced by 20260905160000_practice_plan.sql, which
-- models the three groups and the weekly template/week split.
--
-- The file is kept because this migration was already applied to production;
-- deleting it would leave the remote migration history pointing at nothing.
-- The practice_plans table it creates is now unused. See
-- docs/PRACTICE_PLAN_PLAN.md.

-- Practice Plan builder — one editable plan per date (the gym-board schedule).
--
-- A plan is a flexible timeline of blocks (jsonb): each has a time range, title,
-- notes, and optional Battle/Non-Battle columns. Kids view it read-only on the
-- big board (anon); Josh & Chrissy edit it from their own admin login.

create table if not exists public.practice_plans (
  id          uuid primary key default gen_random_uuid(),
  plan_date   date not null unique,
  blocks      jsonb not null default '[]'::jsonb,   -- [{id,start,end,title,notes,battle,nonBattle}]
  night_watch text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.practice_plans is
  'Practice Plan builder: one editable timeline (blocks jsonb) per date, shown on the gym board.';

create or replace function public.touch_practice_plans_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists trg_touch_practice_plans on public.practice_plans;
create trigger trg_touch_practice_plans
  before update on public.practice_plans
  for each row execute function public.touch_practice_plans_updated_at();

alter table public.practice_plans enable row level security;

-- Public read: the gym board (anon) renders the plan.
drop policy if exists "practice_plans_read" on public.practice_plans;
create policy "practice_plans_read" on public.practice_plans for select using (true);

-- Writes: any authenticated staff (the editor is admin-gated in the app).
drop policy if exists "practice_plans_write" on public.practice_plans;
create policy "practice_plans_write" on public.practice_plans
  for all to authenticated using (true) with check (true);

grant select on public.practice_plans to anon, authenticated;
grant insert, update, delete on public.practice_plans to authenticated;
