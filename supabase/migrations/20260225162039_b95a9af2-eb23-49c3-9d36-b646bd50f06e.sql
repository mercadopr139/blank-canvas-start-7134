
CREATE TABLE public.calendar_verses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  year integer NOT NULL,
  month integer NOT NULL,
  day integer NOT NULL,
  reference text NOT NULL,
  text text NOT NULL,
  theme text,
  is_trashed boolean NOT NULL DEFAULT false,
  UNIQUE (year, month, day)
);

ALTER TABLE public.calendar_verses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all calendar_verses"
  ON public.calendar_verses FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can create calendar_verses"
  ON public.calendar_verses FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update calendar_verses"
  ON public.calendar_verses FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete calendar_verses"
  ON public.calendar_verses FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));
