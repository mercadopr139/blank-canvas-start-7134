-- Create youth-photos storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('youth-photos', 'youth-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to youth photos
CREATE POLICY "Public can view youth photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'youth-photos');

-- Allow kiosk users to upload/update youth photos
CREATE POLICY "Kiosk can upload youth photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'youth-photos');

CREATE POLICY "Kiosk can update youth photos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'youth-photos');

-- Allow kiosk to update headshot URL in youth_registrations
CREATE POLICY "Kiosk can update headshot URL"
ON youth_registrations FOR UPDATE
USING (true)
WITH CHECK (true);

-- Enable realtime for youth_registrations table
ALTER PUBLICATION supabase_realtime ADD TABLE youth_registrations;