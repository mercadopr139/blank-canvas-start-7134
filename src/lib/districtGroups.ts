// School districts as NLA reports them: every value the registration form's
// district dropdown has ever offered, folded into the groups the Youth-per-
// District map uses (Lower Cape May = Cape May, West Cape May and Lower Twp;
// Middle includes Dennis; Wildwood includes the Crest and North Wildwood…).
// Shared by the map and the By School District circle chart so both always
// group the same way.

export type GroupKey =
  | "lowercape" | "ocean" | "middle" | "wildwood"
  | "woodbine" | "avalon" | "tech" | "catholic" | "home";

export const GROUP_LABEL: Record<GroupKey, { name: string; sub: string }> = {
  middle:    { name: "Middle Township",       sub: "incl. Dennis Twp" },
  wildwood:  { name: "Wildwood",              sub: "incl. Crest & N. Wildwood" },
  lowercape: { name: "Lower Cape May",        sub: "Cape May, W. Cape May, Lower Twp" },
  woodbine:  { name: "Woodbine",              sub: "" },
  ocean:     { name: "Ocean City",            sub: "incl. Upper Twp" },
  tech:      { name: "Cape May Tech",         sub: "county vocational school" },
  catholic:  { name: "Wildwood Catholic",     sub: "private academy" },
  avalon:    { name: "Avalon & Stone Harbor", sub: "" },
  home:      { name: "Homeschool / Other",    sub: "no fixed district" },
};

/**
 * Josh's colour for each district group (2026-10-26), used by the map AND the
 * By School District circle — a district never changes colour within a page.
 * Shades were tuned with the dataviz validator so neighbouring slices in the
 * circle pass the colour-blind check on the dark cards.
 */
export const GROUP_COLOR: Record<GroupKey, string> = {
  lowercape: "#3987e5", // blue
  middle:    "#d95926", // orange
  catholic:  "#4467db", // navy blue
  woodbine:  "#d9a400", // yellow
  wildwood:  "#b4405c", // maroon
  avalon:    "#1fa3a3", // teal
  ocean:     "#e34948", // red
  home:      "#b3a6ef", // light purple
  tech:      "#35a84c", // green
};

/** Every school_district value → its group, and the municipality polygon the map scatters its dots into (null = off-map). */
export const DISTRICT_MAP: Record<string, { g: GroupKey; mun: string | null }> = {
  "Cape May City":                                        { g: "lowercape", mun: "Cape May" },
  "Cape May/West Cape May":                               { g: "lowercape", mun: "Cape May" },
  "West Cape May":                                        { g: "lowercape", mun: "West Cape May Borough" },
  "Lower Township":                                       { g: "lowercape", mun: "Lower Township" },
  "Lower Cape May Regional":                              { g: "lowercape", mun: "Lower Township" },
  "Middle Township":                                      { g: "middle",    mun: "Middle Township" },
  "Dennis Township":                                      { g: "middle",    mun: "Dennis Township" },
  "Ocean City":                                           { g: "ocean",     mun: "Ocean City" },
  "Upper Township":                                       { g: "ocean",     mun: "Upper Township" },
  "Wildwood":                                             { g: "wildwood",  mun: "Wildwood" },
  "Wildwood/Wildwood Crest/North Wildwood":               { g: "wildwood",  mun: "Wildwood" },
  "Wildwood Crest":                                       { g: "wildwood",  mun: "Wildwood Crest Borough" },
  "North Wildwood":                                       { g: "wildwood",  mun: "North Wildwood" },
  "Woodbine":                                             { g: "woodbine",  mun: "Woodbine Borough" },
  "Avalon/Stone Harbor":                                  { g: "avalon",    mun: "Avalon Borough" },
  "Cape May Tech":                                        { g: "tech",      mun: "Middle Township" },
  "Wildwood Catholic Academy":                            { g: "catholic",  mun: "North Wildwood" },
  "Homeschool, Hybrid, or Alternative Form of Schooling": { g: "home",      mun: null },
  "Other":                                                { g: "home",      mun: null },
};

/** The group a district value belongs to; anything unknown or blank is Homeschool / Other. */
export const groupOf = (district: string | null | undefined): GroupKey => DISTRICT_MAP[(district ?? "").trim()]?.g ?? "home";

/** A district's name as a reader wants it in a breakdown line: shorter, but never ambiguous. */
export const shortDistrict = (d: string) =>
  ({
    "Homeschool, Hybrid, or Alternative Form of Schooling": "Homeschool / hybrid",
    "Wildwood/Wildwood Crest/North Wildwood": "Wildwood, Crest & N. Wildwood",
    "Wildwood Catholic Academy": "Wildwood Catholic Academy",
    Unknown: "Not given",
  } as Record<string, string>)[d] ?? d;
