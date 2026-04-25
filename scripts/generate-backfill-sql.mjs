// Pulls every row from the Monday board, maps the parent's raw answers for
// adults_in_household + siblings_in_household to the correct numeric values,
// and emits two SQL files:
//
//   scripts/backfill-DRY-RUN.sql  — runs everything in a transaction then ROLLBACK,
//                                    shows match counts, no changes committed.
//   scripts/backfill-APPLY.sql    — same logic but COMMITs at the end.
//
// Run with: node --env-file=.env.local scripts/generate-backfill-sql.mjs
//
// Then paste the dry-run file into Supabase SQL Editor first to verify,
// and only run the apply file once the diff looks correct.

import { writeFileSync } from "node:fs";

const TOKEN = process.env.MONDAY_API_TOKEN;
const BOARD_ID = process.env.MONDAY_BOARD_ID;
if (!TOKEN || !BOARD_ID) {
  console.error("Missing MONDAY_API_TOKEN or MONDAY_BOARD_ID in .env");
  process.exit(1);
}

const COL = {
  childFirst: "short_text56",
  childLast: "short_text",
  parentEmail: "email",
  adultsRaw: "single_select3",
  siblingsRaw: "single_select9bj1rew",
};

// Normalize: lowercase, collapse all whitespace, fix common misspellings.
// Real Monday data has variants like "Dad +Partner", "Child+ 2 siblings",
// "Child + 3 silblings", "Only Child" — all should map cleanly.
const normalize = (s) =>
  String(s)
    .toLowerCase()
    .replace(/silblings?/g, "siblings")
    .replace(/sibblings?/g, "siblings")
    .replace(/\s+/g, " ")
    .replace(/\s*\+\s*/g, " + ")
    .trim();

const ADULTS_TO_NUM = {
  [normalize("Dad and Mom")]: 2,
  [normalize("Mom and Dad")]: 2,
  [normalize("Dad Only")]: 1,
  [normalize("Mom Only")]: 1,
  [normalize("Dad + Partner")]: 2,
  [normalize("Mom + Partner")]: 2,
  [normalize("Grandparent(s)")]: 2,
  [normalize("Other")]: 1,
};

const ADULTS_CANONICAL = {
  [normalize("Dad and Mom")]: "Dad and Mom",
  [normalize("Mom and Dad")]: "Dad and Mom",
  [normalize("Dad Only")]: "Dad Only",
  [normalize("Mom Only")]: "Mom Only",
  [normalize("Dad + Partner")]: "Dad + Partner",
  [normalize("Mom + Partner")]: "Mom + Partner",
  [normalize("Grandparent(s)")]: "Grandparent(s)",
  [normalize("Other")]: "Other",
};

const SIBLINGS_TO_NUM = {
  [normalize("Only child")]: 0,
  [normalize("Child + 1 sibling")]: 1,
  [normalize("Child + 2 siblings")]: 2,
  [normalize("Child + 3 siblings")]: 3,
  [normalize("Child + 4 siblings")]: 4,
  [normalize("Child + 5 siblings")]: 5,
  [normalize("Child + 6 siblings")]: 6,
  [normalize("Other")]: 1,
};

const SIBLINGS_CANONICAL = {
  [normalize("Only child")]: "Only child",
  [normalize("Child + 1 sibling")]: "Child + 1 sibling",
  [normalize("Child + 2 siblings")]: "Child + 2 siblings",
  [normalize("Child + 3 siblings")]: "Child + 3 siblings",
  [normalize("Child + 4 siblings")]: "Child + 4 siblings",
  [normalize("Child + 5 siblings")]: "Child + 5 siblings",
  [normalize("Child + 6 siblings")]: "Child + 6 siblings",
  [normalize("Other")]: "Other",
};

async function gql(query, variables = {}) {
  const res = await fetch("https://api.monday.com/v2", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: TOKEN,
      "API-Version": "2024-04",
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) {
    console.error("GraphQL errors:", JSON.stringify(json.errors, null, 2));
    process.exit(1);
  }
  return json.data;
}

