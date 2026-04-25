-- Capture the parent's raw answer for "How many siblings in Child's primary household?"
-- The legacy import (parseInt of text answers, e.g. "Child + 1 sibling") corrupted
-- the numeric siblings_in_household column, so we preserve the raw text answer here
-- for analytics and so any future correction can be derived from a trustworthy field.
ALTER TABLE public.youth_registrations
  ADD COLUMN IF NOT EXISTS siblings_breakdown text;

COMMENT ON COLUMN public.youth_registrations.siblings_breakdown IS
  'Raw answer from the siblings_in_household question: e.g. "Only child", "Child + 1 sibling", "Child + 2 siblings", "Other". Preserved alongside the numeric siblings_in_household field for demographic reporting.';
