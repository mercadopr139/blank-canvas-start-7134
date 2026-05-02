// Helpers for substituting personalization tokens in bulk-outreach message
// templates. Keeps the substitution logic in one place so the email composer,
// preview, and send flow all behave identically.

export interface OutreachSupporter {
  name: string;
  greeting_name: string | null;
}

// Best-effort extraction of a first name from the supporters.name field.
// Handles common patterns:
//   "Mike & Lauren Provenzano"  -> "Mike"
//   "Conn & Debbie McMullan"    -> "Conn"
//   "Edward C Leszczynski Jr"   -> "Edward"
//   "Crest Savings Bank"        -> "Crest Savings Bank" (no obvious first name)
//   "Dr. Robert \"Bob\" Previti" -> "Robert" (skips short titles like Dr./Mr.)
function extractFirstName(name: string): string {
  const beforeSeparator = name.split(/[&,/]/)[0].trim();
  const words = beforeSeparator.split(/\s+/).filter(Boolean);
  if (words.length === 0) return name;
  // Skip titles/honorifics like "Dr.", "Mr.", "Mrs." and grab the next word.
  const TITLES = new Set(["dr", "dr.", "mr", "mr.", "mrs", "mrs.", "ms", "ms.", "mx", "mx.", "rev", "rev."]);
  let firstWord = words[0];
  if (TITLES.has(firstWord.toLowerCase()) && words.length > 1) {
    firstWord = words[1];
  }
  // If "first name" is just an initial (e.g. "C" in "Edward C Leszczynski"),
  // it's not the right thing to greet someone with — fall back to the longer
  // beforeSeparator string.
  return firstWord.length >= 2 ? firstWord : beforeSeparator;
}

export function applyTokens(template: string, supporter: OutreachSupporter): string {
  const firstName = extractFirstName(supporter.name);
  const greeting = supporter.greeting_name?.trim() || supporter.name;
  return template
    .replaceAll("{{name}}", supporter.name)
    .replaceAll("{{greeting_name}}", greeting)
    .replaceAll("{{first_name}}", firstName);
}

// All available token keys, exposed so the UI can render an insert-token
// toolbar without hard-coding the list in two places.
export const OUTREACH_TOKENS: { token: string; label: string; description: string }[] = [
  { token: "{{first_name}}", label: "First name", description: "Best-effort first name parsed from the formal name" },
  { token: "{{greeting_name}}", label: "Greeting name", description: "Friendly short label (e.g. \"Mike & Lauren\"); falls back to the formal name if blank" },
  { token: "{{name}}", label: "Full name", description: "The formal name field exactly as stored" },
];

// ── Sender profiles ─────────────────────────────────────────────────────────
// Drives the From "Name <email>" header and the personal signature block.
// Add a new entry here when a new staff sender is enabled in the dropdown.
export interface SenderProfile {
  email: string;
  displayName: string;
  role?: string;
}

export const SENDER_PROFILES: SenderProfile[] = [
  { email: "joshmercado@nolimitsboxingacademy.org", displayName: "Josh Mercado", role: "Program Director" },
  { email: "info@nolimitsboxingacademy.org", displayName: "No Limits Academy" },
  { email: "alexandravalerio@nolimitsboxingacademy.org", displayName: "Alexandra Valerio" },
  { email: "chrissycasiello@nolimitsboxingacademy.org", displayName: "Chrissy Casiello" },
];

export function getSenderProfile(email: string): SenderProfile {
  return SENDER_PROFILES.find((p) => p.email === email) ?? { email, displayName: email };
}

// ── Email HTML builder ──────────────────────────────────────────────────────
// Single source of truth for the HTML the supporter actually receives. Used
// by both the send flow and the in-app preview so the iframe shows exactly
// what Gmail will render.
const ORG_WEBSITE_URL = "https://www.nolimitsboxingacademy.org";
const ORG_INSTAGRAM_URL = "https://www.instagram.com/nolimitsboxingacademy/";
const ORG_FACEBOOK_URL = "https://www.facebook.com/nolimitsboxingacademy/";

export function buildOutreachEmailHtml(opts: { body: string; fromAddress: string }): string {
  const sender = getSenderProfile(opts.fromAddress);
  const paragraphs = opts.body
    .split("\n")
    .map((p) => `<p style="margin:0 0 14px;">${p || "&nbsp;"}</p>`)
    .join("");

  const roleLine = sender.role
    ? `<div style="color:#444;">${sender.role}</div>`
    : "";

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;font-size:15px;line-height:1.55;">
<div style="max-width:600px;margin:0 auto;padding:24px;">
${paragraphs}
<div style="margin-top:28px;">
  <div style="font-weight:600;">${sender.displayName}</div>
  ${roleLine}
  <div style="color:#444;margin-bottom:10px;">No Limits Academy Inc.</div>
  <div style="margin-bottom:6px;">
    <a href="${ORG_WEBSITE_URL}" style="color:#bf0f3e;text-decoration:none;">www.nolimitsboxingacademy.org</a>
  </div>
  <div style="font-size:13px;color:#666;">
    <a href="${ORG_INSTAGRAM_URL}" style="color:#666;text-decoration:none;">Instagram: @nolimitsboxingacademy</a>
    &nbsp;·&nbsp;
    <a href="${ORG_FACEBOOK_URL}" style="color:#666;text-decoration:none;">Facebook: @nolimitsboxingacademy</a>
  </div>
</div>
</div>
</body></html>`;
}
