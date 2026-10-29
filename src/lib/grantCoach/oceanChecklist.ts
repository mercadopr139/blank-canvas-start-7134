// The O.C.E.A.N., Inc. 2027 CSBG Partnership Program application, as a
// checklist — every screen and field of the online "2027 RFP Form", from
// docs/grant-coach/ocean-2027-rfp-form.md (captured from Josh's walk-through
// on 2026-10-15). This seeds the folder's checklist; the acceptance test for
// step 2 is that this list and the form agree.

export type ChecklistKind = "eligibility" | "field" | "narrative" | "upload" | "acknowledgment" | "signature" | "task";

export interface ChecklistSeed {
  section: string;
  label: string;
  detail?: string;
  kind: ChecklistKind;
  required?: boolean;
  /** Who usually owns it. */
  owner?: "Josh" | "Chrissy";
}

export interface FolderTemplate {
  key: string;
  name: string;
  funder: string;
  programName: string;
  /** ISO instant of the deadline, America/New_York. */
  dueAt: string;
  amountMax: number;
  periodStart: string;
  periodEnd: string;
  portalUrl?: string;
  items: ChecklistSeed[];
}

const F = (section: string, label: string, detail?: string, owner: "Josh" | "Chrissy" = "Chrissy"): ChecklistSeed =>
  ({ section, label, detail, kind: "field", required: true, owner });

