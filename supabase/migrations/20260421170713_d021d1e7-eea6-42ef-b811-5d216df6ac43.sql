ALTER TABLE public.staff_profiles ADD COLUMN IF NOT EXISTS task_manager_type TEXT;

UPDATE public.staff_profiles SET task_manager_type = 'PD' WHERE email = 'joshmercado@nolimitsboxingacademy.org';
UPDATE public.staff_profiles SET task_manager_type = 'PC' WHERE email = 'chrissycasiello@nolimitsboxingacademy.org';

CREATE TABLE public.mb_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  is_group BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.mb_conversation_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.mb_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  last_read_at TIMESTAMPTZ DEFAULT now(),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

CREATE TABLE public.mb_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.mb_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'task', 'event')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.mb_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.mb_conversations(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  assigned_to UUID REFERENCES auth.users(id),
  assigned_by UUID NOT NULL REFERENCES auth.users(id),
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Completed', 'Blocked')),
  priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High')),
  topic TEXT NOT NULL DEFAULT 'General' CHECK (topic IN ('General', 'Operations', 'Sales & Marketing', 'Finance')),
  sent_to_task_manager BOOLEAN NOT NULL DEFAULT false,
  task_manager_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.mb_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  event_type TEXT NOT NULL DEFAULT 'meeting' CHECK (event_type IN ('meeting', 'deadline', 'grant', 'program')),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.mb_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mb_conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mb_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mb_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mb_calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mb_access" ON public.mb_conversations FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "mb_members_access" ON public.mb_conversation_members FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "mb_messages_access" ON public.mb_messages FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "mb_tasks_access" ON public.mb_tasks FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "mb_calendar_access" ON public.mb_calendar_events FOR ALL USING (auth.uid() IS NOT NULL);