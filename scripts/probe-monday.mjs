// One-off probe: validates the Monday API token, confirms board access,
// and prints the column structure + item count so we can plan the backfill.
// Run with: node --env-file=.env.local scripts/probe-monday.mjs

const TOKEN = process.env.MONDAY_API_TOKEN;
const BOARD_ID = process.env.MONDAY_BOARD_ID;

if (!TOKEN || !BOARD_ID) {
  console.error("Missing MONDAY_API_TOKEN or MONDAY_BOARD_ID in .env");
  process.exit(1);
}

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

console.log("→ Checking who the token belongs to…");
const me = await gql(`query { me { name email account { name } } }`);
console.log(`  Authenticated as: ${me.me.name} <${me.me.email}> (account: ${me.me.account.name})`);

console.log(`\n→ Fetching board ${BOARD_ID} structure…`);
const boardData = await gql(
  `query ($ids:[ID!]) {
    boards(ids:$ids) {
      id
      name
      items_count
      columns { id title type }
    }
  }`,
  { ids: [BOARD_ID] }
);
const board = boardData.boards[0];
if (!board) {
  console.error("Board not found or token has no access. Check the board ID and that the token user is a member.");
  process.exit(1);
}
console.log(`  Board: "${board.name}"  (id ${board.id})`);
console.log(`  Items: ${board.items_count}`);
console.log(`\n  Columns (${board.columns.length}):`);
board.columns.forEach((c) => console.log(`    - ${c.title}  [${c.type}]   id=${c.id}`));

console.log("\n→ Pulling 1 sample item to see field shape…");
const sample = await gql(
  `query ($ids:[ID!]) {
    boards(ids:$ids) {
      items_page(limit: 1) {
        items {
          id name
          column_values { id text value }
        }
      }
    }
  }`,
  { ids: [BOARD_ID] }
);
const item = sample.boards[0].items_page.items[0];
if (item) {
  console.log(`  Sample item: "${item.name}" (id ${item.id})`);
  item.column_values.forEach((cv) => {
    if (cv.text) console.log(`    ${cv.id}: ${JSON.stringify(cv.text).slice(0, 80)}`);
  });
} else {
  console.log("  Board has no items.");
}
