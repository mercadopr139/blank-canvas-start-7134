-- Allow additional rate types in per-partner services
ALTER TABLE public.client_services
  DROP CONSTRAINT IF EXISTS client_services_rate_type_check;

ALTER TABLE public.client_services
  ADD CONSTRAINT client_services_rate_type_check
  CHECK (rate_type IN (
    'per_day',
    'per_session',
    'per_hour',
    'flat_monthly',
    'sponsorship',
    'other_service'
  ));
