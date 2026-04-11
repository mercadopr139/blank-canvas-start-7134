
-- Categories table
CREATE TABLE public.vault_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  icon text NOT NULL DEFAULT 'Folder',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vault_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view vault_categories" ON public.vault_categories FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert vault_categories" ON public.vault_categories FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update vault_categories" ON public.vault_categories FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete vault_categories" ON public.vault_categories FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_vault_categories_updated_at BEFORE UPDATE ON public.vault_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Documents table
CREATE TABLE public.vault_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id uuid NOT NULL REFERENCES public.vault_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  drive_link text NOT NULL,
  added_by text,
  expiration_date date,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vault_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view vault_documents" ON public.vault_documents FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert vault_documents" ON public.vault_documents FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update vault_documents" ON public.vault_documents FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete vault_documents" ON public.vault_documents FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_vault_documents_updated_at BEFORE UPDATE ON public.vault_documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default categories
INSERT INTO public.vault_categories (name, icon, sort_order) VALUES
  ('Founding & Legal', 'Scale', 0),
  ('Insurance', 'ShieldCheck', 1),
  ('HR & Personnel', 'Users', 2),
  ('Finance & Banking', 'Landmark', 3),
  ('Grant Agreements', 'FileText', 4),
  ('Facilities & Lease', 'Building2', 5),
  ('Vendor Contracts', 'Handshake', 6),
  ('Licenses & Compliance', 'BadgeCheck', 7),
  ('Operations', 'Settings', 8);