export const OCEAN_2027: FolderTemplate = {
  key: "ocean-2027",
  name: "O.C.E.A.N., Inc. 2027 CSBG Partnership Program",
  funder: "O.C.E.A.N., Inc.",
  programName: "Meal Train",
  // Oct 30, 2026, 5:00 PM Eastern.
  dueAt: "2026-10-30T21:00:00.000Z",
  amountMax: 75000,
  periodStart: "2027-01-01",
  periodEnd: "2027-12-31",
  items: [
    // Eligibility first: a yes/no before anything else.
    { section: "Eligibility", label: "NLA is a nonprofit in good standing, not suspended, debarred, dissolved or barred from State or federal funding", kind: "eligibility", required: true, owner: "Josh" },
    { section: "Eligibility", label: "Participants can be verified at or below 200% of the federal poverty level, with documents on file before service", detail: "CSBG rule. Decide how income is verified at enrollment (screen 7 asks).", kind: "eligibility", required: true, owner: "Josh" },
    { section: "Eligibility", label: "The program runs within Jan 1 – Dec 31, 2027 and asks for no more than $75,000", kind: "eligibility", required: true, owner: "Josh" },

    // Screen 1
    F("1 · Organization Information", "Legal name of organization", "No Limits Academy Inc."),
    F("1 · Organization Information", "Doing Business As (DBA) / AKA"),
    F("1 · Organization Information", "Federal EIN", "From the library."),
    F("1 · Organization Information", "Organization mailing address", "Street, line 2, city, ZIP — the mailing address, not the gym."),
    { section: "1 · Organization Information", label: "Website", kind: "field", required: false, owner: "Chrissy" },
    F("1 · Organization Information", "Year established", "2020"),
    F("1 · Organization Information", "Organization mission", "Free text — from the library's mission statement.", "Josh"),
    { section: "1 · Organization Information", label: "Legal authorization certification (checkbox)", detail: "Legally authorized; not suspended, debarred, dissolved or prohibited from State or federal funding.", kind: "acknowledgment", required: true, owner: "Josh" },

    // Screen 2
    F("2 · Executive Leadership and Contacts", "Executive Director / CEO — name and title", "Organization leadership and authorized executive contact."),
    F("2 · Executive Leadership and Contacts", "Executive Director / CEO — email"),
    F("2 · Executive Leadership and Contacts", "Executive Director / CEO — phone"),
    F("2 · Executive Leadership and Contacts", "Primary Grant Contact — name and title", "Overall responsibility for the O.C.E.A.N. partnership."),
    F("2 · Executive Leadership and Contacts", "Primary Grant Contact — email"),
    F("2 · Executive Leadership and Contacts", "Primary Grant Contact — phone"),
    F("2 · Executive Leadership and Contacts", "Program Contact — same as primary, or name/email/phone", "Program implementation, participant records, EmpowOR / reporting coordination."),
    F("2 · Executive Leadership and Contacts", "Finance Contact — same as primary, or name/email/phone", "Invoices, reimbursement documentation, payment coordination."),

    // Screen 3
    F("3 · O.C.E.A.N. Funding History", "Previously received O.C.E.A.N. funding? (Yes / No)", "Yes."),
    { section: "3 · O.C.E.A.N. Funding History", label: "Program name previously funded", detail: "No Limits Academy's Youth Boxing Program.", kind: "field", required: false, owner: "Chrissy" },
    { section: "3 · O.C.E.A.N. Funding History", label: "Previous funding amount", detail: "$180,000 from the walk-through — confirm.", kind: "field", required: false, owner: "Josh" },

    // Screen 4
    F("4 · Proposed Program / Project", "Program / Project name", "Meal Train.", "Josh"),
    { section: "4 · Proposed Program / Project", label: "Brief funding purpose", detail: "A text box.", kind: "narrative", required: true, owner: "Josh" },
    F("4 · Proposed Program / Project", "Requested grant amount", "Max $75,000.", "Josh"),
    F("4 · Proposed Program / Project", "Total program / project cost", undefined, "Josh"),
    F("4 · Proposed Program / Project", "Program start date", "Within Jan 1 – Dec 31, 2027.", "Josh"),
    F("4 · Proposed Program / Project", "Program end date", undefined, "Josh"),
    F("4 · Proposed Program / Project", "Service frequency", "Daily / Multiple times per week / Weekly / Biweekly / Monthly / Seasonal / One-time / Other.", "Josh"),

    // Screen 5
    F("5 · Service Area and Target Population", "Counties served", "Ocean / Atlantic / Cape May — check Cape May."),
    F("5 · Service Area and Target Population", "Cities, towns or communities to be served", "From the library's service area."),
    F("5 · Service Area and Target Population", "Physical program location(s)", "1086 Route 47 South, Rio Grande, NJ 08242."),
    F("5 · Service Area and Target Population", "Target population", "Check Children 6–12, Youth 13–17, Young adults 18–24; Other: 7–19 years old."),

    // Screen 6
    F("6 · Performance Commitments", "Projected unduplicated individuals", "A number — from Youth Served and the Meal Train counts.", "Josh"),
    { section: "6 · Performance Commitments", label: "Projected unduplicated households", kind: "field", required: false, owner: "Josh" },
    { section: "6 · Performance Commitments", label: "Primary outcome(s)", kind: "narrative", required: true, owner: "Josh" },
    { section: "6 · Performance Commitments", label: "Outcome measure(s)", kind: "narrative", required: true, owner: "Josh" },
    { section: "6 · Performance Commitments", label: "Data collection tool(s)", detail: "The kiosk check-ins, meal log, registration demographics — from the library's outcomes language.", kind: "narrative", required: true, owner: "Josh" },
    F("6 · Performance Commitments", "EmpowOR / data-reporting responsibility — same as Program Contact? (Yes / No)"),

    // Screen 7
    { section: "7 · Eligibility and Participant Records", label: "Participant eligibility-verification process", detail: "How income at or below 200% FPL is verified before or at enrollment.", kind: "narrative", required: true, owner: "Josh" },
    { section: "7 · Eligibility and Participant Records", label: "Eligibility verification acknowledgment (checkbox)", detail: "Verified before or at enrollment and before CSBG-funded services.", kind: "acknowledgment", required: true, owner: "Josh" },
    { section: "7 · Eligibility and Participant Records", label: "Where and how participant files are secured", kind: "narrative", required: true, owner: "Chrissy" },
    F("7 · Eligibility and Participant Records", "Who reviews files for completeness (name)"),

    // Screen 8
    { section: "8 · Program Narrative", label: "1. Statement of need, with recent local information or experience", kind: "narrative", required: true, owner: "Josh" },
    { section: "8 · Program Narrative", label: "2. Program design, major activities, and service schedule", kind: "narrative", required: true, owner: "Josh" },
    { section: "8 · Program Narrative", label: "3. Outreach, referral, enrollment, and participant retention", kind: "narrative", required: true, owner: "Josh" },
    { section: "8 · Program Narrative", label: "4. Staff roles, qualifications, supervision, and use of volunteers or subcontractors", kind: "narrative", required: true, owner: "Josh" },
    { section: "8 · Program Narrative", label: "5. Coordination with other organizations and avoidance of duplicated services", kind: "narrative", required: true, owner: "Josh" },
    { section: "8 · Program Narrative", label: "6. Experience delivering comparable services and evidence of past effectiveness", kind: "narrative", required: true, owner: "Josh" },
    { section: "8 · Program Narrative", label: "7. Sustainability or transition plan if CSBG funding ends", kind: "narrative", required: true, owner: "Josh" },
    { section: "8 · Program Narrative", label: "Upload the detailed program narrative (PDF or DOCX, items 1–7 in order)", kind: "upload", required: true, owner: "Josh" },

    // Screen 9
    F("9 · Budget and Financial Capacity", "Most recent approved annual operating budget", "A number — from the library.", "Josh"),
    F("9 · Budget and Financial Capacity", "Operating deficit? (Yes / No)", "If yes: amount and explanation.", "Josh"),
    { section: "9 · Budget and Financial Capacity", label: "Other committed or pending program funds — source, status, amount", kind: "field", required: false, owner: "Josh" },

    // Screen 10
    { section: "10 · Required Attachments", label: "Completed O.C.E.A.N. line-item budget workbook (XLSX)", detail: "Download the official template on this screen; complete the Cape May County sections; save as NoLimitsAcademy_Budget_CapeMay.xlsx.", kind: "upload", required: true, owner: "Josh" },
    { section: "10 · Required Attachments", label: "Proof of nonprofit / tax-exempt status (PDF)", detail: "The determination letter, from Grant Coach → Documents.", kind: "upload", required: true, owner: "Chrissy" },
    { section: "10 · Required Attachments", label: "Budget narrative / justification (PDF or DOCX)", kind: "upload", required: true, owner: "Josh" },
    { section: "10 · Required Attachments", label: "Most recent approved operating budget (PDF or XLSX)", detail: "From Grant Coach → Documents.", kind: "upload", required: true, owner: "Chrissy" },
    { section: "10 · Required Attachments", label: "Most recent IRS Form 990 (PDF)", detail: "From Grant Coach → Documents.", kind: "upload", required: true, owner: "Chrissy" },
    { section: "10 · Required Attachments", label: "Most recent audited financial statements or financial review", kind: "upload", required: false, owner: "Chrissy" },
    { section: "10 · Required Attachments", label: "Other documents specifically requested by O.C.E.A.N., Inc.", kind: "upload", required: false, owner: "Chrissy" },

    // Screen 11
    { section: "11 · Applicant Acknowledgments", label: "1. Verify participant eligibility before/at enrollment; retain documentation; follow O.C.E.A.N./NJDCA rules for zero-income households", kind: "acknowledgment", required: true, owner: "Josh" },
    { section: "11 · Applicant Acknowledgments", label: "2. Funding is reimbursement-based; unsupported, unallowable or unpaid expenses are not reimbursed", kind: "acknowledgment", required: true, owner: "Josh" },
    { section: "11 · Applicant Acknowledgments", label: "3. Submit required financial, program and EmpowOR reports; keep records for the retention period; make them available for review", kind: "acknowledgment", required: true, owner: "Josh" },
    { section: "11 · Applicant Acknowledgments", label: "4. Protect PII; limit access; secure participant records; report suspected loss or disclosure promptly", kind: "acknowledgment", required: true, owner: "Josh" },
    { section: "11 · Applicant Acknowledgments", label: "5. Cooperate with monitoring, site visits, technical assistance, corrective action, and fiscal/programmatic review", kind: "acknowledgment", required: true, owner: "Josh" },
    { section: "11 · Applicant Acknowledgments", label: "6. Disclose actual or potential conflicts of interest; no award funds for prohibited activities", kind: "acknowledgment", required: true, owner: "Josh" },

    // Screen 12
    { section: "12 · Certification and Signature", label: "Authorized signature, printed name, title and date", kind: "signature", required: true, owner: "Josh" },
    { section: "12 · Certification and Signature", label: "Print the completed application for the folder, then SUBMIT", detail: "Due Oct 30, 2026, 5:00 PM.", kind: "task", required: true, owner: "Josh" },
  ],
};

export const FOLDER_TEMPLATES: FolderTemplate[] = [OCEAN_2027];

/** Progress over the items that count: required ones not marked N/A. */
export const checklistProgress = (items: { required: boolean; status: string }[]) => {
  const counted = items.filter((i) => i.required && i.status !== "na");
  const done = counted.filter((i) => i.status === "done").length;
  return { done, total: counted.length };
};
