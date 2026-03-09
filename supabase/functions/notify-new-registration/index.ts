import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOGO_URL = "https://qnjpurehimuqppyrfxui.supabase.co/storage/v1/object/public/email-assets/nla-logo.png";
const ADMIN_EMAIL = "joshmercado@nolimitsboxingacademy.org";
const DASHBOARD_URL = "https://blank-canvas-start-7134.lovable.app/admin/operations/registrations";

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
  if (url.startsWith("youth-photos/")) {
    return `${supabaseUrl}/storage/v1/object/public/youth-photos/${url}`;
  }
  return `${supabaseUrl}/storage/v1/object/public/registration-signatures/${url}`;
}

function renderEmailHtml(reg: RegistrationData): string {
  const childName = `${reg.child_first_name} ${reg.child_last_name}`;
  const parentName = `${reg.parent_first_name} ${reg.parent_last_name}`;
  const age = calculateAge(reg.child_date_of_birth);

  const resolvedHeadshot = resolveHeadshotUrl(reg.child_headshot_url);
  const headshotBlock = resolvedHeadshot
    ? `<tr><td style="padding:0 0 24px 0;text-align:center;">
        <img src="${resolvedHeadshot}" alt="${childName}" style="width:120px;height:120px;border-radius:50%;object-fit:cover;border:3px solid #e5e7eb;" />
       </td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        
        <!-- Header -->
        <tr><td style="background-color:#111111;padding:28px 32px;text-align:center;">
          <img src="${LOGO_URL}" alt="NLA" style="height:44px;margin-bottom:8px;" />
          <p style="color:#9ca3af;font-size:11px;margin:0;font-style:italic;">Through boxing, we develop children personally, professionally, &amp; spiritually.</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px;">
          <h1 style="color:#111;font-size:22px;margin:0 0 8px 0;">New Registration Submitted</h1>
          <p style="color:#6b7280;font-size:14px;margin:0 0 24px 0;">A new youth registration is awaiting your review and approval.</p>

          ${headshotBlock}

          <!-- Details Card -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
            <tr><td style="padding:20px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:6px 0;color:#6b7280;font-size:13px;width:140px;">Child Name</td>
                  <td style="padding:6px 0;color:#111;font-size:14px;font-weight:600;">${childName}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#6b7280;font-size:13px;">Age</td>
                  <td style="padding:6px 0;color:#111;font-size:14px;font-weight:600;">${age} years old</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#6b7280;font-size:13px;">Program</td>
                  <td style="padding:6px 0;color:#111;font-size:14px;font-weight:600;">${reg.child_boxing_program}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#6b7280;font-size:13px;">District</td>
                  <td style="padding:6px 0;color:#111;font-size:14px;font-weight:600;">${reg.child_school_district}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#6b7280;font-size:13px;">Parent</td>
                  <td style="padding:6px 0;color:#111;font-size:14px;font-weight:600;">${parentName}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#6b7280;font-size:13px;">Parent Phone</td>
                  <td style="padding:6px 0;color:#111;font-size:14px;font-weight:600;">${reg.parent_phone}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#6b7280;font-size:13px;">Parent Email</td>
                  <td style="padding:6px 0;color:#111;font-size:14px;font-weight:600;">${reg.parent_email}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#6b7280;font-size:13px;">Submitted</td>
                  <td style="padding:6px 0;color:#111;font-size:14px;font-weight:600;">${reg.submission_date}</td>
                </tr>
              </table>
            </td></tr>
          </table>

          <!-- CTA Button -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:28px 0 0 0;text-align:center;">
              <a href="${DASHBOARD_URL}" style="display:inline-block;background-color:#111;color:#ffffff;font-size:14px;font-weight:600;padding:14px 32px;border-radius:8px;text-decoration:none;">
                Review Registration →
              </a>
            </td></tr>
          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 32px;background-color:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">
          <p style="color:#9ca3af;font-size:11px;margin:0;">No Limits Academy · Cape May County, NJ</p>
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
    const registration: RegistrationData = await req.json();

    const childName = `${registration.child_first_name} ${registration.child_last_name}`;

    const { error } = await resend.emails.send({
      from: "NLA Notifications <joshmercado@nolimitsboxingacademy.org>",
      to: [ADMIN_EMAIL],
      subject: `New Youth Registration – ${childName}`,
      html: renderEmailHtml(registration),
      text: `New youth registration submitted.\n\nChild: ${childName}\nProgram: ${registration.child_boxing_program}\nDistrict: ${registration.child_school_district}\nParent: ${registration.parent_first_name} ${registration.parent_last_name}\nPhone: ${registration.parent_phone}\nEmail: ${registration.parent_email}\nSubmitted: ${registration.submission_date}\n\nReview at: ${DASHBOARD_URL}`,
    });

    if (error) {
      console.error("Resend error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
