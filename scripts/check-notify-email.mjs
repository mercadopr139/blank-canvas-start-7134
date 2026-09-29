// Run from the repo root:  node scripts/check-notify-email.mjs
// Renders both variants of the new-registration email offline and checks them. Sends nothing.
// Render the notification email for a Hawk Squad and an NLA registration without sending anything.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { transformSync } from "esbuild";

const S = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
let src = fs.readFileSync("supabase/functions/notify-new-registration/index.ts", "utf8");
src = src.slice(0, src.indexOf("Deno.serve("));
src = src.replace(/^import .*$/gm, "").replace('const resend = new Resend(Deno.env.get("RESEND_API_KEY"));', "");
src = src.replace(/Deno\.env\.get\([^)]*\)/g, '"https://x.supabase.co"');
src += "\nexport { renderEmailHtml, themeFor };\n";
const js = transformSync(src, { loader: "ts", format: "esm" }).code;
const out = path.join(S, "_notify-render.tmp.mjs");
fs.writeFileSync(out, js);
const m = await import(pathToFileURL(out).href);

const base = { child_first_name: "Luka", child_last_name: "Mercado", child_date_of_birth: "2018-01-01", parent_first_name: "Josh", parent_last_name: "Mercado", parent_phone: "+16090000000", parent_email: "x@y.com", submission_date: "2026-09-29", child_headshot_url: null };
const hawk = { ...base, child_boxing_program: "Hawk Squad", child_school_district: "Cape May Tech" };
const nla = { ...base, child_boxing_program: "Junior Boxers", child_school_district: "Lower Township" };
const h = m.renderEmailHtml(hawk), n = m.renderEmailHtml(nla);
fs.writeFileSync(path.join(S, "_hawk-email.tmp.html"), h);

let fails = 0;
const check = (label, ok) => { console.log((ok ? "PASS " : "FAIL ") + label); if (!ok) fails++; };
check("hawk header is green", h.includes("background-color:#15803d;padding:32px"));
check("hawk banner HAWK SQUAD in white", h.includes('font-family:Arial,Helvetica,sans-serif;">HAWK SQUAD</p>') && h.includes("color:#ffffff;font-size:26px;font-weight:800"));
check("hawk heading", h.includes("New Hawk Squad Registration</h1>"));
check("hawk button goes to hawk list", h.includes('href="https://www.nolimitsboxingacademy.org/admin/operations/hawk-squad/registrations"'));
check("hawk subject", m.themeFor(hawk, "Luka Mercado").subject === "New Hawk Squad Registration – Luka Mercado");
check("nla header still black", n.includes("background-color:#111111;padding:32px"));
check("nla has no banner", !n.includes("HAWK SQUAD"));
check("nla button unchanged", n.includes('href="https://www.nolimitsboxingacademy.org/admin/operations/registrations"'));
check("nla subject unchanged", m.themeFor(nla, "Luka Mercado").subject === "New Youth Registration – Luka Mercado");
process.exit(fails ? 1 : 0);