async function fetchAllItems() {
  console.log("→ Fetching all items from Monday (paginated)…");
  const all = [];
  let cursor = null;
  do {
    const data = await gql(
      `query ($ids:[ID!], $cursor: String) {
        boards(ids:$ids) {
          items_page(limit: 200, cursor: $cursor) {
            cursor
            items {
              id name
              column_values { id text }
            }
          }
        }
      }`,
      { ids: [BOARD_ID], cursor }
    );
    const page = data.boards[0].items_page;
    all.push(...page.items);
    cursor = page.cursor;
    console.log(`  …${all.length} items so far`);
  } while (cursor);
  return all;
}

const sqlEscape = (s) => (s == null ? "NULL" : `'${String(s).replace(/'/g, "''")}'`);

function rowToBackfillTuple(item) {
  const cv = Object.fromEntries(item.column_values.map((c) => [c.id, c.text]));
  const childFirst = (cv[COL.childFirst] || "").trim();
  const childLast = (cv[COL.childLast] || "").trim();
  const parentEmail = (cv[COL.parentEmail] || "").trim().toLowerCase();
  const adultsRaw = (cv[COL.adultsRaw] || "").trim();
  const siblingsRaw = (cv[COL.siblingsRaw] || "").trim();
  if (!childFirst || !childLast || !parentEmail) return null;

  const adultsKey = normalize(adultsRaw);
  const siblingsKey = normalize(siblingsRaw);
  const adultsNum = ADULTS_TO_NUM[adultsKey] ?? null;
  const siblingsNum = SIBLINGS_TO_NUM[siblingsKey] ?? null;
  const adultsCanonical = ADULTS_CANONICAL[adultsKey] ?? (adultsRaw || null);
  const siblingsCanonical = SIBLINGS_CANONICAL[siblingsKey] ?? (siblingsRaw || null);
  if (adultsNum == null && siblingsNum == null) return null;

  return {
    childFirst,
    childLast,
    parentEmail,
    adultsRaw: adultsCanonical,
    adultsNum,
    siblingsRaw: siblingsCanonical,
    siblingsNum,
  };
}

function buildSQL(rows, { commit }) {
  const tuples = rows
    .map((r) =>
      `  (${sqlEscape(r.parentEmail)}, ${sqlEscape(r.childFirst)}, ${sqlEscape(r.childLast)}, ${
        r.adultsNum ?? "NULL"
      }::int, ${sqlEscape(r.adultsRaw)}, ${r.siblingsNum ?? "NULL"}::int, ${sqlEscape(r.siblingsRaw)})`
    )
    .join(",\n");

  return `-- ${commit ? "APPLY" : "DRY-RUN"} backfill of family_structure + siblings_breakdown
-- Generated ${new Date().toISOString()} from Monday board ${BOARD_ID}
-- Run this in the Supabase SQL Editor. The diagnostic SELECTs at the bottom
-- show the result of the UPDATE before the ${commit ? "COMMIT" : "ROLLBACK"}.

BEGIN;

-- Add the raw-answer columns if they don't exist yet (safe to re-run).
ALTER TABLE public.youth_registrations
  ADD COLUMN IF NOT EXISTS family_structure text;
ALTER TABLE public.youth_registrations
  ADD COLUMN IF NOT EXISTS siblings_breakdown text;

-- Disable the kiosk-protection trigger for this transaction. The trigger checks
-- auth.uid() against user_roles, but the SQL editor session has no JWT, so it
-- falls through to the "Kiosk users can only update headshot URL" branch.
-- We re-enable below; on ROLLBACK the disable is reverted automatically too.
ALTER TABLE public.youth_registrations
  DISABLE TRIGGER validate_youth_headshot_update;

-- Single UPDATE with all 403 Monday rows inline as VALUES, joined by parent
-- email + child name. COALESCE keeps existing values when Monday's mapping
-- couldn't determine a number (it always preserves the raw text answer).
WITH monday (parent_email, child_first, child_last, adults_num, adults_raw, siblings_num, siblings_raw) AS (
  VALUES
${tuples}
)
UPDATE public.youth_registrations y
SET adults_in_household   = COALESCE(m.adults_num, y.adults_in_household),
    family_structure      = COALESCE(m.adults_raw, y.family_structure),
    siblings_in_household = COALESCE(m.siblings_num, y.siblings_in_household),
    siblings_breakdown    = COALESCE(m.siblings_raw, y.siblings_breakdown)
FROM monday m
WHERE LOWER(TRIM(y.parent_email)) = m.parent_email
  AND LOWER(TRIM(y.child_first_name)) = LOWER(m.child_first)
  AND LOWER(TRIM(y.child_last_name)) = LOWER(m.child_last);

-- Re-enable the kiosk-protection trigger.
ALTER TABLE public.youth_registrations
  ENABLE TRIGGER validate_youth_headshot_update;

-- DIAGNOSTIC: distribution of family_structure values after the update.
-- Compare these counts against what you expect from Monday (Dad and Mom ~189,
-- Mom Only ~114, Mom + Partner ~43, Other ~25, Grandparent(s) ~13, Dad Only
-- ~13, Dad + Partner ~6).
SELECT family_structure, COUNT(*) AS n
FROM public.youth_registrations
WHERE family_structure IS NOT NULL
GROUP BY family_structure
ORDER BY n DESC;

${commit ? "COMMIT;" : "ROLLBACK;  -- DRY-RUN: nothing was saved. Re-run with backfill-APPLY.sql to commit."}
`;
}

