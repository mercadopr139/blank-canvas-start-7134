-- Move agenda_items from a single owner_user_id to an array of owners.
-- Internal staff often tag-team a topic (e.g., a "Schedule" item Josh
-- and Chrissy share), so a single owner was already squeezing reality.
--
-- We trade column-level FK enforcement for array simplicity — the
-- referenced auth.users may stick around as a dead uuid if a user is
-- deleted. Internal staff turnover is low enough that this is fine;
-- if it ever becomes a problem we can switch to a junction table.

ALTER TABLE public.agenda_items
  ADD COLUMN IF NOT EXISTS owner_user_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

-- Backfill: pull any existing single owner into the new array.
UPDATE public.agenda_items
SET owner_user_ids = ARRAY[owner_user_id]
WHERE owner_user_id IS NOT NULL
  AND cardinality(owner_user_ids) = 0;

-- GIN index for "items assigned to user X" lookups (My Tasks view
-- in Phase 5 will lean on this).
CREATE INDEX IF NOT EXISTS idx_agenda_items_owners
  ON public.agenda_items USING gin(owner_user_ids);

-- Drop the old single-owner column + its narrow index.
DROP INDEX IF EXISTS public.idx_agenda_items_owner;
ALTER TABLE public.agenda_items
  DROP COLUMN IF EXISTS owner_user_id;
