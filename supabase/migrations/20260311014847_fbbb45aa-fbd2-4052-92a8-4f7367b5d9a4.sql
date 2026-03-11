-- Drop the old global uniqueness constraint (participant + date only)
-- Keep the program-aware uniqueness constraint (participant + date + program_source)
DROP INDEX IF EXISTS public.attendance_one_per_day;