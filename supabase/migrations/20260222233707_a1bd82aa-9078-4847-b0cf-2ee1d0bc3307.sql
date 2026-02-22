CREATE TYPE public.signal_pillar AS ENUM ('Operations', 'Sales & Marketing', 'Finance', 'Vision', 'Personal');
ALTER TABLE public.signals ADD COLUMN pillar public.signal_pillar;