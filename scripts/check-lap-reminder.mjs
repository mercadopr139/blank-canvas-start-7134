// Run from the repo root:  node scripts/check-lap-reminder.mjs
// Checks the lap reminder's grouping and renders the email offline. Sends nothing.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { transformSync } from "esbuild";

let src = fs.readFileSync("supabase/functions/lap-reminder/index.ts", "utf8");
src = src.slice(0, src.indexOf("Deno.serve("));
src = src.replace(/^import .*$/gm, "");
const out = path.resolve("scripts/_lap-reminder.tmp.mjs");
fs.writeFileSync(out, transformSync(src, { loader: "ts", format: "esm" }).code);
const m = await import(pathToFileURL(out).href);
fs.unlinkSync(out);

let fails = 0;
const check = (label, ok) => { console.log((ok ? "PASS " : "FAIL ") + label); if (!ok) fails++; };

const rows = [
  { title: "Confirm the bus", source: "Agenda Meeting", lap_commitment_id: "c1", carry_count: 2, topic: "Transportation" },
  { title: "Confirm the bus", source: "PC:Agenda Meeting", lap_commitment_id: "c1", carry_count: 2, topic: "Transportation" },
  { title: "Post the plan", source: "PC:Agenda Meeting", lap_commitment_id: "c2", carry_count: 0, topic: "Schedule" },
];
const open = m.groupOpen(rows);
check("two owner rows become one line with both names", open.length === 2 && open[0].owners.join("&") === "Josh&Chrissy");
check("the most-carried commitment comes first", open[0].title === "Confirm the bus" && open[0].carry_count === 2);
check("lap day is Monday; recipients are Josh and Chrissy", m.LAP_WEEKDAY === 1 && m.RECIPIENTS.length === 2 && m.RECIPIENTS.every((r) => r.endsWith("@nolimitsboxingacademy.org")));

const mail = m.renderEmail("2026-10-19", open);
check("subject counts what is open", mail.subject === "The Lap is today — 2 commitments to review first");
check("names the day", mail.html.includes("Monday, October 19"));
check("a commitment carried twice is marked in red", mail.html.includes("carried 2 laps"));
check("links to the lap", mail.html.includes("/admin/the-lap") && mail.text.includes("/admin/the-lap"));
const none = m.renderEmail("2026-10-19", []);
check("nothing open → a one-line email", none.subject.includes("nothing open") && none.html.includes("See you at the start line"));
process.exit(fails ? 1 : 0);
