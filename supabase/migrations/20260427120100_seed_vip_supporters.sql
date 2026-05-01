-- Seed the 51 Hall of Fame / VIP supporters from the Monday.com export.
-- All rows are tagged "VIP", flagged as Hall of Fame, and have email_opt_in=true,
-- sms_opt_in=false (admin will flip SMS on individually as written/verbal consent
-- is collected per US TCPA rules).
--
-- Phones are stored in E.164 format (+1XXXXXXXXXX) for Twilio compatibility.
-- Address is stored as a single string in the `address` column; parsed
-- address_* fields are intentionally left null and can be cleaned up over time
-- via the existing inline-edit UI in the Supporters Database.
--
-- Known data quality items (left blank or auto-fixed at import per admin's
-- decision — admin will polish via inline edit):
--   • Jim Walls phone — Excel scientific-notation corruption, left null
--   • Douglas & Catherine Davis email — was a duplicate of Jack Lord's, left null
--   • Sue White email — auto-corrected from "verizon.ne" to "verizon.net"
--   • Concerned Citizens email — kept as-typed ("conerned…") per admin review

INSERT INTO public.supporters (
  name, story, email, phone, address,
  is_hall_of_fame, outreach_tags, email_opt_in, sms_opt_in,
  status, supporter_category
) VALUES
  ('Von Savage Family', 'Day 1 Supporter', 'david.vonsavage@marshmma.com', '+16092244335', '707 Sunset Boulevard, West Cape May, NJ, USA', true, ARRAY['VIP'], true, false, 'Active', 'Individual'),
  ('Mike & Lauren Provenzano', 'Day 1 Supporter', 'lprovo2022@gmail.com', '+12159018757', '752 SW 36th Ave, Boynton Beach, FL 33435', true, ARRAY['VIP'], true, false, 'Active', 'Individual'),
  ('Chalie Hook', 'Day 1 Supporter', 'hookchalie@gmail.com', '+12673495567', '41 Copperleaf Drive, Spring, TX, 77381', true, ARRAY['VIP'], true, false, 'Active', 'Individual'),
  ('Mayor Chris Leusner', 'Former Chief', 'chris.leusner@middletownship.com', '+16093744852', '27 Seagrove Avenue, Cape May Court House, NJ, 08210', true, ARRAY['VIP'], true, false, 'Active', 'Individual'),
  ('Dekon Fashaw', 'Day 1 Supporter / Chief of Cape May', 'dfashaw@capemaycity.com', '+16097805242', '835 Seashore Road, Cape May, NJ, 08204', true, ARRAY['VIP'], true, false, 'Active', 'Individual'),
  ('Ken Kang (Accountant)', 'Accountant — please keep in the loop and always send post card', 'kenkcpa@comcast.net', '+17324067072', 'PO Box 88 Absecon, NJ 08201', true, ARRAY['VIP'], true, false, 'Active', 'Individual'),
  ('Ron Miller (Captain MTPD)', 'Day 1 Supporter', 'rmiller@middletownship.com', '+16093744204', '15 Meadows Edge Drive, Cape May Court House, NJ 08210', true, ARRAY['VIP'], true, false, 'Active', 'Individual'),
  ('Conn & Debbie McMullan', 'Day 1 Supporter', 'angleseapub@gmail.com', '+12158281141', '708 Allen Dr, North Wildwood, NJ, 08260', true, ARRAY['VIP'], true, false, 'Active', 'Individual'),
  ('Kris Kane (Chalie Hook father in law)', 'Day 1 Supporter', NULL, '+16094122240', '514 N Suffolk Ave, Ventor NJ 08406', true, ARRAY['VIP'], true, false, 'Active', 'Individual'),
  ('Joe Franco', 'Day 1 Supporter: Smitty''s Parking Lot + Bal Harbour', 'josephfrancojr@outlook.com', '+12676881866', '304 East Forget-Me-Not Road, Wildwood Crest, NJ 08260', true, ARRAY['VIP'], true, false, 'Active', 'Individual'),
  ('Island International - Kyle Wilson', 'Day 1 Supporter', NULL, '+16098898029', '24 Mimosa Drive, Rio Grande, NJ 08242', true, ARRAY['VIP'], true, false, 'Active', 'Individual'),
  ('USCG - Kevin Frazier', 'Day 1 Supporter', 'kevin.a.frazier@uscg.mil', '+19857883884', '324 Cedar Trail Dr, Le Sueur, MN 56058, USA', true, ARRAY['VIP'], true, false, 'Active', 'Individual'),
  ('David J Von Savage', 'Day 1 Supporter', 'davidjvonsavage@gmail.com', '+16098274708', '707 Sunset Boulevard, West Cape May, NJ, USA', true, ARRAY['VIP'], true, false, 'Active', 'Individual'),
  ('Edward C Leszczynski Jr & Bernadette Leszczynski', 'Day 1 Supporter', 'edleszczynski@nolimitsboxingacademy.org', '+12156947329', '121 Knights Bridge Way, Mays Landing, NJ 08330', true, ARRAY['VIP'], true, false, 'Active', 'Individual'),
  ('Crest Savings Bank', 'Day 1 Supporter', 'amanda.malkowski@crestsavings.com', '+16096027823', '302 South Main Street, Cape May Court House, NJ 08210', true, ARRAY['VIP'], true, false, 'Active', 'Organization'),
  ('Concerned Citizens of Whitesboro', 'Day 1 Supporter via Bernie Banks & Cheryl Spauding', 'conernedcitizensofwhitesboro@gmail.com', '+16094253937', 'PO Box 412 Whitesboro, NJ 08252', true, ARRAY['VIP'], true, false, 'Active', 'Organization'),
  ('Bradshaw & Sons, LLC', 'Day 1 Supporter', 'bradshawandsons1@verizon.net', '+16096758564', '118 East 1st Avenue, Wildwood, NJ 08260', true, ARRAY['VIP'], true, false, 'Active', 'Organization'),
  ('The Morey Organization DBA Morey''s Piers (Attn: Kyle Morey)', 'Day 1 Supporter', 'Kyle.morey@moreyspiers.com', '+16096029369', '3501 Boardwalk Wildwood, NJ 08260', true, ARRAY['VIP'], true, false, 'Active', 'Organization'),
  ('Cape May Cares Inc (attn: Doctor Lafferty)', 'via Claudia VonSavage', 'cgvonsavage@gmail.com', '+16098274680', '9 Pond Creek Lane Cape May, NJ 08204', true, ARRAY['VIP'], true, false, 'Active', 'Organization'),
  ('Christine Casiello', 'former Studio Four Thirty Six', 'casiello13@gmail.com', '+16097802761', '8902 Atlantic Avenue, Wildwood Crest, NJ, USA', true, ARRAY['VIP'], true, false, 'Active', 'Individual'),
  ('Valley Fund Charitable Fund - Chris Brooks', 'via the Big 3', NULL, '+17814627413', '55 Walls Dr 3rd floor, Fairfield, CT 06824', true, ARRAY['VIP'], true, false, 'Active', 'Organization'),
  ('Rob Wilson (McFarland Wilson Family Foundation) - (Big 3)', NULL, 'mwfamilyfoundation@gmail.com', '+13014400718', '15225 Tanyard Road, Sparks Glencoe, MD 21152', true, ARRAY['VIP'], true, false, 'Active', 'Individual'),
  ('Jack Lord (Big 3)', NULL, 'jwl4th@verizon.net', '+16106806842', '9 Harbor Cove, Cape May, NJ 08204', true, ARRAY['VIP'], true, false, 'Active', 'Individual'),
  ('Vinny D''Alessandro, Ocean First Bank', NULL, 'vdalessa@oceanfirst.com', '+16097090373', '26 Pembrooke Way, Galloway, NJ 08205, USA', true, ARRAY['VIP'], true, false, 'Active', 'Individual'),
  ('Douglas & Catherine Davis (Big 3)', 'Big 3 — Transport (introduced Josh to Chris Brooks)', NULL, '+19176236963', '1001 Park Ave apt 3s, New York, NY 10028', true, ARRAY['VIP'], true, false, 'Active', 'Individual'),
  ('Lenny Catanoso (The Leonard R. Catanoso Jr. Foundation Inc)', 'Garden Greenhouse & Nursery Owner', 'lennydacat@yahoo.com', '+16097803004', '5 Bay Acres Drive, Cape May Court House, NJ 08210', true, ARRAY['VIP'], true, false, 'Active', 'Individual'),
  ('Will Morey', 'CEO — Morey''s Piers', 'will.morey@co.cape-may.nj.us', '+16094255000', '8500 Bayview Drive, Wildwood Crest, NJ 08260', true, ARRAY['VIP'], true, false, 'Active', 'Individual'),
  ('Tony Monzo', 'Attorney for NLA Founding Documents', 'amonzo@mchlegal.com', '+16094088866', '211 Bayberry Drive, Cape May Court House, NJ 08210', true, ARRAY['VIP'], true, false, 'Active', 'Individual'),
  ('Dr. Robert "Bob" Previti', 'OceanFirst Foundation — Board Member', 'bobpreviti@gmail.com', NULL, '1023 Wabash Avenue, Linwood, NJ 08221', true, ARRAY['VIP'], true, false, 'Active', 'Individual'),
  ('William Deborah Family Foundation', 'via Avalon PD', NULL, '+16106871600', '622 Golf Club Road, Newtown Square, PA 19073', true, ARRAY['VIP'], true, false, 'Active', 'Organization'),
  ('Avalon Lions Charities Foundation Attn: Jim Lutz', 'Yearly support — president for 2025 is Jim Lutz, old president was Dan Donohue. Jim''s personal address is 2539 Ocean Drive, Avalon, NJ', 'danielx.donohoe@gmail.com', '+16092542763', 'PO Box 365 Avalon, NJ 08202', true, ARRAY['VIP'], true, false, 'Active', 'Organization'),
  ('Uncle Jim/Lisa Obermeier', 'Chrissy''s uncle/aunt', 'LCasiello@cda-tps.com', '+12677187745', '425 Militia Hill Rd, Fort Washington, PA 19034', true, ARRAY['VIP'], true, false, 'Active', 'Individual'),
  ('Sue White (Avalon Lions)', 'Sue connected us to Avalon Lions. She is mother of Josh McCarty, Middle Township Athletic Director', 'suewhite61@verizon.net', '+16094252078', 'PO Box 365 Avalon, NJ 08202', true, ARRAY['VIP'], true, false, 'Active', 'Individual'),
  ('Cape May Chapter CPOA (Kevin USCG)', 'USCG Union via Kevin Frazier', 'juan.j.perez2@uscg.mil', '+14402582031', '1 Munro Avenue, Cape May, NJ 08204', true, ARRAY['VIP'], true, false, 'Active', 'Organization'),
  ('Mary Daly MacFarland Foundation', 'via VonSavage family', 'wendycwilson1@gmail.com', '+13014401088', '15225 Tanyard Rd, Sparks Glencoe, MD 21152', true, ARRAY['VIP'], true, false, 'Active', 'Organization'),
  ('Matt Harris', 'Al Harris, father, works at Burke', 'mharris14018@gmail.com', '+16094253414', '505 Blackburn Avenue, Cape May Court House, NJ 08210', true, ARRAY['VIP'], true, false, 'Active', 'Individual'),
  ('Tompkins Broll Family Foundation', NULL, NULL, '+14848831797', '3 Radnor Corporate Center Suite 450, Radnor, PA 19087', true, ARRAY['VIP'], true, false, 'Active', 'Organization'),
  ('Devon Bradshaw', 'Day 1 — Bathroom Build', 'bradshaw8devon@gmail.com', NULL, '118 East 1st Avenue, Wildwood, NJ, USA', true, ARRAY['VIP'], true, false, 'Active', 'Individual'),
  ('Joanna Lewis', 'Donation made via PayPal with a memo about Tom Nuscis', 'pjmcnl@gmail.com', NULL, NULL, true, ARRAY['VIP'], true, false, 'Active', 'Individual'),
  ('Sandra Baldino', '"In honor of Jack Lord" via PayPal', 'skbaldino@comcast.net', NULL, NULL, true, ARRAY['VIP'], true, false, 'Active', 'Individual'),
  ('James & Sharlyce Peterson', NULL, NULL, '+16096028103', '5701 Pacific Avenue, Wildwood Crest, NJ 08260', true, ARRAY['VIP'], true, false, 'Active', 'Individual'),
  ('Chris Brooks', 'Through Doug Davis — Lower Cape May grad with mom who worked at Special Services for over 20 years', NULL, '+17814627413', NULL, true, ARRAY['VIP'], true, false, 'Active', 'Individual'),
  ('Zach Morey', NULL, NULL, '+16093388177', '8400 Bayview Dr, Wildwood Crest, NJ 08260', true, ARRAY['VIP'], true, false, 'Active', 'Individual'),
  ('Jim Walls', NULL, NULL, NULL, '205 NJ-47 Cape May Court House, NJ 08210', true, ARRAY['VIP'], true, false, 'Active', 'Individual'),
  ('Sean Carney', NULL, NULL, '+14843902969', '411 Beach Ave, Cape May, NJ 08204', true, ARRAY['VIP'], true, false, 'Active', 'Individual'),
  ('Dan Placentra', NULL, 'placeconsumer@gmail.com', '+19736997467', '198 58th Street, Avalon, NJ 08202', true, ARRAY['VIP'], true, false, 'Active', 'Individual'),
  ('Brendan Sciarra', NULL, NULL, '+16097804475', NULL, true, ARRAY['VIP'], true, false, 'Active', 'Individual'),
  ('Joe Rullo', NULL, NULL, '+16098279908', NULL, true, ARRAY['VIP'], true, false, 'Active', 'Individual'),
  ('Ron Simone', NULL, NULL, '+12672521888', NULL, true, ARRAY['VIP'], true, false, 'Active', 'Individual'),
  ('Jim Burke', NULL, NULL, '+12155306517', NULL, true, ARRAY['VIP'], true, false, 'Active', 'Individual'),
  ('Joe Catanoso', NULL, NULL, '+16094081905', NULL, true, ARRAY['VIP'], true, false, 'Active', 'Individual');
