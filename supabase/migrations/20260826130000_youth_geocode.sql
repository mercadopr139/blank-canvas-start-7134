-- Geocoded home coordinates for youth_registrations, so the Youth-per-District
-- map can plot each youth at their ACTUAL location (from child_primary_address)
-- instead of scattering dots randomly within a school district.
--
-- Populated by the `geocode-youth` edge function (free US Census geocoder).
-- Coordinates are only ever read on the admin-gated Registration Intelligence
-- page (youth_registrations RLS already restricts reads to staff).

alter table public.youth_registrations
  add column if not exists latitude    double precision,
  add column if not exists longitude   double precision,
  add column if not exists geocoded_at timestamptz;

-- Speeds up "rows still needing geocoding" lookups.
create index if not exists idx_youth_needs_geocode
  on public.youth_registrations (geocoded_at)
  where latitude is null;
