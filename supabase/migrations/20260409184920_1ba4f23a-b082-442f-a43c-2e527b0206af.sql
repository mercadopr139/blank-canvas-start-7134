ALTER TABLE public.attendance_records
ADD COLUMN is_manual boolean NOT NULL DEFAULT false,
ADD COLUMN added_by_user_id uuid DEFAULT NULL;