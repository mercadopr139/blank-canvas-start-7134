-- Schema for the internal Weekly Agenda feature.
--
-- Design decisions captured here so future migrations don't re-derive them:
--   - 4-level nesting via self-ref parent_id + a depth column. Depth is
--     a smallint with a CHECK so a bug in the app can't smuggle deeper
--     items past the cap.
--   - Pillar reuses the existing mb_pillar enum (operations,
--     sales_marketing, finance) to stay in sync with the Message Board.
--   - Soft-delete uses the dominant is_archived + archived_at pattern.
--   - Per-user "owner" via a nullable FK to auth.users (staff_profiles
--     is the picker source but the canonical key is user_id, matching
--     the rest of the app).
--   - Workbench sync: a single nullable source_agenda_item_id is added
--     to signals so an agenda item and the mirrored signal can find
--     each other in both directions.
--   - Weekly history is stored as JSON snapshots, not deep row copies,
--     so prior weeks are immutable and read-only by construction.

-- ─── 1. agenda_items: the 4-level tree ────────────────────────────────
CREATE TABLE public.agenda_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pillar public.mb_pillar NOT NULL,
  parent_id uuid REFERENCES public.agenda_items(id) ON DELETE CASCADE,
  depth smallint NOT NULL CHECK (depth BETWEEN 1 AND 4),
  title text NOT NULL,
  notes text,
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'signal'
    CHECK (status IN ('signal', 'done', 'on_hold')),
  due_date date,
  is_starred boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  is_archived boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  last_edited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  last_edited_at timestamptz
);

CREATE INDEX idx_agenda_items_pillar_active
  ON public.agenda_items(pillar, is_archived);
CREATE INDEX idx_agenda_items_parent
  ON public.agenda_items(parent_id);
CREATE INDEX idx_agenda_items_owner
  ON public.agenda_items(owner_user_id) WHERE owner_user_id IS NOT NULL;
CREATE INDEX idx_agenda_items_status_due
  ON public.agenda_items(status, due_date);

ALTER TABLE public.agenda_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY agenda_items_admin_all ON public.agenda_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ─── 2. agenda_item_links: per-item URLs with nicknames ────────────────
CREATE TABLE public.agenda_item_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.agenda_items(id) ON DELETE CASCADE,
  url text NOT NULL,
  nickname text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX idx_agenda_item_links_item ON public.agenda_item_links(item_id);
ALTER TABLE public.agenda_item_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY agenda_item_links_admin_all ON public.agenda_item_links
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ─── 3. agenda_attachments: PDFs + images per item ─────────────────────
CREATE TABLE public.agenda_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.agenda_items(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  filename text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX idx_agenda_attachments_item ON public.agenda_attachments(item_id);
ALTER TABLE public.agenda_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY agenda_attachments_admin_all ON public.agenda_attachments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ─── 4. agenda_activity_log: who did what when ─────────────────────────
CREATE TABLE public.agenda_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.agenda_items(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  changed_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_agenda_activity_log_item
  ON public.agenda_activity_log(item_id, created_at DESC);
ALTER TABLE public.agenda_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY agenda_activity_log_admin_select ON public.agenda_activity_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY agenda_activity_log_admin_insert ON public.agenda_activity_log
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ─── 5. agenda_week_snapshots: frozen prior weeks ──────────────────────
-- One row per week. snapshot holds the entire tree as JSON so prior
-- weeks render identically forever, regardless of what happens to the
-- live agenda_items going forward.
CREATE TABLE public.agenda_week_snapshots (
  week_start_date date PRIMARY KEY,
  snapshot jsonb NOT NULL,
  summary text,
  frozen_at timestamptz NOT NULL DEFAULT now(),
  frozen_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.agenda_week_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY agenda_week_snapshots_admin_all ON public.agenda_week_snapshots
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ─── 6. agenda_week_summary: meeting-lead free-text per active week ───
-- Separate from snapshots so the current week's summary can be edited
-- live without touching frozen history. On Start New Week the active
-- summary copies into the snapshot row above.
CREATE TABLE public.agenda_week_summary (
  week_start_date date PRIMARY KEY,
  summary text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.agenda_week_summary ENABLE ROW LEVEL SECURITY;
CREATE POLICY agenda_week_summary_admin_all ON public.agenda_week_summary
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ─── 7. signals.source_agenda_item_id: Workbench sync back-ref ─────────
ALTER TABLE public.signals
  ADD COLUMN IF NOT EXISTS source_agenda_item_id uuid
    REFERENCES public.agenda_items(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_signals_source_agenda_item
  ON public.signals(source_agenda_item_id)
  WHERE source_agenda_item_id IS NOT NULL;

-- ─── 8. agenda-attachments storage bucket + policies ───────────────────
-- Private bucket (like message-attachments). Path convention:
-- <item_id>/<filename>. RLS gates access by checking the caller is an
-- admin; we don't scope by item ownership since all admins can
-- read/write all agenda items.
INSERT INTO storage.buckets (id, name, public)
VALUES ('agenda-attachments', 'agenda-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY agenda_attachments_admin_select
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'agenda-attachments' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY agenda_attachments_admin_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'agenda-attachments' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY agenda_attachments_admin_update
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'agenda-attachments' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'agenda-attachments' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY agenda_attachments_admin_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'agenda-attachments' AND public.has_role(auth.uid(), 'admin'));

-- ─── 9. Seed "Agenda" focus area per existing manager_type ─────────────
-- One Agenda focus area per task manager so "Add to <owner>'s
-- Workbench" has a known destination. Idempotent: skip if already
-- present. New manager types added later need their own seed via a
-- follow-up migration or app bootstrap.
INSERT INTO public.focus_areas (key, title, subtitle, manager_type, is_default, accent_color, icon_name, sort_order)
SELECT 'agenda', 'Agenda', 'From the Weekly Agenda', 'PD', false, '#bf0f3e', 'list-todo', 99
WHERE NOT EXISTS (
  SELECT 1 FROM public.focus_areas WHERE key = 'agenda' AND manager_type = 'PD'
);

INSERT INTO public.focus_areas (key, title, subtitle, manager_type, is_default, accent_color, icon_name, sort_order)
SELECT 'agenda', 'Agenda', 'From the Weekly Agenda', 'PC', false, '#bf0f3e', 'list-todo', 99
WHERE NOT EXISTS (
  SELECT 1 FROM public.focus_areas WHERE key = 'agenda' AND manager_type = 'PC'
);

-- ─── 10. Realtime publication for live-meeting collaborative editing ──
-- Subscribe via supabase.channel().on("postgres_changes", ...). Without
-- being in this publication, INSERT/UPDATE/DELETE events won't broadcast.
ALTER PUBLICATION supabase_realtime ADD TABLE public.agenda_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.agenda_item_links;
ALTER PUBLICATION supabase_realtime ADD TABLE public.agenda_attachments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.agenda_week_summary;
