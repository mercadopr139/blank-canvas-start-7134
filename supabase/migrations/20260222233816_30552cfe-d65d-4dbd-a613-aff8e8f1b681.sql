CREATE TYPE public.priority_layer AS ENUM ('Core', 'Bonus');
ALTER TABLE public.signals ADD COLUMN priority_layer public.priority_layer;