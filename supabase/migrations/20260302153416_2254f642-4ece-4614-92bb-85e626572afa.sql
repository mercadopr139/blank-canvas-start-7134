
-- Create vision_cloud_items table
CREATE TABLE public.vision_cloud_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  pillar TEXT NOT NULL CHECK (pillar IN ('Operations', 'Sales & Marketing', 'Finance', 'Vision', 'Personal')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vision_cloud_items ENABLE ROW LEVEL SECURITY;

-- Users can view their own items
CREATE POLICY "Users can view own vision_cloud_items"
  ON public.vision_cloud_items FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own items
CREATE POLICY "Users can insert own vision_cloud_items"
  ON public.vision_cloud_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own items
CREATE POLICY "Users can update own vision_cloud_items"
  ON public.vision_cloud_items FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can delete their own items
CREATE POLICY "Users can delete own vision_cloud_items"
  ON public.vision_cloud_items FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
