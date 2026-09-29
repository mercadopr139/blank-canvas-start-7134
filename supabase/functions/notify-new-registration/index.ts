import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOGO_URL = "https://rkdkmzjontaufbyjbcku.supabase.co/storage/v1/object/public/email-assets/nla-logo.png";
const PRIMARY_EMAIL = "chrissycasiello@nolimitsboxingacademy.org";
const CC_EMAIL = "joshmercado@nolimitsboxingacademy.org";
const DASHBOARD_URL = "https://www.nolimitsboxingacademy.org/admin/operations/registrations";
const HAWK_DASHBOARD_URL = "https://www.nolimitsboxingacademy.org/admin/operations/hawk-squad/registrations";

// Hawk Squad registrations arrive through the same function (the Hawk form
// sends child_boxing_program = "Hawk Squad"). They get their own look -- a
// green header that says HAWK SQUAD in white -- so Josh and Chrissy can tell
// at a glance which programme a registration is for, and the button goes to
// the Hawk Squad list rather than NLA's.
const isHawkSquad = (reg: RegistrationData) => (reg.child_boxing_program || "").trim().toLowerCase() === "hawk squad";

interface Theme {
  headerBg: string; headerText: string; banner: string | null; heading: string; intro: string;
  button: string; buttonBg: string; url: string; footer: string; subject: string;
}
const themeFor = (reg: RegistrationData, childName: string): Theme =>
  isHawkSquad(reg)
    ? {
        headerBg: "#15803d", headerText: "#dcfce7", banner: "HAWK SQUAD",
        heading: "New Hawk Squad Registration",
        intro: "A new Hawk Squad student is awaiting your review and approval.",
        button: "Review Hawk Squad Registration →", buttonBg: "#15803d", url: HAWK_DASHBOARD_URL,
        footer: "Hawk Squad · No Limits Academy × Cape May Tech",
        subject: `New Hawk Squad Registration – ${childName}`,
      }
    : {
        headerBg: "#111111", headerText: "#9ca3af", banner: null,
        heading: "New Registration",
        intro: "A new youth registration is awaiting your review and approval.",
        button: "Review Registration →", buttonBg: "#111", url: DASHBOARD_URL,
        footer: "No Limits Academy · Cape May County, NJ",
        subject: theme.subject,
      };

