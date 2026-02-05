-- Add program_title column to clients table for invoice summary label
ALTER TABLE public.clients
ADD COLUMN program_title text DEFAULT NULL;

COMMENT ON COLUMN public.clients.program_title IS 'Custom program/service title to display on invoice summary (e.g., "Hawk Squad Total")';
