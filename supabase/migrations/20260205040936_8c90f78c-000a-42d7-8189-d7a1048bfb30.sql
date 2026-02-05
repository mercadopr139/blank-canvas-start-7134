-- Add counseling services waiver fields
ALTER TABLE public.youth_registrations 
ADD COLUMN counseling_services_name TEXT,
ADD COLUMN counseling_services_signature_url TEXT,
ADD COLUMN child_headshot_url TEXT,
ADD COLUMN final_signature_name TEXT;

-- Make these required by updating to NOT NULL with a default for existing rows
-- (Since table is likely empty, we can just make them required going forward)