-- Shared collaborative task board for Josh (PD) and Chrissy (PC)

-- Status enum for staff tasks
CREATE TYPE staff_task_status AS ENUM ('Open', 'In Progress', 'Completed', 'Blocked');

-- Main tasks table
CREATE TABLE public.staff_tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  description   TEXT,
  status        staff_task_status NOT NULL DEFAULT 'Open',
  priority      TEXT CHECK (priority IN ('Low', 'Medium', 'High')) DEFAULT 'Medium',
  due_date      DATE,
  focus_area_id UUID REFERENCES public.focus_areas(id) ON DELETE SET NULL,
  created_by    UUID NOT NULL REFERENCES auth.users(id),
  assigned_to   UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Comments/notes on tasks
CREATE TABLE public.staff_task_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    UUID NOT NULL REFERENCES public.staff_tasks(id) ON DELETE CASCADE,
  author_id  UUID NOT NULL REFERENCES auth.users(id),
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- In-app notifications (assigned, commented, status_changed)
CREATE TABLE public.staff_task_notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id),
  task_id    UUID NOT NULL REFERENCES public.staff_tasks(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('assigned', 'commented', 'status_changed')),
  read       BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-update updated_at on staff_tasks
CREATE OR REPLACE FUNCTION update_staff_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER staff_tasks_updated_at
  BEFORE UPDATE ON public.staff_tasks
  FOR EACH ROW EXECUTE FUNCTION update_staff_tasks_updated_at();

-- RLS
ALTER TABLE public.staff_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_task_notifications ENABLE ROW LEVEL SECURITY;

-- staff_tasks: admins see all; others see only their own created/assigned tasks
CREATE POLICY "staff_tasks_select" ON public.staff_tasks
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR created_by = auth.uid()
    OR assigned_to = auth.uid()
  );

CREATE POLICY "staff_tasks_insert" ON public.staff_tasks
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR created_by = auth.uid()
  );

CREATE POLICY "staff_tasks_update" ON public.staff_tasks
  FOR UPDATE USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR created_by = auth.uid()
    OR assigned_to = auth.uid()
  );

CREATE POLICY "staff_tasks_delete" ON public.staff_tasks
  FOR DELETE USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR created_by = auth.uid()
  );

-- staff_task_comments: visible if parent task is visible
CREATE POLICY "staff_task_comments_select" ON public.staff_task_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.staff_tasks t
      WHERE t.id = task_id
        AND (
          has_role(auth.uid(), 'admin'::app_role)
          OR t.created_by = auth.uid()
          OR t.assigned_to = auth.uid()
        )
    )
  );

CREATE POLICY "staff_task_comments_insert" ON public.staff_task_comments
  FOR INSERT WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.staff_tasks t
      WHERE t.id = task_id
        AND (
          has_role(auth.uid(), 'admin'::app_role)
          OR t.created_by = auth.uid()
          OR t.assigned_to = auth.uid()
        )
    )
  );

-- staff_task_notifications: users see only their own
CREATE POLICY "staff_task_notifications_select" ON public.staff_task_notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "staff_task_notifications_insert" ON public.staff_task_notifications
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR auth.uid() IS NOT NULL);

CREATE POLICY "staff_task_notifications_update" ON public.staff_task_notifications
  FOR UPDATE USING (user_id = auth.uid());
