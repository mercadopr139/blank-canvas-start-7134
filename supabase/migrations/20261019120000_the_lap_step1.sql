-- The Lap, step 1 (docs/LAP_PLAN.md): the data, and the Agenda Meeting tile.
--
-- A commitment made in the weekly agenda is an ordinary Workbench task
-- (a `signals` row) in the owner's "Agenda Meeting" tile. A commitment with
-- two owners is one row PER OWNER, tied together by lap_commitment_id, so
-- each owner plans it on their own day; a trigger keeps their status in
-- step, so done by either is done for both. (The plan said one row with an
-- owner array; two linked rows keep every existing Workbench read — tile
-- grouping, Today's Plan, the tile page — exactly as it is.)

-- ─── 1. The checkpoints: the 21 agenda topics, by pillar, in their order ───
CREATE TABLE IF NOT EXISTS public.lap_topics (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pillar      text NOT NULL CHECK (pillar IN ('operations', 'sales_marketing', 'finance')),
  title       text NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0,
  /** Retired topics keep their history and open commitments; they just leave the ring. */
  retired_at  timestamptz,
  /** A topic added for one lap only. */
  this_lap_only_lap_id uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lap_topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY lap_topics_admin_select ON public.lap_topics FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY lap_topics_admin_insert ON public.lap_topics FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY lap_topics_admin_update ON public.lap_topics FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY lap_topics_admin_delete ON public.lap_topics FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Seeded from the old agenda's topics (depth 1, not archived), pillar by
-- pillar in the order they were kept. Idempotent: only when empty.
INSERT INTO public.lap_topics (pillar, title, sort_order)
SELECT a.pillar::text, a.title,
       row_number() OVER (PARTITION BY a.pillar ORDER BY a.sort_order, a.created_at) - 1
  FROM public.agenda_items a
 WHERE a.depth = 1 AND NOT a.is_archived
   AND NOT EXISTS (SELECT 1 FROM public.lap_topics);

-- ─── 2. The laps themselves ───
CREATE TABLE IF NOT EXISTS public.laps (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_date      date NOT NULL,
  status            text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'finished', 'incomplete')),
  started_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at        timestamptz NOT NULL DEFAULT now(),
  paused_at         timestamptz,
  finished_at       timestamptz,
  current_topic_id  uuid REFERENCES public.lap_topics(id) ON DELETE SET NULL,
  stats             jsonb NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE public.laps ENABLE ROW LEVEL SECURITY;
CREATE POLICY laps_admin_select ON public.laps FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY laps_admin_insert ON public.laps FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY laps_admin_update ON public.laps FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY laps_admin_delete ON public.laps FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
ALTER TABLE public.lap_topics
  ADD CONSTRAINT lap_topics_this_lap_only_fk FOREIGN KEY (this_lap_only_lap_id) REFERENCES public.laps(id) ON DELETE SET NULL;

-- ─── 3. A commitment is a Workbench task that remembers its meeting ───
ALTER TABLE public.signals
  ADD COLUMN IF NOT EXISTS lap_id                 uuid REFERENCES public.laps(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lap_topic_id           uuid REFERENCES public.lap_topics(id) ON DELETE SET NULL,
  /** Shared by the one row per owner of the same commitment. */
  ADD COLUMN IF NOT EXISTS lap_commitment_id      uuid,
  ADD COLUMN IF NOT EXISTS carried_from_signal_id uuid REFERENCES public.signals(id) ON DELETE SET NULL,
  /** Carried forward this many laps: red at 2, a forced decision at 3. */
  ADD COLUMN IF NOT EXISTS carry_count            integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dropped_reason         text;
CREATE INDEX IF NOT EXISTS signals_lap_commitment_idx ON public.signals (lap_commitment_id) WHERE lap_commitment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS signals_lap_idx ON public.signals (lap_id) WHERE lap_id IS NOT NULL;

-- Done by either owner is done for both: the sibling rows follow a status
-- change (and a reopen) — once, never in a loop.
CREATE OR REPLACE FUNCTION public.signals_sync_lap_commitment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.lap_commitment_id IS NULL OR pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE public.signals
       SET status = NEW.status,
           completed_at = NEW.completed_at,
           updated_at = now()
     WHERE lap_commitment_id = NEW.lap_commitment_id
       AND id <> NEW.id
       AND status IS DISTINCT FROM NEW.status;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS signals_sync_lap_commitment ON public.signals;
CREATE TRIGGER signals_sync_lap_commitment
  AFTER UPDATE OF status ON public.signals
  FOR EACH ROW EXECUTE FUNCTION public.signals_sync_lap_commitment();

-- ─── 4. The Agenda Meeting tile, on every Workbench, right after NLA ───
-- (The 2026-06-03 migration dropped an earlier "agenda" tile because the
-- send-over then targeted the NLA tile instead. This tile is the point.)
UPDATE public.focus_areas SET sort_order = sort_order + 1 WHERE key <> 'nla' AND sort_order >= 1;
INSERT INTO public.focus_areas (manager_type, key, title, subtitle, icon_name, accent_color, sort_order, is_default)
SELECT DISTINCT f.manager_type, 'agenda', 'Agenda Meeting', 'What we committed to this week', 'flag', '#bf0f3e', 1, true
  FROM public.focus_areas f
ON CONFLICT (manager_type, key) DO NOTHING;
