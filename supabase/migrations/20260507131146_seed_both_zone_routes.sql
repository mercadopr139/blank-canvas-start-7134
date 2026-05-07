-- Step 2 of two-step add: insert the actual route rows now that the
-- enum values are committed. Idempotent — uses NOT EXISTS instead of
-- ON CONFLICT (the routes.name column is an enum without a unique
-- constraint).

INSERT INTO public.routes (name)
SELECT v.name::public.route_name
FROM (VALUES ('Both - Woodbine'), ('Both - Wildwood')) AS v(name)
WHERE NOT EXISTS (
  SELECT 1 FROM public.routes r WHERE r.name::text = v.name
);
