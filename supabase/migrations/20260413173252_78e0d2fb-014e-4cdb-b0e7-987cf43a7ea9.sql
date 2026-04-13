ALTER TABLE public.focus_areas ADD COLUMN manager_type text NOT NULL DEFAULT 'PD';

-- Add index for efficient filtering
CREATE INDEX idx_focus_areas_manager_type ON public.focus_areas(manager_type);