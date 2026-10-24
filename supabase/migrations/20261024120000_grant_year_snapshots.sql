-- The Program Year Snapshot (Josh, 2026-10-24): one fixed, funder-neutral block
-- per program year, four sections, each approved word for word and locked
-- until Josh unlocks it. Grant Coach reads the approved sections as source 2
-- (after the website, before the raw live numbers): where the Snapshot states
-- a figure or a sentence, it is used as written. Copy-paste into any
-- application from Grant Coach home → Snapshot.
create table if not exists public.grant_year_snapshots (
  id            uuid primary key default gen_random_uuid(),
  program_year  text not null,
  section_key   text not null,
  sort          int  not null default 0,
  title         text not null,
  body          text not null default '',
  status        text not null default 'draft' check (status in ('draft', 'approved')),
  approved_at   timestamptz,
  approved_by   uuid references auth.users(id) on delete set null,
  updated_at    timestamptz not null default now(),
  updated_by    uuid references auth.users(id) on delete set null,
  unique (program_year, section_key)
);

alter table public.grant_year_snapshots enable row level security;
create policy grant_year_snapshots_admin_select on public.grant_year_snapshots for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy grant_year_snapshots_admin_insert on public.grant_year_snapshots for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy grant_year_snapshots_admin_update on public.grant_year_snapshots for update to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy grant_year_snapshots_admin_delete on public.grant_year_snapshots for delete to authenticated using (public.has_role(auth.uid(), 'admin'));
insert into public.app_tables (app_key, table_name) values ('app_grant_coach', 'grant_year_snapshots') on conflict do nothing;
create policy "Box holders manage grant_year_snapshots" on public.grant_year_snapshots for all to authenticated
  using (public.has_table('grant_year_snapshots')) with check (public.has_table('grant_year_snapshots'));

