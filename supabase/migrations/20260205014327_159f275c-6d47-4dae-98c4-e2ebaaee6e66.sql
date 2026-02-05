-- Drop the unique constraint that prevents multiple services on the same day
ALTER TABLE public.service_logs 
DROP CONSTRAINT IF EXISTS service_logs_client_id_service_date_key;