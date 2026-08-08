-- ═══════════════════════════════════════════════════════════════════
-- One-time data fix: bring ALL excursions onto the new "driver is a
-- counted rider" model (including finished/old trips, per Josh).
-- ═══════════════════════════════════════════════════════════════════
-- Trips built before the driver-as-participant change carry two bits of
-- stale data:
--   1. Vehicle seat_cap that EXCLUDED the driver (Van 14, Mini-Van 6,
--      Mini-Bus 21) — should now INCLUDE the driver (15 / 7 / 22).
--   2. A typed-in `driver_name` on the vehicle that isn't a person, so the
--      driver takes no seat and isn't counted (e.g. "Pastor Harris").
--
-- This fixes both for EVERY trip (open and closed). It converts each
-- typed-in driver into ONE counted rider (a personnel row that rides in
-- AND drives the van) and clears the legacy name so nothing double-counts.
-- Youth-reached numbers are unaffected — drivers are personnel, never youth.
--
-- Idempotent: capacities are set to absolute values, and driver conversion
-- only touches vehicles that still have a legacy driver_name (cleared here),
-- so re-running is a no-op.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- 1) Correct standard vehicle capacities to INCLUDE the driver seat.
UPDATE public.excursion_vehicles
SET seat_cap = CASE
  WHEN name ILIKE '%mini%bus%' THEN 22
  WHEN name ILIKE '%mini%van%' THEN 7
  WHEN name ILIKE '%van%'      THEN 15
  ELSE seat_cap
END;

-- 2a) If the typed-in driver is ALREADY loaded as a rider in that van
--     (same name), just promote that person to driver — don't create a copy.
UPDATE public.excursion_personnel p
SET driving_vehicle_id = v.id
FROM public.excursion_vehicles v
WHERE p.vehicle_id = v.id
  AND v.driver_name IS NOT NULL AND btrim(v.driver_name) <> ''
  AND lower(btrim(p.name)) = lower(btrim(v.driver_name))
  AND NOT EXISTS (SELECT 1 FROM public.excursion_personnel d WHERE d.driving_vehicle_id = v.id);

-- 2b) Otherwise, create the typed-in driver as ONE counted rider
--     (rides in the van AND drives it).
INSERT INTO public.excursion_personnel (excursion_id, name, vehicle_id, driving_vehicle_id)
SELECT v.excursion_id, btrim(v.driver_name), v.id, v.id
FROM public.excursion_vehicles v
WHERE v.driver_name IS NOT NULL AND btrim(v.driver_name) <> ''
  AND NOT EXISTS (SELECT 1 FROM public.excursion_personnel d WHERE d.driving_vehicle_id = v.id);

-- 2c) Clear the legacy typed-in name now that the driver is a real person,
--     so the driver is never counted twice.
UPDATE public.excursion_vehicles v
SET driver_name = NULL
WHERE v.driver_name IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.excursion_personnel d WHERE d.driving_vehicle_id = v.id);

COMMIT;
