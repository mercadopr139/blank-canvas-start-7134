-- Enum for task status
CREATE TYPE public.staff_task_status AS ENUM ('Open', 'In Progress', 'Completed', 'Blocked');

-- Tasks table
CREATE TABLE public.staff_tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  description   TEXT,
  status        public.staff_task_status NOT NULL DEFAULT 'Open',
  priority      TEXT CHECK (priority IN ('Low', 'Medium', 'High')) DEFAULT 'Medium',
  due_date      DATE,
  focus_area_id UUID REFERENCES public.focus_areas(id) ON DELETE SET NULL,
  created_by    UUID NOT NULL REFERENCES auth.users(id),
  assigned_to   UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Comments
CREATE TABLE public.staff_task_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    UUID NOT NULL REFERENCES public.staff_tasks(id) ON DELETE CASCADE,
  author_id  UUID NOT NULL REFERENCES auth.users(id),
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notifications
CREATE TABLE public.staff_task_notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id),
  task_id    UUID NOT NULL REFERENCES public.staff_tasks(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('assigned', 'commented', 'status_changed')),
  read       BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_staff_tasks_assigned_to ON public.staff_tasks(assigned_to);
CREATE INDEX idx_staff_tasks_created_by ON public.staff_tasks(created_by);
CREATE INDEX idx_staff_tasks_status ON public.staff_tasks(status);
CREATE INDEX idx_staff_tasks_focus_area_id ON public.staff_tasks(focus_area_id);
CREATE INDEX idx_staff_task_comments_task_id ON public.staff_task_comments(task_id);
CREATE INDEX idx_staff_task_notifications_user_id ON public.staff_task_notifications(user_id);
CREATE INDEX idx_staff_task_notifications_task_id ON public.staff_task_notifications(task_id);

-- Updated_at trigger for staff_tasks
CREATE TRIGGER update_staff_tasks_updated_at
BEFORE UPDATE ON public.staff_tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.staff_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_task_notifications ENABLE ROW LEVEL SECURITY;

-- staff_tasks: any authenticated admin can manage all tasks
CREATE POLICY "Admins can view staff_tasks"
ON public.staff_tasks FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can insert staff_tasks"
ON public.staff_tasks FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) AND created_by = auth.uid());

CREATE POLICY "Admins can update staff_tasks"
ON public.staff_tasks FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete staff_tasks"
ON public.staff_tasks FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- staff_task_comments: admins manage; authors can insert their own
CREATE POLICY "Admins can view staff_task_comments"
ON public.staff_task_comments FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can insert staff_task_comments"
ON public.staff_task_comments FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) AND author_id = auth.uid());

CREATE POLICY "Authors can delete own comments"
ON public.staff_task_comments FOR DELETE TO authenticated
USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- staff_task_notifications: users see/update their own
CREATE POLICY "Users can view own notifications"
ON public.staff_task_notifications FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can insert notifications"
ON public.staff_task_notifications FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Users can update own notifications"
ON public.staff_task_notifications FOR UPDATE TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can delete own notifications"
ON public.staff_task_notifications FOR DELETE TO authenticated
USING (user_id = auth.uid());