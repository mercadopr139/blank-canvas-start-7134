
ALTER TABLE public.meal_events
ADD COLUMN is_closed boolean NOT NULL DEFAULT false,
ADD COLUMN closed_at timestamp with time zone;
