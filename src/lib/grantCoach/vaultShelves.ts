// The Grant Vault's shelves and cards, by SUBJECT (Josh, 2026-11-20: "I want
// this area to be so user friendly that anyone can easily pull important NLA
// info from it… my goal is to read a section and think, yup, that's where I
// will find the information I'm looking for").
//
// The fields themselves live in orgProfile.ts, grouped the way funders ask,
// which is how the writer reads them. People read by subject, so the page
// shows the same fields on cards named for what is inside — "NLA on paper",
// "Who to call", "The money" — one subject per card, one card per subject,
// on five shelves named for the question in Josh's head: the paragraphs,
// NLA on paper, the money, what we do and who we serve, our story and our
// people. "How Grant Coach writes" sits below the amber line: settings for
// the writer, not NLA information.
//
// A shelf's title can be renamed on the page; the name is kept in
// grant_org_fields under shelfTitleKey(shelf) (no migration), and every
// reader of that table walks ORG_FIELDS by key, so the row is invisible to
// the writer. Every field of ORG_SECTIONS belongs to exactly one card
// (vaultShelves.test.ts).

export interface VaultCardDef {
  key: string;
  title: string;
  /** One line while the card is folded: what is inside. */
  gist: string;
  /** Field keys from orgProfile.ts, in the order they read. */
  fields: string[];
  /** Long prose Grant Coach reads for story and voice: a figure in it never outranks a paragraph or the live numbers. */
  source?: true;
}

export interface VaultShelfDef {
  key: string;
  /** The name as shipped; Josh can rename it on the page. */
  title: string;
  /** One line under the title: what sits here. */
  blurb: string;
  cards: VaultCardDef[];
}

/** The key in grant_org_fields that holds a renamed shelf title. */
export const shelfTitleKey = (shelfKey: string) => `shelf_title:${shelfKey}`;
/** The key in grant_org_fields that holds a renamed card title (Josh, 2026-11-20: "the ability to manually edit the card titles"). */
export const cardTitleKey = (cardKey: string) => `card_title:${cardKey}`;

/** Shelf 1 is the six standard paragraphs (SnapshotSection cards), not fields; it is named here so it can be renamed too. */
export const PARAGRAPHS_SHELF = { key: "paragraphs", title: "The paragraphs", blurb: "" };

export const VAULT_SHELVES: VaultShelfDef[] = [
  {
    key: "paper", title: "NLA on paper",
    blurb: "The first screen of every portal: legal name, EIN, dates, addresses, the mission, and who the funder calls. Copy the card takes a whole card with its labels.",
    cards: [
      {
        key: "paper", title: "NLA on paper",
        gist: "Legal name, EIN, 501(c)(3) date, fiscal year, year established, website, phone, both addresses, the mission.",
        fields: ["legal_name", "dba", "ein", "nonprofit_date", "fiscal_year", "year_established", "website", "phone", "address_physical", "address_mailing", "mission"],
      },
      {
        key: "contacts", title: "Who to call",
        gist: "Executive leadership, the grant contact, the program contact, the finance contact, who signs.",
        fields: ["ed_name", "ed_email", "ed_phone", "grant_contact_name", "grant_contact_email", "grant_contact_phone", "program_contact_name", "program_contact_email", "program_contact_phone", "finance_contact_name", "finance_contact_email", "finance_contact_phone", "signer_name"],
      },
    ],
  },
  {
    key: "money", title: "The money",
    blurb: "Budget, revenue, the 990 and the audit; what NLA has received and from whom; what keeps the program free when a grant ends.",
    cards: [
      {
        key: "money", title: "The money",
        gist: "Budget, revenue and expenses, deficit, audit, the 990 year, revenue history, financial position, the transportation budget lines.",
        fields: ["annual_budget", "prior_revenue", "prior_expenses", "operating_deficit", "deficit_explanation", "audit_status", "form_990_year", "revenue_history", "financial_position", "transport_budget"],
      },
      {
        key: "funding", title: "Funding received",
        gist: "Past grants by funder, amount and year; the O.C.E.A.N. history; other committed or pending funds.",
        fields: ["past_grants", "ocean_prior", "ocean_program", "ocean_amount", "other_funds"],
      },
      {
        key: "sustain", title: "Sustainability and revenue model",
        gist: "What keeps the program free when a grant ends.",
        fields: ["sustainability"], source: true,
      },
    ],
  },
  {
    key: "program", title: "What we do and who we serve",
    blurb: "Every program and the hours, the three groups, the values and rules, how outcomes are measured, the fleet, and the need in the county.",
    cards: [
      {
        key: "runs", title: "What NLA runs and when",
        gist: "Every program and service, the five things NLA offers, and the hours by season.",
        fields: ["programs", "offer_top5", "schedule"],
      },
      {
        key: "groups", title: "The program: three groups",
        gist: "The Littles, the Non-Battle Team and the Battle Team, with Junior Boxing on Tuesdays as the door; the short version; the Battle Team funding case.",
        fields: ["program_description", "boxing_teams_short", "battle_team_case"], source: true,
      },
      {
        key: "values", title: "Core values and house rules",
        gist: "The seven values and the ten rules, word for word.",
        fields: ["values_rules"], source: true,
      },
      {
        key: "outcomes", title: "Outcomes and how we measure",
        gist: "What the back end records and how youth served, retention and the disadvantaged share are counted.",
        fields: ["outcomes"], source: true,
      },
      {
        key: "fleet", title: "The fleet and who rides",
        gist: "Four vehicles, 59 seats, five CDL drivers; Woodbine and Wildwood are the standing routes.",
        fields: ["fleet"], source: true,
      },
      {
        key: "need", title: "The need in the county",
        gist: "The county, the service area, the county's hardship and where it concentrates, the target population.",
        fields: ["counties", "need", "service_area", "target_population"], source: true,
      },
    ],
  },
  {
    key: "people", title: "Our story, our people, our partners",
    blurb: "Josh and Dave, the building, the team and the board, and who stands with NLA: partners, letters of support, recognition.",
    cards: [
      {
        key: "story", title: "Our story and the facility",
        gist: "Josh and Dave, 2020, the building on Route 47, and what the CPF award is building.",
        fields: ["story", "facility"], source: true,
      },
      {
        key: "staff", title: "Staffing and staff bios",
        gist: "Two full-time staff and the coaches, said as efficiency; a short paragraph for each person a funder will see named.",
        fields: ["staffing", "staff_bios"], source: true,
      },
      {
        key: "board", title: "The board",
        gist: "The Board of Directors: name, role, affiliation.",
        fields: ["board"],
      },
      {
        key: "partners", title: "Partners, letters and recognition",
        gist: "Partners and what each does with NLA, the law enforcement partners, the letters of support, what partners say, awards.",
        fields: ["partners", "law_enforcement", "letters_support", "partner_quotes", "awards"],
      },
    ],
  },
];

/** Below the amber line: instructions to the writer, not facts about NLA. */
export const WRITER_CARDS: VaultCardDef[] = [
  {
    key: "voice", title: "How Grant Coach writes",
    gist: "The proposal it writes like, and the rules it learned from your edits.",
    fields: ["writing_examples", "corrections"],
  },
];

export const ALL_VAULT_CARDS: VaultCardDef[] = [...VAULT_SHELVES.flatMap((s) => s.cards), ...WRITER_CARDS];
