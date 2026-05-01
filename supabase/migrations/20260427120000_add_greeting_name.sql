-- Adds an optional greeting_name field to supporters so outreach personalization
-- can use a friendly short label (e.g. "Mike & Lauren" or "Crest Savings team")
-- when the formal name field would read awkwardly in a message body. Falls back
-- to the name field when null.
ALTER TABLE public.supporters
  ADD COLUMN IF NOT EXISTS greeting_name text;

COMMENT ON COLUMN public.supporters.greeting_name IS
  'Short friendly label used by the bulk outreach merge tokens (e.g. "Mike & Lauren"). Optional — if null, outreach falls back to the name column.';