interface RegistrationData {
  child_first_name: string;
  child_last_name: string;
  child_date_of_birth: string;
  child_boxing_program: string;
  child_school_district: string;
  parent_first_name: string;
  parent_last_name: string;
  parent_phone: string;
  parent_email: string;
  submission_date: string;
  child_headshot_url?: string | null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function calculateAge(dob: string): number {
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

function resolveHeadshotUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const cleanPath = url.replace(/^youth-photos\//, "");
  return `${supabaseUrl}/storage/v1/object/public/youth-photos/${cleanPath}`;
}

function renderEmailHtml(reg: RegistrationData): string {
  const childName = escapeHtml(`${reg.child_first_name} ${reg.child_last_name}`);
  const parentName = escapeHtml(`${reg.parent_first_name} ${reg.parent_last_name}`);
  const age = calculateAge(reg.child_date_of_birth);
  const program = escapeHtml(reg.child_boxing_program);
  const district = escapeHtml(reg.child_school_district);
  const phone = escapeHtml(reg.parent_phone);
  const email = escapeHtml(reg.parent_email);
  const submissionDate = escapeHtml(reg.submission_date);
  const t = themeFor(reg, `${reg.child_first_name} ${reg.child_last_name}`);
  const bannerBlock = t.banner
    ? `<p style="color:#ffffff;font-size:26px;font-weight:800;letter-spacing:4px;margin:0 0 8px 0;font-family:Arial,Helvetica,sans-serif;">${t.banner}</p>`
    : "";

  const resolvedHeadshot = resolveHeadshotUrl(reg.child_headshot_url);
  const headshotBlock = resolvedHeadshot
    ? `<tr><td style="padding:0 0 24px 0;text-align:center;">
        <img src="${escapeHtml(resolvedHeadshot)}" alt="${childName}" style="width:120px;height:120px;border-radius:50%;object-fit:cover;border:3px solid #e5e7eb;" />
       </td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.06);">
        
        <!-- Header -->
        <tr><td style="background-color:${t.headerBg};padding:32px 32px 28px 32px;text-align:center;">
          <img src="${LOGO_URL}" alt="NLA" style="height:56px;margin-bottom:10px;" />
          ${bannerBlock}
          <p style="color:${t.headerText};font-size:12px;margin:0;font-style:italic;letter-spacing:0.3px;">Through boxing, we develop children personally, professionally, &amp; spiritually.</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:36px 36px 28px 36px;">
          <h1 style="color:#111;font-size:24px;margin:0 0 6px 0;font-weight:700;">${t.heading}</h1>
          <p style="color:#6b7280;font-size:14px;margin:0 0 28px 0;line-height:1.5;">${t.intro}</p>

          ${headshotBlock}

          <!-- Details Card -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fafafa;border-radius:12px;border:1px solid #eee;">
            <tr><td style="padding:24px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:8px 0;color:#9ca3af;font-size:12px;width:120px;text-transform:uppercase;letter-spacing:0.5px;vertical-align:top;">Child</td>
                  <td style="padding:8px 0;color:#111;font-size:15px;font-weight:600;">${childName}</td>
                </tr>
                <tr><td colspan="2" style="border-bottom:1px solid #f0f0f0;"></td></tr>
                <tr>
                  <td style="padding:8px 0;color:#9ca3af;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;vertical-align:top;">Age</td>
                  <td style="padding:8px 0;color:#111;font-size:15px;font-weight:600;">${age} years old</td>
                </tr>
                <tr><td colspan="2" style="border-bottom:1px solid #f0f0f0;"></td></tr>
                <tr>
                  <td style="padding:8px 0;color:#9ca3af;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;vertical-align:top;">Program</td>
                  <td style="padding:8px 0;color:#111;font-size:15px;font-weight:600;">${program}</td>
                </tr>
                <tr><td colspan="2" style="border-bottom:1px solid #f0f0f0;"></td></tr>
                <tr>
                  <td style="padding:8px 0;color:#9ca3af;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;vertical-align:top;">District</td>
                  <td style="padding:8px 0;color:#111;font-size:15px;font-weight:600;">${district}</td>
                </tr>
                <tr><td colspan="2" style="border-bottom:1px solid #f0f0f0;"></td></tr>
                <tr>
                  <td style="padding:8px 0;color:#9ca3af;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;vertical-align:top;">Parent</td>
                  <td style="padding:8px 0;color:#111;font-size:15px;font-weight:600;">${parentName}</td>
                </tr>
                <tr><td colspan="2" style="border-bottom:1px solid #f0f0f0;"></td></tr>
                <tr>
                  <td style="padding:8px 0;color:#9ca3af;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;vertical-align:top;">Phone</td>
                  <td style="padding:8px 0;color:#111;font-size:15px;font-weight:600;">${phone}</td>
                </tr>
                <tr><td colspan="2" style="border-bottom:1px solid #f0f0f0;"></td></tr>
                <tr>
                  <td style="padding:8px 0;color:#9ca3af;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;vertical-align:top;">Email</td>
                  <td style="padding:8px 0;color:#111;font-size:15px;font-weight:600;"><a href="mailto:${email}" style="color:#111;text-decoration:underline;">${email}</a></td>
                </tr>
                <tr><td colspan="2" style="border-bottom:1px solid #f0f0f0;"></td></tr>
                <tr>
                  <td style="padding:8px 0;color:#9ca3af;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;vertical-align:top;">Submitted</td>
                  <td style="padding:8px 0;color:#111;font-size:15px;font-weight:600;">${submissionDate}</td>
                </tr>
              </table>
            </td></tr>
          </table>

          <!-- CTA Button -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:32px 0 0 0;text-align:center;">
              <a href="${t.url}" style="display:inline-block;background-color:${t.buttonBg};color:#ffffff;font-size:14px;font-weight:600;padding:14px 36px;border-radius:10px;text-decoration:none;letter-spacing:0.3px;">
                ${t.button}
              </a>
            </td></tr>
          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:24px 36px;background-color:#fafafa;border-top:1px solid #eee;text-align:center;">
          <p style="color:#b0b0b0;font-size:11px;margin:0;letter-spacing:0.2px;">${t.footer}</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify the request comes from our application by validating the apikey header
    const apiKey = req.headers.get("apikey");
    const expectedKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!apiKey || apiKey !== expectedKey) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const registration: RegistrationData = await req.json();

    // Basic input validation
    if (!registration.child_first_name || !registration.child_last_name || !registration.parent_email) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const childName = `${registration.child_first_name} ${registration.child_last_name}`;
    const theme = themeFor(registration, childName);

    const { error } = await resend.emails.send({
      from: "NLA Notifications <joshmercado@nolimitsboxingacademy.org>",
      to: [PRIMARY_EMAIL],
      cc: [CC_EMAIL],
      subject: `New Youth Registration – ${childName}`,
      html: renderEmailHtml(registration),
      text: `${theme.heading} submitted.\n\nChild: ${childName}\nProgram: ${registration.child_boxing_program}\nDistrict: ${registration.child_school_district}\nParent: ${registration.parent_first_name} ${registration.parent_last_name}\nPhone: ${registration.parent_phone}\nEmail: ${registration.parent_email}\nSubmitted: ${registration.submission_date}\n\nReview at: ${theme.url}`,
    });

    if (error) {
      console.error("Resend error:", error);
      return new Response(JSON.stringify({ error: "Failed to send notification" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
