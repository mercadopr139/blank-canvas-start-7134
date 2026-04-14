-- Make buckets private
UPDATE storage.buckets SET public = false WHERE id IN ('youth-photos', 'registration-signatures');

-- Drop any existing overly-permissive storage policies for these buckets
DROP POLICY IF EXISTS "Public read access for youth photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view youth photos" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for registration signatures" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view registration signatures" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload youth photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update youth photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete youth photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload registration signatures" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update registration signatures" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete registration signatures" ON storage.objects;

-- Allow anyone to READ individual files (needed for kiosk photo display)
CREATE POLICY "Anon can read youth photos"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'youth-photos');

CREATE POLICY "Anon can read registration signatures"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'registration-signatures');

-- Only admins can upload/modify/delete
CREATE POLICY "Admins can upload youth photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'youth-photos' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update youth photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'youth-photos' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete youth photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'youth-photos' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can upload registration signatures"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'registration-signatures' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update registration signatures"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'registration-signatures' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete registration signatures"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'registration-signatures' AND public.has_role(auth.uid(), 'admin'::public.app_role));
