-- date_assigned is already nullable (DEFAULT CURRENT_DATE, no NOT NULL constraint)
-- but let's ensure it explicitly allows NULL by checking the default
-- We just need to drop the default so "On Deck" signals get NULL
ALTER TABLE public.signals ALTER COLUMN date_assigned DROP DEFAULT;