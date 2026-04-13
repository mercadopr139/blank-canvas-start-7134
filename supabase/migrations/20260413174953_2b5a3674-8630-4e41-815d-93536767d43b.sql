ALTER TABLE public.focus_areas DROP CONSTRAINT IF EXISTS focus_areas_key_key;
ALTER TABLE public.focus_areas ADD CONSTRAINT focus_areas_manager_type_key_key UNIQUE (manager_type, key);