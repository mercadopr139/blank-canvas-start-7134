-- Create a private bucket for one-time data exports
INSERT INTO storage.buckets (id, name, public)
VALUES ('data-exports', 'data-exports', false)
ON CONFLICT (id) DO NOTHING;

-- Only admins can list/read export files via storage API (edge function uses service role)
CREATE POLICY "Admins can read data-exports"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'data-exports'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Admins can delete data-exports"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'data-exports'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);
