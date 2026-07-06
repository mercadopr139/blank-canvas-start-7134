-- Fix duplicated dashboard tiles.
--
-- The dashboard seeds a set of "default tiles" per user into dashboard_tiles.
-- That seed effect could fire more than once before it marked itself done,
-- re-inserting the whole default set each time — so users accumulated several
-- copies of every tile (e.g. four "Upcoming Events", multiple task-manager
-- tiles). There was no uniqueness guard to stop it.
--
-- This migration (1) removes the duplicate rows, keeping the oldest copy of
-- each (user_id, href), and (2) adds a UNIQUE(user_id, href) constraint so a
-- repeat insert becomes a no-op instead of a duplicate. The frontend seed was
-- also switched to upsert(...ignoreDuplicates) to match.

-- 1. De-duplicate: keep the earliest row per (user_id, href), delete the rest.
DELETE FROM public.dashboard_tiles
WHERE ctid IN (
  SELECT ctid FROM (
    SELECT ctid,
           row_number() OVER (
             PARTITION BY user_id, href
             ORDER BY created_at, ctid
           ) AS rn
    FROM public.dashboard_tiles
  ) ranked
  WHERE ranked.rn > 1
);

-- 2. Prevent it ever happening again.
ALTER TABLE public.dashboard_tiles
  ADD CONSTRAINT dashboard_tiles_user_href_unique UNIQUE (user_id, href);
