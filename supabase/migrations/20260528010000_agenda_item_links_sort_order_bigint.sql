-- agenda_item_links.sort_order needs to hold Date.now()-style values
-- (~1.7e12) for the same cheap monotonic-insert pattern used by
-- agenda_items. The original integer column overflows around 2.1e9,
-- so "Add link" was failing silently with "integer out of range"
-- whenever the app wrote a fresh sort_order via Date.now().
--
-- Direct port of migration 20260521010000_agenda_items_sort_order_bigint.sql
-- which fixed the same bug on agenda_items earlier.

ALTER TABLE public.agenda_item_links
  ALTER COLUMN sort_order TYPE bigint USING sort_order::bigint;

ALTER TABLE public.agenda_item_links
  ALTER COLUMN sort_order SET DEFAULT 0;
