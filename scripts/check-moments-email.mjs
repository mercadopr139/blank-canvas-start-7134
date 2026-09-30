// Run from the repo root:  node scripts/check-moments-email.mjs
// Renders the Weekly Standout Moments reminder offline and checks the week
// rule and the branding. Sends nothing.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { transformSync } from "esbuild";

let src = fs.readFileSync("supabase/functions/hawk-squad-moments-reminder/index.ts", "utf8");
src = src.slice(0, src.indexOf("Deno.serve("));
src = src.replace(/^import .*$/gm, "");
const out = path.resolve("scripts/_moments-render.tmp.mjs");
fs.writeFileSync(out, transformSync(src, { loader: "ts", format: "esm" }).code);
const m = await import(pathToFileURL(out).href);
fs.unlinkSync(out);

let fails = 0;
const check = (label, ok) => { console.log((ok ? "PASS " : "FAIL ") + label); if (!ok) fails++; };

// Week rule: Fri–Sun → this week's Monday; Mon–Thu → last week's Monday.
check("Friday targets this week", m.targetWeek("2026-10-02") === "2026-09-28");
check("Sunday targets this week", m.targetWeek("2026-10-04") === "2026-09-28");
check("Monday still targets last week", m.targetWeek("2026-10-05") === "2026-09-28");
check("Thursday still targets last week", m.targetWeek("2026-10-08") === "2026-09-28");
check("next Friday moves on", m.targetWeek("2026-10-09") === "2026-10-05");

const mail = m.renderEmail("2026-09-28", [{ date: "2026-09-29", count: 14 }, { date: "2026-10-01", count: 12 }]);
fs.writeFileSync(path.resolve("scripts/_moments-email.tmp.html"), mail.html);
check("subject names the week", mail.subject === "Weekly Standout Moments — Week of Sep 28");
check("green header", mail.html.includes("background-color:#0f4c2f;padding:28px"));
check("HAWK SQUAD wordmark", mail.html.includes(">HAWK SQUAD</p>"));
check("gold rule", mail.html.includes("background-color:#f2c230;"));
check("button links to the week", mail.html.includes("/hawk-squad/intelligence?moments=2026-09-28#moments"));
check("lists both sessions", mail.html.includes("Tuesday, September 29") && mail.html.includes("Thursday, October 1") && mail.html.includes("14 students"));
check("plain-text fallback has the link", mail.text.includes("?moments=2026-09-28"));
fs.unlinkSync(path.resolve("scripts/_moments-email.tmp.html"));
process.exit(fails ? 1 : 0);
