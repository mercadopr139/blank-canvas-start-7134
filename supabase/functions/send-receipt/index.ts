import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ReceiptRequest {
  supporter_id: string;
  personal_message?: string;
}

const ORG_NAME = "No Limits Academy";
const ORG_ADDRESS = "3614 Pacific Ave, Wildwood, NJ 08260";
const ORG_PHONE = "(609) 408-8108";
const ORG_EIN = "85-2891498";
const SENDER_EMAIL = "alexandravalerio@nolimitsboxingacademy.org";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
}

function generateReceiptHtml(
  supporter: { name: string },
  donations: Array<{ deposit_date: string; reference_id: string | null; amount: number; notes: string | null }>,
  total: number,
  dateIssued: string
): string {
  const rows = donations
    .map(
      (d) =>
        `<tr>
          <td style="padding:6px 12px;border:1px solid #ddd;">${formatDate(d.deposit_date)}</td>
          <td style="padding:6px 12px;border:1px solid #ddd;">${d.reference_id || "—"}</td>
          <td style="padding:6px 12px;border:1px solid #ddd;text-align:right;">${formatCurrency(d.amount)}</td>
          <td style="padding:6px 12px;border:1px solid #ddd;">${d.notes || ""}</td>
        </tr>`
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>2026 Donation Receipt</title></head>
<body style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:40px 20px;color:#222;">
  <h1 style="text-align:center;font-size:22px;margin-bottom:4px;">${ORG_NAME}</h1>
  <p style="text-align:center;margin:0;font-size:13px;color:#555;">${ORG_ADDRESS}</p>
  <p style="text-align:center;margin:0 0 4px;font-size:13px;color:#555;">${ORG_PHONE}</p>
  <p style="text-align:center;margin:0 0 20px;font-size:13px;color:#555;">EIN: ${ORG_EIN}</p>
  
  <hr style="border:none;border-top:2px solid #222;margin:20px 0;" />
  
  <h2 style="text-align:center;font-size:18px;margin-bottom:20px;">2026 Annual Donation Receipt</h2>
  
  <p><strong>Date Issued:</strong> ${dateIssued}</p>
  <p><strong>Donor Name:</strong> ${supporter.name}</p>
  
  <p style="margin-top:20px;">Dear ${supporter.name},</p>
  <p>Thank you for your generous support of ${ORG_NAME} during the 2026 calendar year. Below is a summary of your contributions for your tax records.</p>
  
  <h3 style="margin-top:24px;margin-bottom:8px;">Donation Summary</h3>
  <table style="width:100%;border-collapse:collapse;font-size:14px;">
    <thead>
      <tr style="background:#f5f5f5;">
        <th style="padding:8px 12px;border:1px solid #ddd;text-align:left;">Date</th>
        <th style="padding:8px 12px;border:1px solid #ddd;text-align:left;">Check # / Transaction ID</th>
        <th style="padding:8px 12px;border:1px solid #ddd;text-align:right;">Amount</th>
        <th style="padding:8px 12px;border:1px solid #ddd;text-align:left;">Notes</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
    <tfoot>
      <tr style="font-weight:bold;background:#f9f9f9;">
        <td colspan="2" style="padding:8px 12px;border:1px solid #ddd;">TOTAL</td>
        <td style="padding:8px 12px;border:1px solid #ddd;text-align:right;">${formatCurrency(total)}</td>
        <td style="padding:8px 12px;border:1px solid #ddd;"></td>
      </tr>
    </tfoot>
  </table>
  
  <p style="margin-top:24px;font-size:13px;color:#555;">
    No goods or services were provided in exchange for these contributions unless otherwise noted above.
    ${ORG_NAME} is a 501(c)(3) tax-exempt organization. Our EIN is ${ORG_EIN}.
    Please retain this receipt for your tax records.
  </p>
  
  <p style="margin-top:24px;">With gratitude,<br/>${ORG_NAME}</p>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { supporter_id, personal_message } = (await req.json()) as ReceiptRequest;

    // Get supporter
    const { data: supporter, error: suppErr } = await supabase
      .from("supporters")
      .select("*")
      .eq("id", supporter_id)
      .single();

    if (suppErr || !supporter) {
      return new Response(JSON.stringify({ error: "Supporter not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!supporter.email) {
      return new Response(
        JSON.stringify({ error: "Email required", needs_email: true }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get qualifying donations for 2026
    const { data: donations, error: donErr } = await supabase
      .from("donations")
      .select("deposit_date, reference_id, amount, notes, revenue_type, revenue_description")
      .eq("supporter_id", supporter_id)
      .gte("deposit_date", "2026-01-01")
      .lte("deposit_date", "2026-12-31")
      .order("deposit_date", { ascending: true });

    if (donErr) {
      return new Response(JSON.stringify({ error: donErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter to qualifying types
    const qualifying = (donations || []).filter(
      (d: any) =>
        d.revenue_type === "Donation" ||
        (d.revenue_type === "Fundraising" && d.revenue_description === "Sponsor")
    );

    if (qualifying.length === 0) {
      return new Response(
        JSON.stringify({ error: "No qualifying donations in 2026" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const total = qualifying.reduce((sum: number, d: any) => sum + Number(d.amount), 0);
    const dateIssued = new Date().toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    });

    const receiptHtml = generateReceiptHtml(supporter, qualifying, total, dateIssued);

    // Try to send email
    if (!resendApiKey) {
      // Update status to Failed
      await supabase
        .from("supporters")
        .update({ receipt_2026_status: "Failed" })
        .eq("id", supporter_id);

      return new Response(
        JSON.stringify({
          error: "Email service not configured",
          receipt_html: receiptHtml,
          can_download: true,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build email body
    let emailBody = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">`;
    if (personal_message) {
      emailBody += `<div style="background:#f0f7ff;border-radius:8px;padding:16px;margin-bottom:20px;">
        <p style="margin:0;color:#333;">${personal_message.replace(/\n/g, "<br/>")}</p>
      </div>`;
    }
    emailBody += `<p>Please find your 2026 annual donation receipt attached.</p>
      <p>Thank you for your generous support of ${ORG_NAME}!</p>
      <p style="color:#888;font-size:12px;margin-top:24px;">You may reply directly to this email with any questions.</p>
    </div>`;

    // Send via Resend with HTML receipt as attachment
    // Using Resend's attachment feature with HTML content
    const receiptBase64 = btoa(unescape(encodeURIComponent(receiptHtml)));

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `No Limits Academy <${SENDER_EMAIL}>`,
        to: [supporter.email],
        subject: "No Limits Academy — 2026 Donation Receipt",
        html: emailBody,
        attachments: [
          {
            filename: `2026-Donation-Receipt-${supporter.name.replace(/\s+/g, "-")}.html`,
            content: receiptBase64,
            type: "text/html",
          },
        ],
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.error("Resend error:", errText);

      await supabase
        .from("supporters")
        .update({ receipt_2026_status: "Failed" })
        .eq("id", supporter_id);

      return new Response(
        JSON.stringify({
          error: "Failed to send email",
          details: errText,
          receipt_html: receiptHtml,
          can_download: true,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update supporter record
    await supabase
      .from("supporters")
      .update({
        receipt_2026_status: "Sent",
        receipt_2026_sent_at: new Date().toISOString(),
        receipt_2026_last_sent_to: supporter.email,
      })
      .eq("id", supporter_id);

    return new Response(
      JSON.stringify({ success: true, sent_to: supporter.email }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Receipt error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
