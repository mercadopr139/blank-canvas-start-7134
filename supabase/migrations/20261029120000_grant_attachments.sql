-- Attachments on the application (Josh, 2026-10-29). An "Upload" row read off
-- a portal screen points at the file NLA submitted: a file in this folder's
-- documents (grant_documents, side 'ours'). A Vault document (the 990, the
-- determination letter…) is copied into the folder when attached, so the
-- folder keeps the exact version that went in even after the Vault's copy
-- is replaced. Print merges the attached PDFs after the answers.
-- Safe to run more than once.

ALTER TABLE public.grant_checklist_items
  ADD COLUMN IF NOT EXISTS attachment_id uuid REFERENCES public.grant_documents(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';

SELECT 'attachments ready' AS done;
