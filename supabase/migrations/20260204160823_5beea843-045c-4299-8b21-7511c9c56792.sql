-- Add billing fields to clients table
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS default_billing_method TEXT DEFAULT 'hourly' CHECK (default_billing_method IN ('hourly', 'flat_rate')),
ADD COLUMN IF NOT EXISTS default_flat_rate NUMERIC DEFAULT NULL;

-- Add billing fields to service_logs table
ALTER TABLE public.service_logs
ADD COLUMN IF NOT EXISTS billing_method TEXT DEFAULT 'hourly' CHECK (billing_method IN ('hourly', 'flat_rate')),
ADD COLUMN IF NOT EXISTS hours INTEGER DEFAULT NULL CHECK (hours IS NULL OR (hours >= 1 AND hours <= 8)),
ADD COLUMN IF NOT EXISTS flat_amount NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS line_total NUMERIC DEFAULT 0;