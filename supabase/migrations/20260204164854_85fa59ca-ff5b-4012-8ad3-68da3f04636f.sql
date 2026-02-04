-- Add service schedule fields to clients table
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS service_time text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS service_days text;

-- Add comments for clarity
COMMENT ON COLUMN public.clients.service_time IS 'Scheduled service time, e.g. "3pm–5pm"';
COMMENT ON COLUMN public.clients.service_days IS 'Scheduled service days, e.g. "Tuesday & Thursday"';