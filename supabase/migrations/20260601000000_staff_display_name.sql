-- Add a `display_name` column on staff_profiles so the admin UI can
-- disambiguate staffers who share a first name. Falls back to
-- full_name when unset.
--
-- Backfill for the only collision today: two Joshes on the team. Josh
-- Mercado keeps "Josh" (he's the program director and the default
-- "Josh" everyone refers to). Josh Sanchez becomes "Sanchez" so the
-- team can quickly tell who's who in lists, avatars, etc.
--
-- Initials stay derived from full_name so avatar bubbles still read
-- "JS" / "JM" — display_name only affects label positions.

ALTER TABLE public.staff_profiles
  ADD COLUMN IF NOT EXISTS display_name text;

UPDATE public.staff_profiles
SET display_name = 'Josh'
WHERE full_name = 'Josh Mercado'
  AND display_name IS NULL;

UPDATE public.staff_profiles
SET display_name = 'Sanchez'
WHERE full_name = 'Josh Sanchez'
  AND display_name IS NULL;
