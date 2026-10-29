-- Attachments are read (Josh, 2026-10-29): when a file is attached to an
-- "Upload" row, Grant Coach reads it once — a PDF through the writer, Word
-- and Excel in the browser — and keeps the text here. The writer, the
-- reviewer and both conversations then see what NLA is submitting (the
-- budget narrative's lines, the workbook's line items), quoted as written.
-- Safe to run more than once.

ALTER TABLE public.grant_documents
  ADD COLUMN IF NOT EXISTS read_text text,
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

NOTIFY pgrst, 'reload schema';

SELECT 'attachments readable' AS done;
