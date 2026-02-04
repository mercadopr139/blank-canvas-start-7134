-- Drop the existing check constraint
ALTER TABLE public.service_logs DROP CONSTRAINT IF EXISTS service_logs_billing_method_check;

-- Add new check constraint allowing per_day, hourly, and flat_rate
ALTER TABLE public.service_logs ADD CONSTRAINT service_logs_billing_method_check 
CHECK (billing_method IN ('per_day', 'hourly', 'flat_rate'));