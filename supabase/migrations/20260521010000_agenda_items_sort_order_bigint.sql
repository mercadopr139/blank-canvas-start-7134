-- agenda_items.sort_order needs to hold Date.now()-style values
-- (~1.7e12) for the cheap monotonic-insert pattern the app uses.
-- The original integer column overflows around 2.1e9.
ALTER TABLE public.agenda_items
  ALTER COLUMN sort_order TYPE bigint USING sort_order::bigint;

ALTER TABLE public.agenda_items
  ALTER COLUMN sort_order SET DEFAULT 0;
