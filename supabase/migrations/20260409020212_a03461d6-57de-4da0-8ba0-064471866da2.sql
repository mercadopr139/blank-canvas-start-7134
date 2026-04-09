
-- Seed Overflow route if not exists
INSERT INTO public.routes (name)
SELECT 'Overflow'::route_name
WHERE NOT EXISTS (SELECT 1 FROM public.routes WHERE name = 'Overflow');

-- Create pay period status enum
CREATE TYPE public.pay_period_status AS ENUM ('pending', 'approved', 'paid');

-- Create run approval status enum
CREATE TYPE public.run_approval_status AS ENUM ('pending', 'approved', 'disputed');

-- Create driver_pay_periods table
CREATE TABLE public.driver_pay_periods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status public.pay_period_status NOT NULL DEFAULT 'pending',
  total_amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.driver_pay_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view driver_pay_periods" ON public.driver_pay_periods FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert driver_pay_periods" ON public.driver_pay_periods FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update driver_pay_periods" ON public.driver_pay_periods FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete driver_pay_periods" ON public.driver_pay_periods FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_driver_pay_periods_updated_at BEFORE UPDATE ON public.driver_pay_periods FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create run_approvals table
CREATE TABLE public.run_approvals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES public.runs(id) ON DELETE CASCADE,
  status public.run_approval_status NOT NULL DEFAULT 'pending',
  reviewed_by TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(run_id)
);

ALTER TABLE public.run_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view run_approvals" ON public.run_approvals FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert run_approvals" ON public.run_approvals FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update run_approvals" ON public.run_approvals FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete run_approvals" ON public.run_approvals FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_run_approvals_updated_at BEFORE UPDATE ON public.run_approvals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
