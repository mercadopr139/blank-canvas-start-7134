-- Grant Coach, step 2 (lean): one folder per grant, its checklist, and the
-- funder's documents. The O.C.E.A.N. 2027 checklist is written from the
-- captured form (src/lib/grantCoach/oceanChecklist.ts); AI extraction of a
-- checklist from uploaded documents comes after the Oct 30 deadline.

CREATE TABLE IF NOT EXISTS public.grant_folders (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  funder        text NOT NULL,
  program_name  text,
  status        text NOT NULL DEFAULT 'applying'
                CHECK (status IN ('applying', 'submitted', 'active', 'declined', 'closed')),
  due_at        timestamptz,
  amount_requested numeric,
  amount_awarded   numeric,
  period_start  date,
  period_end    date,
  portal_url    text,
  notes         text,
  /** Which built-in checklist seeded this folder (e.g. 'ocean-2027'), if any. */
  template_key  text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.grant_folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY grant_folders_admin_select ON public.grant_folders FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY grant_folders_admin_insert ON public.grant_folders FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY grant_folders_admin_update ON public.grant_folders FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY grant_folders_admin_delete ON public.grant_folders FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- The spine: every requirement the funder set, with its status.
CREATE TABLE IF NOT EXISTS public.grant_checklist_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id   uuid NOT NULL REFERENCES public.grant_folders(id) ON DELETE CASCADE,
  section     text NOT NULL,
  label       text NOT NULL,
  detail      text,
  kind        text NOT NULL DEFAULT 'field'
              CHECK (kind IN ('eligibility', 'field', 'narrative', 'upload', 'acknowledgment', 'signature', 'task')),
  required    boolean NOT NULL DEFAULT true,
  status      text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done', 'na')),
  owner       text,
  due_on      date,
  answer      text,
  sort_order  integer NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS grant_checklist_items_folder_idx ON public.grant_checklist_items (folder_id, sort_order);
ALTER TABLE public.grant_checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY grant_checklist_items_admin_select ON public.grant_checklist_items FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY grant_checklist_items_admin_insert ON public.grant_checklist_items FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY grant_checklist_items_admin_update ON public.grant_checklist_items FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY grant_checklist_items_admin_delete ON public.grant_checklist_items FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- What the funder sent, and what NLA wrote for them. Files live in the
-- grant-documents bucket under grants/<folder id>/.
CREATE TABLE IF NOT EXISTS public.grant_documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id     uuid NOT NULL REFERENCES public.grant_folders(id) ON DELETE CASCADE,
  side          text NOT NULL DEFAULT 'funder' CHECK (side IN ('funder', 'ours')),
  title         text NOT NULL,
  storage_path  text,
  file_name     text,
  mime_type     text,
  size_bytes    bigint,
  link_url      text,
  uploaded_at   timestamptz NOT NULL DEFAULT now(),
  uploaded_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS grant_documents_folder_idx ON public.grant_documents (folder_id, uploaded_at);
ALTER TABLE public.grant_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY grant_documents_admin_select ON public.grant_documents FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY grant_documents_admin_insert ON public.grant_documents FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY grant_documents_admin_update ON public.grant_documents FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY grant_documents_admin_delete ON public.grant_documents FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
