// The organization-wide attachments funders ask for, uploaded once.
//
// One row per key in grant_org_documents: a file in the private
// grant-documents bucket, or a link (a Drive file). The O.C.E.A.N. 2027
// attachments screen (docs/grant-coach/ocean-2027-rfp-form.md, screen 10)
// is the first list this has to satisfy; the rest are what nearly every
// foundation asks for next.

export interface OrgDocument {
  key: string;
  title: string;
  /** Who asks for it and why — one line. */
  why: string;
  /** Asked for by O.C.E.A.N. 2027 (required there unless noted). */
  ocean?: boolean;
  /** The file types a funder's portal usually accepts. */
  accepts?: string;
}

export const ORG_DOCUMENTS: OrgDocument[] = [
  { key: "determination_letter", title: "IRS 501(c)(3) determination letter", why: "Proof of nonprofit / tax-exempt status. Every funder.", ocean: true, accepts: "PDF" },
  { key: "form_990", title: "Most recent IRS Form 990", why: "Financial capacity. Every funder.", ocean: true, accepts: "PDF" },
  { key: "operating_budget", title: "Most recent approved operating budget", why: "The board-approved budget for the current year.", ocean: true, accepts: "PDF or XLSX" },
  { key: "audit", title: "Audited financial statements or financial review", why: "Optional for O.C.E.A.N.; required by larger foundations.", ocean: true, accepts: "PDF" },
  { key: "board_list", title: "Board of directors list", why: "Names, roles and affiliations. Asked alongside the 990.", accepts: "PDF or DOCX" },
  { key: "w9", title: "W-9", why: "Needed before any award is paid.", accepts: "PDF" },
  { key: "insurance", title: "Certificate of insurance", why: "General liability; asked by funders who fund on-site youth programs.", accepts: "PDF" },
  { key: "nj_charity", title: "NJ charitable registration", why: "Annual state registration; some NJ funders check it.", accepts: "PDF" },
  { key: "bylaws", title: "Bylaws", why: "Occasionally requested with the determination letter.", accepts: "PDF" },
  { key: "letters_packet", title: "Letters of support packet", why: "The March 2026 packet: eleven letters from law enforcement, school districts, O.C.E.A.N., Cape Assist and Acenda. Attach as is, or ask for fresh ones per application.", accepts: "PDF" },
];

export const GRANT_DOCUMENTS_BUCKET = "grant-documents";

/** A safe object name for a file in the bucket. */
export const orgDocumentPath = (key: string, fileName: string) => {
  const clean = fileName.replace(/[^\w.-]+/g, "_").slice(0, 80);
  return `org/${key}/${Date.now()}_${clean}`;
};
