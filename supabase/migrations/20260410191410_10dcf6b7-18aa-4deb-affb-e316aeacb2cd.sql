
-- CSBG Invoices
CREATE TABLE public.csbg_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE,
  service_month integer NOT NULL,
  service_year integer NOT NULL,
  reimbursement_total numeric NOT NULL DEFAULT 0,
  certified boolean NOT NULL DEFAULT false,
  pdf_base64 text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.csbg_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view csbg_invoices" ON public.csbg_invoices FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert csbg_invoices" ON public.csbg_invoices FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update csbg_invoices" ON public.csbg_invoices FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete csbg_invoices" ON public.csbg_invoices FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER update_csbg_invoices_updated_at BEFORE UPDATE ON public.csbg_invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- CSBG Budget Actuals (one row per line item per month)
CREATE TABLE public.csbg_budget_actuals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_item_name text NOT NULL,
  budgeted_amount numeric NOT NULL DEFAULT 0,
  month integer NOT NULL,
  year integer NOT NULL,
  actual_amount numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(line_item_name, month, year)
);
ALTER TABLE public.csbg_budget_actuals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view csbg_budget_actuals" ON public.csbg_budget_actuals FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert csbg_budget_actuals" ON public.csbg_budget_actuals FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update csbg_budget_actuals" ON public.csbg_budget_actuals FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete csbg_budget_actuals" ON public.csbg_budget_actuals FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER update_csbg_budget_actuals_updated_at BEFORE UPDATE ON public.csbg_budget_actuals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- CSBG Monthly Checklists
CREATE TABLE public.csbg_monthly_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month integer NOT NULL,
  year integer NOT NULL,
  document_type text NOT NULL,
  is_collected boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(month, year, document_type)
);
ALTER TABLE public.csbg_monthly_checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view csbg_monthly_checklists" ON public.csbg_monthly_checklists FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert csbg_monthly_checklists" ON public.csbg_monthly_checklists FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update csbg_monthly_checklists" ON public.csbg_monthly_checklists FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete csbg_monthly_checklists" ON public.csbg_monthly_checklists FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER update_csbg_monthly_checklists_updated_at BEFORE UPDATE ON public.csbg_monthly_checklists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- CSBG Submissions Log
CREATE TABLE public.csbg_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL,
  service_month integer NOT NULL,
  service_year integer NOT NULL,
  submission_date date NOT NULL DEFAULT CURRENT_DATE,
  total_amount numeric NOT NULL DEFAULT 0,
  method text NOT NULL DEFAULT 'Email',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.csbg_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view csbg_submissions" ON public.csbg_submissions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert csbg_submissions" ON public.csbg_submissions FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update csbg_submissions" ON public.csbg_submissions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete csbg_submissions" ON public.csbg_submissions FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER update_csbg_submissions_updated_at BEFORE UPDATE ON public.csbg_submissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sequence for CSBG invoice numbers
CREATE SEQUENCE public.csbg_invoice_number_seq START WITH 1;