-- 2025-26, as Josh approved it on 2026-10-24 — approved and locked.
insert into public.grant_year_snapshots (program_year, section_key, sort, title, body, status, approved_at) values
  ('2025-2026', 'who_we_served', 1, 'Who we served', $snap$WHO WE SERVED · 2025–26

No Limits Academy (NLA) is a free, year-round boxing and youth development center in Rio Grande serving Cape May County youth ages 7–19. Senior Boxing, ages 11–19, runs Monday through Friday, 2:30–8:30 PM, during the school year and four days a week in summer. Junior Boxing, ages 7–10, meets on Tuesdays. Training is safety-focused: 95% of NLA's youth participate in non-contact boxing.

The need is visible in the county's schools. The districts where NLA's youth live report high shares of economically disadvantaged students: Woodbine Elementary School about 75%, Wildwood City School District about 70%, Middle Township School District about 50% and Lower Township School District about 45%.

In the 2025–26 program year, 518 youth registered: 285 Senior Boxers (55%) and 233 Junior Boxers (45%). The registration forms show who they are:

- 358 boys (69%) and 160 girls (31%).
- 373 (72%) economically disadvantaged: household income under $35,000 or eligible for free or reduced-price lunch — a conservative measure; CSBG's 200% of poverty line is higher.
- Demographics: 36% White, 31% Hispanic or Latino, 20% Black, 11% multiracial, 2% Asian, Pacific Islander or Native American.
- 147 (28%) live in a single-parent household (Mom Only or Dad Only on the form).
- Daily attendance: Hispanic or Latino youth account for 46% of practice check-ins, Black youth 24%, White youth 19%, all others 11%.
- NLA's reach runs across Cape May County's school districts: Middle Township 33%, Lower Township 19%, Wildwood 15%, Woodbine 12%, Cape May County Technical High School 6%, Wildwood Catholic Academy 4%, and Cape May, Upper Township, Ocean City, Avalon–Stone Harbor and homeschool 4% together.

Wildwood and Woodbine are among New Jersey's most economically distressed municipalities, and NLA's own vans run to both year-round, free. In 2025–26, 73 youth rode: 49 from Woodbine, 89% of them economically disadvantaged, and 24 from Wildwood, 78% economically disadvantaged.$snap$, 'approved', '2026-10-24 12:00:00-04'),
  ('2025-2026', 'what_we_do', 2, 'What we do · More than a boxing gym', $snap$WHAT WE DO · MORE THAN A BOXING GYM

NLA is more than a boxing gym. Through boxing, NLA develops youth personally, professionally and spiritually. NLA is open Monday through Friday, 2:30–8:30 PM, during the school year and four days a week in the summer. NLA offers all of its services at no cost to the families it serves.

1. Boxing and youth development. Senior Boxing, ages 11–19, trains Monday through Friday; Junior Boxing, ages 7–10, meets on Tuesdays. Daily attendance at NLA is 40–120 youth per night. Senior Boxers help coach the Junior Boxers, part of NLA's emphasis on Service, one of its seven core values.

2. A hot dinner every program night. The Meal Train offers youth a sit-down, family-style dinner with friends and mentors after practice. More than 1,200 hot meals are served each month.

3. The Launch Pad: launching youth into their futures. From 8th through 12th grade, youth answer the question every young person faces: "What am I going to do after high school?" Each youth chooses one of four Pads (Military & Law Enforcement, College, Trade School or Workforce) and builds a plan with two coaches. A Pathway Coach helps them find their strengths and the Pad that fits; an Accountability Coach makes sure every test, application and deadline gets done. NLA places youth only with employers committed to developing them as future leaders: a leadership pipeline, not a labor pipeline.

4. A structured daily rhythm. Every night follows the same order: open gym and after-school support, team roll call and daily reflection, the training block, daily duties, then dinner together. It makes NLA a steady, reliable presence through one of the most chaotic seasons of a young person's life.

5. Experiences beyond the gym, and a ride to get there. Excursions take youth beyond the facility walls: camping in West Virginia, speed boating and tubing, sail camp, kayaking and paddle boarding, the Philadelphia Museum of Art, a Phillies game and the Atlantic City Boxing Hall of Fame. NLA's own vans run free, year-round, so a youth without a ride still comes.

Around that core, NLA wraps the support a young person needs:

- Strength & conditioning: a structured strength program in every training block, with each athlete's lifts logged so their progress is tracked over time.
- Mental health support on site: licensed providers embedded at NLA through Acenda's NJ4S, Cape Assist and CARA, for formal counseling or an informal conversation, right where youth already are.
- Spiritual development: reflection, values and purpose, always voluntary, for youth who choose to explore their faith at their own pace.
- Mentors: coaches who show up every day, plus Gym Buddies, the local police officers, firefighters and U.S. Coast Guard members who train alongside youth and become trusted adults in their lives.
- Real Talk Sessions: influential adults share honest stories of struggle and resilience.
- Coaching Boys into Men: an evidence-based violence-prevention program delivered with Cape Assist.
- Juniors Aftercare: immediately after Junior Boxing practice, youth are offered Smile Lab, oral health and hygiene with Delta Dental, and Life Lab, life skills like manners, gratitude, kindness and confidence.
- Partner programs: Hawk Squad, with Cape May County Technical High School, and BAM, with Cape May County Special Services, are creative ways NLA extends its support to more of Cape May County's youth.$snap$, 'approved', '2026-10-24 12:00:00-04'),
  ('2025-2026', 'organization', 3, 'Organization overview', $snap$ORGANIZATION OVERVIEW

No Limits Academy (NLA) is a 501(c)(3) nonprofit youth development center in Rio Grande, New Jersey, serving youth ages 7–19 from across Cape May County. Co-founders Josh Mercado, a National Collegiate Boxing Champion and former Cape May County Technical High School teacher, and Dave Von Savage Jr., a U.S. Naval Academy graduate, Navy veteran and Wharton MBA, opened NLA in April 2020.

NLA's home is a 14,000-square-foot facility at 1086 Route 47 South, Rio Grande, which NLA has renovated and built out into a state-of-the-art training and youth development center. It is open year-round, Monday through Friday, 2:30–8:30 PM, and every program is free. Training is safety-focused: 95% of NLA's youth participate in non-contact boxing.

NLA has raised more than $3 million since 2020 and operates with only two full-time employees: Josh Mercado, Program Director, and Chrissy Casiello, Program Coordinator. Part-time coaches, mentors and a broad volunteer network support them, and a five-member Board of Trustees provides strategic guidance, financial oversight and accountability.

NLA is sustained by a diversified funding model: individual and community donors, fundraising events, fee-for-service programming with schools and partner agencies, and county, state and pass-through grants.

Schools, law enforcement, mental health providers and public officials across Cape May County recognize NLA as a legitimate, trusted hub for youth development. Local schools rely on NLA as a creative partner for behavioral intervention and extended support, and elected officials at the municipal, county, state and federal levels have endorsed its work.$snap$, 'approved', '2026-10-24 12:00:00-04'),
  ('2025-2026', 'capacity', 4, 'Capacity and partners', $snap$CAPACITY AND PARTNERS

Personnel. Two full-time staff lead NLA. Josh Mercado, Program Director, is a National Collegiate Boxing Champion, former professional boxer and certified educator with more than a decade of teaching at Cape May County Technical High School. Chrissy Casiello, Program Coordinator, oversees daily supervision, scheduling, logistics, participant records and reporting. They are supported by part-time coaches, CDL-licensed drivers, licensed behavioral health partners on site, administrative support and CPA services for compliance and financial management.

Systems. NLA runs on a custom-built operations platform with AI built in. Every registration, daily check-in, meal and van ride is logged as it happens, and AI-assisted tools turn those records into accurate, on-time reports. It is how two full-time staff run a program of this size, and how NLA has met every grant reporting and accountability requirement to date.

Partners. NLA works hand in hand with the institutions that serve Cape May County's youth:
- Schools: Middle Township Public Schools, Wildwood Public Schools, Woodbine School District, Lower Cape May Regional School District, Cape May County Technical School District (Hawk Squad) and Cape May County Special Services School District (BAM).
- Law enforcement: Gym Buddies with police departments across the county and the Sheriff's Department, and Shop with a Cop with the Cape May County Prosecutor's Office.
- Mental health: Acenda's NJ4S, Cape Assist and CARA, embedded on site.
- Health: Delta Dental, through Smile Lab.
- Community action: O.C.E.A.N., Inc., NLA's CSBG partner.

In March 2026, eleven leaders wrote letters in support of NLA: four school superintendents, the director of Cape May County High School and Ocean Academy, two police chiefs, the Cape May County Prosecutor, and the heads of O.C.E.A.N., Inc., Cape Assist and Acenda's NJ4S.
- "The relationship between our department and No Limits Academy is one of the strongest community partnerships we have." — Tracey Super, Chief of Police, Middle Township
- "This program has proven to be a model for how schools and community organizations can work together to support the whole child." — Jamie Moscony, Superintendent, Cape May County Technical and Special Services School Districts

Recognition. Cape May County Chamber of Commerce Non-Profit of the Year; a 2024 Congressional Proclamation of Recognition from the U.S. House of Representatives; Cape Assist's Partner in Prevention Award; USA Boxing Mid-Atlantic's George Hill Humanitarian Award; Caring For Kids' Community Impact Award; and Middle Township's "Middle Matters" Civic Recognition Award.$snap$, 'approved', '2026-10-24 12:00:00-04')
on conflict (program_year, section_key) do nothing;
