// Run from the repo root:  node scripts/check-aftercare-reminder.mjs
// Checks the "what is missing" rule and renders the reminder offline for
// both labs. Sends nothing.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { transformSync } from "esbuild";

let src = fs.readFileSync("supabase/functions/aftercare-report-reminder/index.ts", "utf8");
src = src.slice(0, src.indexOf("Deno.serve("));
src = src.replace(/^import .*$/gm, "");
const out = path.resolve("scripts/_aftercare-render.tmp.mjs");
fs.writeFileSync(out, transformSync(src, { loader: "ts", format: "esm" }).code);
const m = await import(pathToFileURL(out).href);
fs.unlinkSync(out);

let fails = 0;
const check = (label, ok) => { console.log((ok ? "PASS " : "FAIL ") + label); if (!ok) fails++; };

// The rule.
const empty = null;
const smileDone = { session_date: "2026-10-06", caring_note: "Brushing twice a day", sharing_note: null, highlights: ["Smile Lab — Emma brushed for the full two minutes"] };
const lifeDone = { session_date: "2026-10-06", caring_note: null, sharing_note: "Kindness", highlights: ["Life Lab — Marcellus helped a friend"] };
const noteOnly = { session_date: "2026-10-06", caring_note: "Flossing", sharing_note: "Gratitude", highlights: [] };
const momentsOnly = { session_date: "2026-10-06", caring_note: "", sharing_note: "", highlights: ["Smile Lab — a win", "Life Lab — a win"] };
check("nothing written → both pieces missing for both labs", m.missingFor("smile", empty).length === 2 && m.missingFor("life", empty).length === 2);
check("Smile Lab done → nothing missing for Jaime", m.missingFor("smile", smileDone).length === 0);
check("Smile Lab done → Chrissy still owes both", m.missingFor("life", smileDone).length === 2);
check("Life Lab done → nothing missing for Chrissy", m.missingFor("life", lifeDone).length === 0);
check("note only → only moments missing", m.missingFor("smile", noteOnly).join() === "standout moments" && m.missingFor("life", noteOnly).join() === "standout moments");
check("moments only → only the note missing", m.missingFor("smile", momentsOnly).join() === "what we covered" && m.missingFor("life", momentsOnly).join() === "what we covered");
check("a blank moment does not count", m.missingFor("smile", { ...noteOnly, highlights: ["Smile Lab —   "] }).join() === "standout moments");

// The email.
const one = m.renderEmail("smile", [{ date: "2026-10-06", missing: ["what we covered", "standout moments"], students: 12 }]);
check("subject names the date", one.subject === "Submit your Smile Lab report for Tuesday, October 6");
check("addressed to Jaime", one.html.includes("Hi Jaime"));
check("says what is missing", one.html.includes("what we covered and standout moments"));
check("button opens the journal on that date", one.html.includes("/smile-lab-attendance?journal=2026-10-06"));
check("Smile Lab teal header", one.html.includes("background-color:#0d9488;padding:26px"));
const two = m.renderEmail("life", [
  { date: "2026-09-29", missing: ["standout moments"], students: 10 },
  { date: "2026-10-06", missing: ["what we covered", "standout moments"], students: 12 },
]);
check("two dates → one email listing both", two.subject === "Submit your Life Lab reports — 2 Tuesdays open" && two.html.includes("September 29") && two.html.includes("October 6"));
check("addressed to Chrissy", two.html.includes("Hi Chrissy"));
check("recipients", m.LABS.smile.to === "jaime@nolimitsboxingacademy.org" && m.LABS.life.to === "chrissycasiello@nolimitsboxingacademy.org");
process.exit(fails ? 1 : 0);
