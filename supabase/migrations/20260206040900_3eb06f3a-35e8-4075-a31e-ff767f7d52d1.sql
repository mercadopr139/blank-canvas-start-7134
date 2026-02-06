-- Fix STORAGE_EXPOSURE: Make registration-signatures bucket private
-- This protects children's signatures and headshot photos from public access

-- Step 1: Make the bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'registration-signatures';

-- Step 2: Drop any existing public policies on this bucket
DROP POLICY IF EXISTS "Public can upload signatures" ON storage.objects;
DROP POLICY IF EXISTS "Public can view signatures" ON storage.objects;
DROP POLICY IF EXISTS "Allow public uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public reads" ON storage.objects;

-- Step 3: Create secure policies - Allow public INSERT for form submissions
CREATE POLICY "Anyone can upload registration files"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'registration-signatures');

-- Step 4: Only admins can view files (using has_role function)
CREATE POLICY "Admins can view registration files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'registration-signatures' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Step 5: Only admins can delete files
CREATE POLICY "Admins can delete registration files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'registration-signatures' 
  AND has_role(auth.uid(), 'admin'::app_role)
);