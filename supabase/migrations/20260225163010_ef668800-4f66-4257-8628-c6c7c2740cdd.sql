
CREATE TABLE public.verse_library (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  sort_index integer NOT NULL,
  reference text NOT NULL,
  text text NOT NULL,
  theme text,
  is_trashed boolean NOT NULL DEFAULT false,
  UNIQUE (sort_index)
);

ALTER TABLE public.verse_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all verse_library"
  ON public.verse_library FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can create verse_library"
  ON public.verse_library FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update verse_library"
  ON public.verse_library FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete verse_library"
  ON public.verse_library FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));
