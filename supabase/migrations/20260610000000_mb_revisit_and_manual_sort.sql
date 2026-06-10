-- Per-user message-board sidebar tweaks:
--
--   1. needs_revisit boolean — a personal "yellow dot" on a conversation
--      card. Each member of a conversation flips it independently for
--      themselves; one person's flag doesn't show on anyone else's
--      sidebar. Defaults to false; flipped via the small dot button on
--      the card.
--
--   2. sort_position numeric — opt-in manual ordering. NULL means
--      "use the automatic sort" (active-pinned, then unread-first,
--      then recency). Once the user drags a conversation, the moved
--      item AND all other conversations in the visible list get a
--      numeric position written — from then on, the user's sidebar
--      respects their order until they manually reset or new items
--      sort in via the automatic rules below the manual block.
--
--      Stored as numeric (not int) so we can insert a new value
--      between two existing positions without renumbering the whole
--      list (a classic "fractional indexing" approach).

ALTER TABLE public.mb_conversation_members
  ADD COLUMN IF NOT EXISTS needs_revisit boolean NOT NULL DEFAULT false;

ALTER TABLE public.mb_conversation_members
  ADD COLUMN IF NOT EXISTS sort_position numeric;

-- Help the per-user sidebar list resolve quickly. sort_position is
-- often NULL, but a partial index keeps the index lean while still
-- accelerating queries that ORDER BY it for a given member.
CREATE INDEX IF NOT EXISTS idx_mb_members_user_sort
  ON public.mb_conversation_members(user_id, sort_position)
  WHERE sort_position IS NOT NULL;
