
-- Create vault_folders table for hierarchical folder structure
CREATE TABLE public.vault_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.vault_categories(id) ON DELETE CASCADE,
  parent_folder_id UUID REFERENCES public.vault_folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_by TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add folder_id to vault_documents (nullable - docs can exist at category root or in a folder)
ALTER TABLE public.vault_documents
  ADD COLUMN folder_id UUID REFERENCES public.vault_folders(id) ON DELETE CASCADE;

-- Enable RLS
ALTER TABLE public.vault_folders ENABLE ROW LEVEL SECURITY;

-- RLS policies for vault_folders
CREATE POLICY "Admins can view vault_folders"
  ON public.vault_folders FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can create vault_folders"
  ON public.vault_folders FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update vault_folders"
  ON public.vault_folders FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete vault_folders"
  ON public.vault_folders FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Index for fast lookups
CREATE INDEX idx_vault_folders_category ON public.vault_folders(category_id);
CREATE INDEX idx_vault_folders_parent ON public.vault_folders(parent_folder_id);
CREATE INDEX idx_vault_documents_folder ON public.vault_documents(folder_id);
