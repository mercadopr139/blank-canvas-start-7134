CREATE TYPE public.signal_kind AS ENUM ('Outcome', 'Action');
ALTER TABLE public.signals ADD COLUMN signal_kind public.signal_kind;