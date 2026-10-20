-- The Lap checklist (Josh, 2026-10-19): a line can carry a web address
-- ("USA Boxing National Schedule" opens the USA Boxing site) or one file (a
-- PDF or an image), beside the app-page link it already has. Files live in
-- a private bucket, admins only, read through signed URLs.
ALTER TABLE public.lap_checklist_items
  ADD COLUMN IF NOT EXISTS link_url        text,
  ADD COLUMN IF NOT EXISTS attachment_path text,
  ADD COLUMN IF NOT EXISTS attachment_name text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('lap-files', 'lap-files', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS lap_files_admin_select ON storage.objects;
DROP POLICY IF EXISTS lap_files_admin_insert ON storage.objects;
DROP POLICY IF EXISTS lap_files_admin_update ON storage.objects;
DROP POLICY IF EXISTS lap_files_admin_delete ON storage.objects;
CREATE POLICY lap_files_admin_select
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'lap-files' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY lap_files_admin_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'lap-files' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY lap_files_admin_update
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'lap-files' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'lap-files' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY lap_files_admin_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'lap-files' AND public.has_role(auth.uid(), 'admin'));

NOTIFY pgrst, 'reload schema';
SELECT 'Checklist lines can carry a link or a file' AS result;
