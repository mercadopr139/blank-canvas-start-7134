ALTER TABLE public.mb_conversations ADD COLUMN IF NOT EXISTS topic TEXT DEFAULT 'General';
ALTER TABLE public.mb_messages ADD COLUMN IF NOT EXISTS topic TEXT DEFAULT 'General';