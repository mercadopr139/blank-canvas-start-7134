-- Grant Coach, step 1 (docs/grant-coach/README.md): the About NLA library and
-- the organization document vault — the facts and files every funder asks
-- for, filled once and kept current.
--
-- The library's FIELDS (sections, labels, help, website seeds) live in code
-- (src/lib/grantCoach/orgProfile.ts); this table holds only the values a
-- person saved, keyed by field. A field with no row shows its website seed.

CREATE TABLE IF NOT EXISTS public.grant_org_fields (
  key         text PRIMARY KEY,
  value       text,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.grant_org_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY grant_org_fields_admin_select ON public.grant_org_fields FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY grant_org_fields_admin_insert ON public.grant_org_fields FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY grant_org_fields_admin_update ON public.grant_org_fields FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY grant_org_fields_admin_delete ON public.grant_org_fields FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- The organization-wide attachments (990, determination letter, approved
-- budget, audit…), one row per catalog key (src/lib/grantCoach/orgDocuments.ts).
-- Either a file in the private grant-documents bucket, or a link (Drive).
CREATE TABLE IF NOT EXISTS public.grant_org_documents (
  key           text PRIMARY KEY,
  storage_path  text,
  file_name     text,
  mime_type     text,
  size_bytes    bigint,
  link_url      text,
  note          text,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.grant_org_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY grant_org_documents_admin_select ON public.grant_org_documents FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY grant_org_documents_admin_insert ON public.grant_org_documents FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY grant_org_documents_admin_update ON public.grant_org_documents FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY grant_org_documents_admin_delete ON public.grant_org_documents FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- The files themselves: a private bucket, admins only, read through signed
-- URLs. Grant folders (step 2) will keep the funder's documents here too,
-- under their own prefix.
INSERT INTO storage.buckets (id, name, public)
VALUES ('grant-documents', 'grant-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY grant_documents_admin_select
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'grant-documents' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY grant_documents_admin_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'grant-documents' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY grant_documents_admin_update
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'grant-documents' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'grant-documents' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY grant_documents_admin_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'grant-documents' AND public.has_role(auth.uid(), 'admin'));
