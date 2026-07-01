-- "In the Works": a personal, cross-focus-area watchlist that hangs as a
-- pennant on the Workbench. Unlike signals, these are NOT tasks to check
-- off — they're longer-running initiatives (e.g. "Youth chapel construction")
-- the owner wants to revisit periodically to make sure they're still moving.
--
-- The core signal each item carries is last_touched_at: tapping an item
-- stamps it "touched now", and the UI ages that stamp ("3w ago") so a glance
-- tells you what's stalling. There is no completion state.
--
-- Strictly personal: every row is owned by a single user (owner_email) and
-- RLS enforces that a user can only see/most/edit their own rows — unlike
-- focus_area_notes, which are shared team context.

CREATE TABLE public.workbench_watch_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email     text NOT NULL,
  title           text NOT NULL,
  sort_order      integer NOT NULL DEFAULT 0,
  last_touched_at timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_workbench_watch_items_owner
  ON public.workbench_watch_items (owner_email, sort_order);

ALTER TABLE public.workbench_watch_items ENABLE ROW LEVEL SECURITY;

-- Personal scope: a user only ever touches rows stamped with their own email.
-- (auth.jwt()->>'email' is the signed-in user's email from the Supabase JWT.)
CREATE POLICY "Own read watch items"   ON public.workbench_watch_items FOR SELECT TO authenticated USING ((auth.jwt() ->> 'email') = owner_email);
CREATE POLICY "Own insert watch items" ON public.workbench_watch_items FOR INSERT TO authenticated WITH CHECK ((auth.jwt() ->> 'email') = owner_email);
CREATE POLICY "Own update watch items" ON public.workbench_watch_items FOR UPDATE TO authenticated USING ((auth.jwt() ->> 'email') = owner_email) WITH CHECK ((auth.jwt() ->> 'email') = owner_email);
CREATE POLICY "Own delete watch items" ON public.workbench_watch_items FOR DELETE TO authenticated USING ((auth.jwt() ->> 'email') = owner_email);
