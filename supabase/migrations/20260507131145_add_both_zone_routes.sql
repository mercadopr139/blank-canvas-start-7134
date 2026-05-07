-- Step 1 of two-step add: extend the route_name enum with the two
-- zone-aware Both variants. The actual route rows go in via the next
-- migration (Postgres requires ALTER TYPE ADD VALUE to commit before
-- the value can be used).

ALTER TYPE public.route_name ADD VALUE IF NOT EXISTS 'Both - Woodbine';
ALTER TYPE public.route_name ADD VALUE IF NOT EXISTS 'Both - Wildwood';
