// Run from the repo root:  node scripts/check-moments-email.mjs
// Renders the Weekly Standout Moments reminder offline for every program and
// checks the week rule and the branding. Sends nothing.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { transformSync } from "esbuild";

let src = fs.readFileSync("supabase/functions/program-moments-reminder/index.ts", "utf8");
src = src.slice(0, src.indexOf("Deno.serve("));
src = src.replace(/^import .*$/gm, "");
const out = path.resolve("scripts/_moments-render.tmp.mjs");
fs.writeFileSync(out, transformSync(src, { loader: "ts", format: "esm" }).code);
const m = await import(pathToFileURL(out).href);
fs.unlinkSync(out);

let fails = 0;
const check = (label, ok) => { console.log((ok ? "PASS " : "FAIL ") + label); if (!ok) fails++; };

// Hawk Squad (Tue/Thu, due from Friday).
check("hawk: Friday targets this week", m.targetWeek("2026-10-02", 5) === "2026-09-28");
check("hawk: Sunday targets this week", m.targetWeek("2026-10-04", 5) === "2026-09-28");
check("hawk: Monday still targets last week", m.targetWeek("2026-10-05", 5) === "2026-09-28");
check("hawk: Thursday still targets last week", m.targetWeek("2026-10-08", 5) === "2026-09-28");
check("hawk: next Friday moves on", m.targetWeek("2026-10-09", 5) === "2026-10-05");
// BAM (Friday, due from Monday): always the week that just ended.
check("bam: Monday targets last week", m.targetWeek("2026-10-12", 1) === "2026-10-05");
check("bam: Friday still targets last week", m.targetWeek("2026-10-16", 1) === "2026-10-05");
check("bam: Sunday still targets last week", m.targetWeek("2026-10-18", 1) === "2026-10-05");
check("bam: next Monday moves on", m.targetWeek("2026-10-19", 1) === "2026-10-12");

const hawk = m.PROGRAMS.find((p) => p.key === "hawk");
const bam = m.PROGRAMS.find((p) => p.key === "bam");
const h = m.renderEmail(hawk, "2026-09-28", [{ date: "2026-09-29", count: 14 }, { date: "2026-10-01", count: 12 }]);
check("hawk subject names the program and week", h.subject === "Hawk Squad Weekly Standout Moments — Week of Sep 28");
check("hawk green header", h.html.includes("background-color:#0f4c2f;padding:28px"));
check("hawk wordmark", h.html.includes(">HAWK SQUAD</p>"));
check("hawk button links to the week", h.html.includes("/hawk-squad/intelligence?moments=2026-09-28#moments"));
check("hawk lists both sessions", h.html.includes("Tuesday, September 29") && h.html.includes("Thursday, October 1") && h.html.includes("14 students"));

const b = m.renderEmail(bam, "2026-10-05", [{ date: "2026-10-09", count: 9 }]);
check("bam subject", b.subject === "BAM Weekly Standout Moments — Week of Oct 5");
check("bam gray header", b.html.includes("background-color:#374151;padding:28px"));
check("bam wordmark", b.html.includes(">BAM</p>"));
check("bam button links to the bam page", b.html.includes("/bam/intelligence?moments=2026-10-05#moments"));
check("bam lists its Friday", b.html.includes("Friday, October 9") && b.html.includes("9 students"));
process.exit(fails ? 1 : 0);
