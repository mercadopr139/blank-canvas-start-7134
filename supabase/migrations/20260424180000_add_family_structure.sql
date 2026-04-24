-- Capture the parent's raw answer for "Adult(s) in Child's primary household"
-- so that donor-facing analytics can show Dad Only vs Mom Only vs Grandparent
-- breakdowns instead of just collapsing everything to a single/two-adult count.
ALTER TABLE public.youth_registrations
  ADD COLUMN IF NOT EXISTS family_structure text;

COMMENT ON COLUMN public.youth_registrations.family_structure IS
  'Raw answer from the adults_in_household question: e.g. "Dad and Mom", "Mom Only", "Dad Only", "Dad + Partner", "Mom + Partner", "Grandparent(s)", "Other". Preserved alongside the numeric adults_in_household field for demographic reporting.';
