ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'new';
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS incident_type text NOT NULL DEFAULT 'General';