-- Each billed service day keeps the rate type it was saved with (Josh,
-- 2026-11-20): per_day, per_hour, sponsorship, adjustment, other_service.
-- The invoice's Type column reads it; a row saved before this stays null
-- and the column falls back to how the row was billed, as it always did.
alter table public.service_logs add column if not exists rate_type text;

notify pgrst, 'reload schema';
