CREATE TYPE public.signal_status AS ENUM ('Pending', 'Complete');
ALTER TABLE public.signals ADD COLUMN status public.signal_status NOT NULL DEFAULT 'Pending';