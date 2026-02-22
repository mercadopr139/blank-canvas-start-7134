
CREATE TYPE public.task_type AS ENUM ('Call', 'Proposal', 'Thank You', 'Renewal', 'Report Deadline', 'Follow-Up');
CREATE TYPE public.task_status AS ENUM ('Open', 'Completed');

CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supporter_id UUID NOT NULL REFERENCES public.supporters(id) ON DELETE CASCADE,
  task_type public.task_type NOT NULL,
  assigned_to TEXT,
  due_date DATE,
  status public.task_status NOT NULL DEFAULT 'Open',
  created_by TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all tasks" ON public.tasks FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can create tasks" ON public.tasks FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update tasks" ON public.tasks FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete tasks" ON public.tasks FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
