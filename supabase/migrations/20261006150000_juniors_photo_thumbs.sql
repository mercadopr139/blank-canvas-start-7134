-- Juniors Session photos: a thumbnail beside the full picture.
-- The board shows thumb_url in the list and photo_url in the pop-up. Photos
-- are now shrunk in the browser before upload; existing ones are shrunk by
-- the "Shrink photos" button in the editor.
BEGIN;
ALTER TABLE public.juniors_tasks      ADD COLUMN IF NOT EXISTS thumb_url text;
ALTER TABLE public.juniors_categories ADD COLUMN IF NOT EXISTS thumb_url text;
COMMIT;
