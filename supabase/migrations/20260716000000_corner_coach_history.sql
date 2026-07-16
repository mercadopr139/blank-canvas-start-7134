-- Corner Coach history: saves each completed Q&A so it can be reopened,
-- pinned, archived, or deleted. One row per question the operator asks.
--
-- Corner Coach is gated to the super-admin in both the UI and the edge
-- function, so in practice every row here belongs to that one account. RLS
-- still scopes each row to its owner (auth.uid()) as defense in depth.
create table if not exists public.corner_coach_history (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  question   text not null,
  answer     text not null,
  steps      jsonb,                       -- the SQL steps, so a reopened answer shows its work
  pinned     boolean not null default false,
  archived   boolean not null default false,
  created_at timestamptz not null default now()
);

-- Newest-first listing per user is the only access pattern.
create index if not exists corner_coach_history_user_created_idx
  on public.corner_coach_history (user_id, created_at desc);

alter table public.corner_coach_history enable row level security;

-- Owner-only access across the board.
create policy "corner_coach_history_select_own" on public.corner_coach_history
  for select using (auth.uid() = user_id);
create policy "corner_coach_history_insert_own" on public.corner_coach_history
  for insert with check (auth.uid() = user_id);
create policy "corner_coach_history_update_own" on public.corner_coach_history
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "corner_coach_history_delete_own" on public.corner_coach_history
  for delete using (auth.uid() = user_id);

comment on table public.corner_coach_history is
  'Saved Corner Coach Q&A history (super-admin data assistant). Owner-scoped via RLS.';
