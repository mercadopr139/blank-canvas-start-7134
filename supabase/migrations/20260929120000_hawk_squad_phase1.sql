-- Hawk Squad, phase 1: registration.
--
-- Hawk Squad is a separate programme -- Cape May Tech students, two afternoons
-- a week -- and it lives in its OWN tables on purpose. Some Hawk Squad kids
-- are also NLA kids, and the twenty-five places that read NLA data must never
-- pick a Hawk Squad row up by accident and inflate a funder number. Nothing
-- NLA reads points at anything prefixed hawk_squad_; the cross-programme
-- "youth served" count, when it is wanted, is one deliberate join.
--
-- Column names mirror youth_registrations where the concept is the same, so
-- the address field, the photo helper, the validators and the eventual
-- name-plus-birthday join all work without translation. Hawk-only columns:
-- grade_level (text, "9th".."12th"), cte_program, has_asthma, and
-- dismissal_waiver_signed_at -- the transportation waiver is required of every
-- parent; the dismissal waiver is optional and signed only by parents who want
-- the option of picking up from NLA. On the attendance board (phase 2) a kid
-- without it can only be marked "Bus".

BEGIN;

-- ── The form: which questions, in what order ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.hawk_squad_form_fields (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_key     text NOT NULL UNIQUE,
  field_type    text NOT NULL DEFAULT 'short_text',
  label         text NOT NULL,
  help_text     text,
  placeholder   text,
  required      boolean NOT NULL DEFAULT false,
  options       jsonb,
  sort_order    integer NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  is_core       boolean NOT NULL DEFAULT false,
  db_column     text,
  default_value text,
  section       text,
  condition     jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hawk_squad_form_fields ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read hawk form fields" ON public.hawk_squad_form_fields;
CREATE POLICY "Anyone can read hawk form fields" ON public.hawk_squad_form_fields
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Admins manage hawk form fields" ON public.hawk_squad_form_fields;
CREATE POLICY "Admins manage hawk form fields" ON public.hawk_squad_form_fields
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP TRIGGER IF EXISTS update_hawk_squad_form_fields_updated_at ON public.hawk_squad_form_fields;
CREATE TRIGGER update_hawk_squad_form_fields_updated_at
  BEFORE UPDATE ON public.hawk_squad_form_fields
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── The registrations ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hawk_squad_registrations (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  submission_date         date NOT NULL DEFAULT (now() AT TIME ZONE 'America/New_York')::date,
  program_year            text NOT NULL,

  child_first_name        text NOT NULL,
  child_last_name         text NOT NULL,
  child_sex               text,
  child_date_of_birth     date,
  child_race_ethnicity    text,
  grade_level             text,
  cte_program             text,

  child_primary_address   text,
  latitude                double precision,
  longitude               double precision,
  geocoded_at             timestamptz,

  parent_first_name       text,
  parent_last_name        text,
  parent_phone            text,
  parent_email            text,
  free_or_reduced_lunch   text,

  allergies               text,
  has_asthma              boolean,
  asthma_inhaler_info     text,
  important_child_notes   text,

  child_headshot_url      text,
  waivers_data            jsonb,
  dismissal_waiver_signed_at timestamptz,
  final_signature_name    text,
  custom_fields_data      jsonb,

  approved_for_attendance boolean NOT NULL DEFAULT false,
  archived_at             timestamptz,
  youth_link_id           uuid
);

CREATE INDEX IF NOT EXISTS hawk_squad_registrations_year_idx ON public.hawk_squad_registrations (program_year);
CREATE INDEX IF NOT EXISTS hawk_squad_registrations_name_idx ON public.hawk_squad_registrations (lower(child_last_name), lower(child_first_name));

ALTER TABLE public.hawk_squad_registrations ENABLE ROW LEVEL SECURITY;

-- Parents submit without an account: insert only, never read back.
DROP POLICY IF EXISTS "Anyone can submit hawk registration" ON public.hawk_squad_registrations;
CREATE POLICY "Anyone can submit hawk registration" ON public.hawk_squad_registrations
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Admins view hawk registrations" ON public.hawk_squad_registrations;
CREATE POLICY "Admins view hawk registrations" ON public.hawk_squad_registrations
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins update hawk registrations" ON public.hawk_squad_registrations;
CREATE POLICY "Admins update hawk registrations" ON public.hawk_squad_registrations
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins delete hawk registrations" ON public.hawk_squad_registrations;
CREATE POLICY "Admins delete hawk registrations" ON public.hawk_squad_registrations
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP TRIGGER IF EXISTS update_hawk_squad_registrations_updated_at ON public.hawk_squad_registrations;
CREATE TRIGGER update_hawk_squad_registrations_updated_at
  BEFORE UPDATE ON public.hawk_squad_registrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- The public form's same-year duplicate check reads this year's rows under the
-- same last name and decides in code. Anon can read only that -- names and
-- the three things it compares on, current year, never the rest.
CREATE OR REPLACE FUNCTION public.hawk_squad_same_year_matches(_last_name text, _program_year text)
RETURNS TABLE (child_first_name text, child_last_name text, child_date_of_birth date, parent_email text, parent_phone text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT r.child_first_name, r.child_last_name, r.child_date_of_birth, r.parent_email, r.parent_phone
  FROM public.hawk_squad_registrations r
  WHERE r.program_year = _program_year
    AND r.archived_at IS NULL
    AND lower(trim(r.child_last_name)) = lower(trim(_last_name))
  LIMIT 20;
$$;
GRANT EXECUTE ON FUNCTION public.hawk_squad_same_year_matches(text, text) TO anon, authenticated;

-- ── The questions, as Josh gave them ─────────────────────────────────────
-- Field keys match NLA's where the concept is the same, so the shared form
-- code (address confirmation, phone and email validation, the photo upload,
-- the asthma gate) works unchanged. Labels say "student".
INSERT INTO public.hawk_squad_form_fields
  (field_key, field_type, label, help_text, placeholder, required, options, sort_order, is_active, is_core, db_column, section, condition)
VALUES
  ('child_first_name',  'short_text', 'First Name of Student', NULL, NULL, true, NULL, 10, true, true, 'child_first_name', 'Student Information', NULL),
  ('child_last_name',   'short_text', 'Last Name of Student',  NULL, NULL, true, NULL, 20, true, true, 'child_last_name',  'Student Information', NULL),
  ('grade_level',       'dropdown',   'Grade Level of Student', NULL, 'Select...', true, '["9th","10th","11th","12th"]', 30, true, true, 'grade_level', 'Student Information', NULL),
  ('cte_program',       'dropdown',   'Student''s CTE Program', 'Career Technical Education', 'Select...', true,
     '["Automotive Technology","Allied Medical","Career Exploratory","Carpentry & Property Management","Coastal & Marine Science","Communication Arts","Computer Technology","Cosmetology","Culinary Arts/Hospitality","Electrical Trades","Environmental Science & Sustainability","Future Educator","HVAC-R/Sustainable Energy","Law & Public Safety","Marine Maintenance","Powersports","Pre-Engineering","Veterinary Science","Welding"]',
     40, true, true, 'cte_program', 'Student Information', NULL),
  ('child_sex',         'dropdown',   'Sex of Student', NULL, 'Select...', true, '["Male","Female"]', 50, true, true, 'child_sex', 'Student Information', NULL),
  ('child_date_of_birth','date',      'Student''s Date of Birth', NULL, NULL, true, NULL, 60, true, true, 'child_date_of_birth', 'Student Information', NULL),
  ('child_race_ethnicity','dropdown', 'Student''s Race/Ethnicity', NULL, 'Select...', true,
     '["American Indian or Alaska Native","Asian","Black or African American","Hispanic or Latino","Native Hawaiian or Other Pacific Islander","White","Two or More Races"]',
     70, true, true, 'child_race_ethnicity', 'Student Information', NULL),
  ('child_primary_address','address', 'Student''s Primary Address', 'Start typing and pick the address from the list to confirm it.', NULL, true, NULL, 80, true, true, 'child_primary_address', 'Student Information', NULL),
  ('child_headshot',    'file_upload','For safety & security, upload a picture (headshot) of your student.', 'A clear photo of the student''s face.', NULL, true, NULL, 90, true, true, 'child_headshot_url', 'Student Information', NULL),

  ('parent_first_name', 'short_text', 'First Name of Parent/Guardian', NULL, NULL, true, NULL, 100, true, true, 'parent_first_name', 'Parent/Guardian Information', NULL),
  ('parent_last_name',  'short_text', 'Last Name of Parent/Guardian',  NULL, NULL, true, NULL, 110, true, true, 'parent_last_name',  'Parent/Guardian Information', NULL),
  ('parent_phone',      'phone',      'Parent/Guardian Cell Phone #', NULL, '(555) 555-5555', true, NULL, 120, true, true, 'parent_phone', 'Parent/Guardian Information', NULL),
  ('parent_email',      'email',      'Parent/Guardian Email', NULL, NULL, true, NULL, 130, true, true, 'parent_email', 'Parent/Guardian Information', NULL),
  ('free_or_reduced_lunch','dropdown','For funding purposes, does the student receive free or reduced lunch at school?', NULL, 'Select...', true, '["Yes","No"]', 140, true, true, 'free_or_reduced_lunch', 'Parent/Guardian Information', NULL),

  ('allergies',         'long_text',  'Does the student have any allergies? If none, please skip.',
     'If the student requires an epinephrine injection, YOU MUST PROVIDE No Limits Academy coaches with an up-to-date epi-pen that will remain at the No Limits Academy facility. NO EXCEPTIONS.',
     NULL, false, NULL, 150, true, true, 'allergies', 'Medical Information', NULL),
  ('has_asthma',        'yes_no',     'Does the student have asthma?', NULL, NULL, true, NULL, 160, true, true, NULL, 'Medical Information', NULL),
  ('asthma_inhaler_info','long_text', 'Name of the inhaler the student takes prior to strenuous exercise',
     'YOU MUST PROVIDE an inhaler that will remain at the No Limits Academy facility. NO EXCEPTIONS.',
     NULL, true, NULL, 170, true, true, 'asthma_inhaler_info', 'Medical Information', '{"field":"has_asthma","op":"eq","value":"Yes"}'),
  ('asthma_inhaler_ack','checkbox',   'I understand that, for my student''s safety, I must provide an inhaler that stays at No Limits Academy during all program hours.',
     NULL, NULL, true, NULL, 175, true, true, NULL, 'Medical Information', '{"field":"has_asthma","op":"eq","value":"Yes"}'),
  ('important_child_notes','long_text','Please share any important information about the student that would help our coaches support them.',
     'Ex: recent life changes, social challenges, medical needs, etc. Skip if not applicable.',
     NULL, false, NULL, 180, true, true, 'important_child_notes', 'Medical Information', NULL),

  ('hawk_liability',    'waiver', 'Release of Liability & Waiver Form', NULL, NULL, true, NULL, 200, true, false, NULL, 'Waivers', NULL),
  ('hawk_transportation','waiver','Waiver and Permission - Transportation', NULL, NULL, true, NULL, 210, true, false, NULL, 'Waivers', NULL),
  ('hawk_dismissal',    'waiver', 'Hawk Squad Dismissal Waiver',
     'OPTIONAL. Sign this only if you want the option of your student being dismissed directly from No Limits Academy instead of riding the bus back to Cape May Tech. If you leave it unsigned, your student will always ride the bus.',
     NULL, false, NULL, 220, true, false, NULL, 'Waivers', NULL),
  ('hawk_media',        'waiver', 'Media Consent, Release & Waiver', NULL, NULL, true, NULL, 230, true, false, NULL, 'Waivers', NULL),
  ('hawk_counseling',   'waiver', 'Counseling Services Notice & Consent', NULL, NULL, true, NULL, 240, true, false, NULL, 'Waivers', NULL)
ON CONFLICT (field_key) DO NOTHING;

-- Waiver bodies, verbatim from the form Josh was using.
UPDATE public.hawk_squad_form_fields SET default_value =
'I, the parent/guardian, or I, the participant, understand that exercise, training, and using fitness equipment are potentially hazardous activities. I further understand that these activities involve risks of injury, aggravation of pre-existing conditions, and, in the most severe situations, even death. Furthermore, I acknowledge that exercise on the body cannot be predicted with complete accuracy and that injuries may occur during or following exercise that could lead to these complications and adversely affect my health. These changes may include, among other effects, high blood pressure, increased heart rate, altered heart function, and possibly cardiac complications or stroke.

I, the parent/guardian, or I, the participant, voluntarily assume all responsibility and liability for using the facilities, equipment, machinery, and all exercise programs (including boxing) at No Limits Academy. I assume all risks of injuries associated with participation including, but not limited to: falls, contact with other participants, the effects of the weather (including high heat and/or humidity), and all other such risks being known and acknowledged by me (including fractures, head and spinal injuries).

I, the parent/guardian, or I, the participant, am aware that a comprehensive medical examination by my doctor is necessary before starting an exercise program. I acknowledge that I have consulted with my physician to determine which, if any, physical activities, exercises, and training programs are not recommended for me. I acknowledge that I had a comprehensive physical examination by my doctor within the last 12 months and I have no restrictions for strenuous exercise or boxing participation.

I, the parent/guardian, or I, the participant, have read and understand the following warning and notification: "If you are currently under a physician''s care for an injury, bleeding disorder, condition or illness, the No Limits Academy urges you to consult your physician before participating in any exercises, using any equipment, or participating in any program at NLA (which includes weight lifting and boxing)."

I, the parent/guardian, or I, the participant, declare that I am physically fit, sound, and suffering from no condition, impairment, disability, disease, infirmity, or illness that should prevent my participation in any program and the use of any exercise equipment, including weight lifting and boxing. (Anyone who cannot commit that this statement is true and correct must see the NLA supervisor before using the facilities.)

Moreover, in consideration of being allowed the use of all facilities, equipment, machinery, and programs, I, the parent/guardian, or I, the participant, waive and release, now and forever, all claims and causes of action against NLA, its elected or appointed officers, agents, volunteers, employees, representatives, consultants, executors, and all others directly or indirectly connected with NLA, from any and all personal injuries I sustain (including death or permanent disability), and any medical condition of any kind which results in any aggravation of a pre-existing medical condition, and any and all other damages or injuries which I sustain in any way from the direct or indirect result of my activities, exercise, training, and participation in NLA activities.'
WHERE field_key = 'hawk_liability';

UPDATE public.hawk_squad_form_fields SET default_value =
'Transportation Agreement & Liability Waiver

I, the undersigned parent/guardian of the above-named student, hereby give permission for my child to be transported by No Limits Academy (NLA) for participation in the Hawk Squad program. Transportation will include pick-up and drop-off at Cape May County Technical High School (Cape May Tech).

I understand and agree to the following:

Voluntary Participation: My child''s participation in the Hawk Squad program, including transportation provided by NLA, is voluntary.

Acknowledgement of Risk: I acknowledge that travel by vehicle involves inherent risks, including the risk of accident, injury, or death.

Release of Liability: In consideration of my child being permitted to participate, I hereby release and hold harmless No Limits Academy, its staff, volunteers, drivers, and affiliates from any and all liability, claims, demands, or causes of action that may arise from or relate to transportation provided, except in cases of gross negligence or willful misconduct.

Medical Authorization: In the event of an emergency, I authorize NLA staff or representatives to seek necessary medical treatment for my child. I agree to be responsible for any medical expenses incurred.

Behavior Expectations: My child agrees to follow all safety rules during transportation. I understand that repeated unsafe or disruptive behavior may result in loss of transportation privileges.

Acknowledgement & Consent

By signing below, I confirm that I have read and understand this transportation waiver. I consent to my child''s participation in transportation services provided by No Limits Academy (NLA) and agree to the terms outlined above.'
WHERE field_key = 'hawk_transportation';

UPDATE public.hawk_squad_form_fields SET default_value =
'I, the undersigned parent/guardian, give permission for my child to be dismissed directly from No Limits Academy (NLA) instead of returning to Cape May County Technical High School by bus.

I understand that once my child is dismissed from the NLA facility, No Limits Academy and Cape May Tech are not responsible for the safety, supervision, or transportation of my child.

By signing below, I release NLA and Cape May Tech from any liability in connection with my child''s dismissal from the NLA facility.'
WHERE field_key = 'hawk_dismissal';

UPDATE public.hawk_squad_form_fields SET default_value =
'I hereby give consent to No Limits Academy to photograph, videotape, or otherwise digitally record and use images and/or sound recordings of myself or my child/children to use in any public media, including radio, television, internet, social media, print or in any of the organization''s or its partners'' publications, productions, or posts. I understand that the intended use of such images and information is solely for the purpose of advertising, marketing, fundraising and/or the promotional and public awareness purposes for the organization. I hereby waive any rights or interest in the images or recordings, as stated in this release. I acknowledge that this consent to use images and/or recordings is being made solely for the benefit of the organization and comes without any expectation of monetary compensation or other benefit to me. To the extent that any benefit accrues or might accrue to the organization from the use of images or information, I hereby and forever waive any interest in or claim to such benefits. I hereby release and forever discharge No Limits Academy from any and all claims, liability, actions, suits, demands, costs, expenses or indebtedness arising out of, related to, or in any way connected with the use of images and materials described herein, and I hereby waive all rights and interest in and to such information and materials. I further acknowledge that there is no guarantee that any or all of the participants'' images or recordings will be used in any released media.'
WHERE field_key = 'hawk_media';

UPDATE public.hawk_squad_form_fields SET default_value =
'As part of our commitment to supporting the emotional, social, and mental well-being of our participants, our program offers on-site counseling services. These may include both informal counseling (such as supportive conversations, wellness check-ins, and guidance provided by trained staff) and formal counseling (scheduled sessions with a qualified licensed counselor or mental health professional).

By registering your child in our program, you acknowledge and consent to the following:

You understand that informal counseling or supportive conversations may be provided by program staff as part of ongoing youth development and mentoring.
You understand that formal counseling services may be offered on-site by a licensed professional, and that these services will be coordinated with parents/guardians prior to initiation of regular sessions.
You give permission for your child to participate in informal or formal counseling support while enrolled in the program. You may withdraw or modify this permission at any time by contacting the program director in writing.
You understand that any information shared in a counseling setting is confidential, except in situations where disclosure is legally required (such as imminent harm to self or others, or suspected child abuse/neglect).

Please sign below to acknowledge that you have read and understand this policy, and grant permission for your child to access on-site counseling support as described above.'
WHERE field_key = 'hawk_counseling';

COMMIT;