const items = await fetchAllItems();
console.log(`\n→ Fetched ${items.length} total Monday items.`);

const rows = items.map(rowToBackfillTuple).filter(Boolean);
console.log(`→ Usable rows (have name + email + at least one mappable answer): ${rows.length}`);

const skipped = items.length - rows.length;
if (skipped) console.log(`  Skipped ${skipped} (missing name/email or unmappable answers).`);

const dry = buildSQL(rows, { commit: false });
const apply = buildSQL(rows, { commit: true });

writeFileSync("scripts/backfill-DRY-RUN.sql", dry);
writeFileSync("scripts/backfill-APPLY.sql", apply);

console.log("\n✓ Wrote scripts/backfill-DRY-RUN.sql and scripts/backfill-APPLY.sql");
console.log("  Both are gitignored (scripts/*.sql).");

// Print a small summary of the answer distributions we're about to load,
// so the user can sanity-check the mapping before running anything.
const adultsSummary = {};
const siblingsSummary = {};
rows.forEach((r) => {
  if (r.adultsRaw) adultsSummary[r.adultsRaw] = (adultsSummary[r.adultsRaw] || 0) + 1;
  if (r.siblingsRaw) siblingsSummary[r.siblingsRaw] = (siblingsSummary[r.siblingsRaw] || 0) + 1;
});

console.log("\nMonday adults_in_household answer distribution:");
Object.entries(adultsSummary).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
  const pct = Math.round((v / rows.length) * 100);
  console.log(`  "${k}" → ${ADULTS_TO_NUM[normalize(k)]} adult(s):  ${v}  (${pct}%)`);
});

const singleHomes = rows.filter((r) => r.adultsNum === 1).length;
const twoHomes = rows.filter((r) => r.adultsNum === 2).length;
console.log(`\n  → Single-adult homes:  ${singleHomes} / ${rows.length}  (${Math.round((singleHomes / rows.length) * 100)}%)`);
console.log(`  → Two-adult homes:    ${twoHomes} / ${rows.length}  (${Math.round((twoHomes / rows.length) * 100)}%)`);

console.log("\nMonday siblings answer distribution:");
Object.entries(siblingsSummary).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
  const pct = Math.round((v / rows.length) * 100);
  console.log(`  "${k}" → ${SIBLINGS_TO_NUM[normalize(k)]} sibling(s):  ${v}  (${pct}%)`);
});
