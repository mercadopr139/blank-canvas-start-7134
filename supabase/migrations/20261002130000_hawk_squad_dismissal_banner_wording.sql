-- Hawk Squad form: the dismissal waiver's banner says "your child", not
-- "your student" (Josh, 2026-10-02) -- it reads better in that sentence.
-- Config only: one help_text in hawk_squad_form_fields. No registration rows
-- change, and the questions keep their "student" wording.
UPDATE public.hawk_squad_form_fields
SET help_text = 'OPTIONAL. Sign this only if you want the option of your child being dismissed directly from No Limits Academy instead of riding the bus back to Cape May Tech. If you leave it unsigned, your child will always ride the bus.'
WHERE field_key = 'hawk_dismissal';
