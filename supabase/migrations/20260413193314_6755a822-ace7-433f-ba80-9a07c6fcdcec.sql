CREATE TABLE public.dashboard_tiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  icon_name TEXT NOT NULL DEFAULT 'square',
  accent_color TEXT NOT NULL DEFAULT '#a1a1aa',
  href TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.dashboard_tiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tiles"
  ON public.dashboard_tiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own tiles"
  ON public.dashboard_tiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tiles"
  ON public.dashboard_tiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own tiles"
  ON public.dashboard_tiles FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_dashboard_tiles_user_id ON public.dashboard_tiles (user_id);

CREATE TRIGGER update_dashboard_tiles_updated_at
  BEFORE UPDATE ON public.dashboard_tiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();