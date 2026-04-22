-- Add columns that existed in Lovable's database but were missing from migrations

ALTER TABLE public.service_logs
  ADD COLUMN IF NOT EXISTS service_type_id uuid REFERENCES public.service_types(id),
  ADD COLUMN IF NOT EXISTS billing_method text,
  ADD COLUMN IF NOT EXISTS hours numeric,
  ADD COLUMN IF NOT EXISTS flat_amount numeric,
  ADD COLUMN IF NOT EXISTS line_total numeric;

ALTER TABLE public.invoice_sends
  ADD COLUMN IF NOT EXISTS last_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_message_id text,
  ADD COLUMN IF NOT EXISTS provider_status text;
