import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

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

// ── PDF generation ──────────────────────────────────────────────────────────

interface DonationRow {
  deposit_date: string;
  reference_id: string | null;
  amount: number;
  notes: string | null;
}

async function generateReceiptPdf(
  donorName: string,
  donations: DonationRow[],
  total: number,
  dateIssued: string
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const PAGE_W = 612; // Letter
  const PAGE_H = 792;
  const MARGIN_L = 60;
  const MARGIN_R = 60;
  const CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R;

  const black = rgb(0, 0, 0);
  const gray = rgb(0.33, 0.33, 0.33);
  const lineGray = rgb(0.78, 0.78, 0.78);
  const headerBg = rgb(0.96, 0.96, 0.96);

  // ── Helper: draw text centred ──
  const drawCentred = (
    page: ReturnType<typeof pdf.addPage>,
    text: string,
    y: number,
    f: typeof font,
    size: number,
    color = black
  ) => {
    const w = f.widthOfTextAtSize(text, size);
    page.drawText(text, { x: (PAGE_W - w) / 2, y, font: f, size, color });
  };

  // ── Helper: draw the header block (reused on continuation pages) ──
  const drawHeader = (page: ReturnType<typeof pdf.addPage>): number => {
    let y = PAGE_H - 60;

    drawCentred(page, ORG_NAME, y, fontBold, 18);
    y -= 16;
    drawCentred(page, ORG_ADDRESS, y, font, 10, gray);
    y -= 13;
    drawCentred(page, ORG_PHONE, y, font, 10, gray);
    y -= 13;
    drawCentred(page, `EIN: ${ORG_EIN}`, y, font, 10, gray);
    y -= 20;

    // Horizontal rule
    page.drawLine({ start: { x: MARGIN_L, y }, end: { x: PAGE_W - MARGIN_R, y }, thickness: 1.5, color: black });
    y -= 24;

    drawCentred(page, "2026 Annual Donation Receipt", y, fontBold, 15);
    y -= 28;

    return y;
  };

  // ── Table column layout ──
  const COL_DATE_X = MARGIN_L;
  const COL_REF_X = MARGIN_L + 90;
  const COL_AMT_X = MARGIN_L + 300;
  const COL_NOTES_X = MARGIN_L + 390;
  const ROW_H = 18;

  const drawTableHeader = (page: ReturnType<typeof pdf.addPage>, y: number): number => {
    // Header background
    page.drawRectangle({ x: MARGIN_L, y: y - 3, width: CONTENT_W, height: ROW_H, color: headerBg });
    const headerY = y;
    page.drawText("Date", { x: COL_DATE_X + 4, y: headerY, font: fontBold, size: 9, color: black });
    page.drawText("Check # / Transaction ID", { x: COL_REF_X + 4, y: headerY, font: fontBold, size: 9, color: black });
    page.drawText("Amount", { x: COL_AMT_X + 4, y: headerY, font: fontBold, size: 9, color: black });
    page.drawText("Notes", { x: COL_NOTES_X + 4, y: headerY, font: fontBold, size: 9, color: black });
    return y - ROW_H - 2;
  };

  // ── Build pages ──
  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = drawHeader(page);

  // Date issued & donor name
  page.drawText(`Date Issued: ${dateIssued}`, { x: MARGIN_L, y, font: font, size: 10, color: black });
  y -= 16;
  page.drawText(`Donor Name: ${donorName}`, { x: MARGIN_L, y, font: font, size: 10, color: black });
  y -= 24;

  // Dear line
  page.drawText(`Dear ${donorName},`, { x: MARGIN_L, y, font: font, size: 10, color: black });
  y -= 16;

  const thankYouText = `Thank you for your generous support of ${ORG_NAME} during the 2026 calendar year. Below is a summary of your contributions for your tax records.`;
  // Wrap thank-you text
  const maxLineW = CONTENT_W;
  const words = thankYouText.split(" ");
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(test, 10) > maxLineW) {
      page.drawText(line, { x: MARGIN_L, y, font, size: 10, color: black });
      y -= 14;
      line = word;
    } else {
      line = test;
    }
  }
  if (line) {
    page.drawText(line, { x: MARGIN_L, y, font, size: 10, color: black });
    y -= 14;
  }
  y -= 10;

  // Donation Summary heading
  page.drawText("Donation Summary", { x: MARGIN_L, y, font: fontBold, size: 12, color: black });
  y -= 20;

  // Table header
  y = drawTableHeader(page, y);

  // Rows
  for (const d of donations) {
    if (y < 100) {
      // New page
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = drawHeader(page);
      page.drawText("Donation Summary (continued)", { x: MARGIN_L, y, font: fontBold, size: 12, color: black });
      y -= 20;
      y = drawTableHeader(page, y);
    }

    page.drawText(formatDate(d.deposit_date), { x: COL_DATE_X + 4, y, font, size: 9, color: black });
    page.drawText(d.reference_id || "—", { x: COL_REF_X + 4, y, font, size: 9, color: black });

    const amtStr = formatCurrency(d.amount);
    page.drawText(amtStr, { x: COL_AMT_X + 4, y, font, size: 9, color: black });

    const noteStr = (d.notes || "").substring(0, 30);
    page.drawText(noteStr, { x: COL_NOTES_X + 4, y, font, size: 9, color: black });

    // Row border
    page.drawLine({ start: { x: MARGIN_L, y: y - 4 }, end: { x: PAGE_W - MARGIN_R, y: y - 4 }, thickness: 0.5, color: lineGray });
    y -= ROW_H;
  }

  // Total row
  if (y < 100) {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    y = drawHeader(page);
  }
  page.drawRectangle({ x: MARGIN_L, y: y - 3, width: CONTENT_W, height: ROW_H, color: headerBg });
  page.drawText("TOTAL", { x: COL_DATE_X + 4, y, font: fontBold, size: 9, color: black });
  page.drawText(formatCurrency(total), { x: COL_AMT_X + 4, y, font: fontBold, size: 9, color: black });
  y -= ROW_H + 16;

  // Disclaimer
  const disclaimerLines = [
    "No goods or services were provided in exchange for these contributions unless otherwise noted above.",
    `${ORG_NAME} is a 501(c)(3) tax-exempt organization. Our EIN is ${ORG_EIN}.`,
    "Please retain this receipt for your tax records.",
  ];
  for (const dl of disclaimerLines) {
    if (y < 60) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - 60;
    }
    page.drawText(dl, { x: MARGIN_L, y, font, size: 8, color: gray });
    y -= 12;
  }

  y -= 12;
  if (y < 60) {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - 60;
  }
  page.drawText("With gratitude,", { x: MARGIN_L, y, font, size: 10, color: black });
  y -= 14;
  page.drawText(ORG_NAME, { x: MARGIN_L, y, font, size: 10, color: black });

  return await pdf.save();
}

// ── Edge function handler ───────────────────────────────────────────────────

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

    // Generate PDF
    const pdfBytes = await generateReceiptPdf(supporter.name, qualifying, total, dateIssued);
    const pdfBase64 = btoa(String.fromCharCode(...pdfBytes));
    const pdfFilename = `2026-Donation-Receipt-${supporter.name.replace(/\s+/g, "-")}.pdf`;

    // Try to send email
    if (!resendApiKey) {
      await supabase
        .from("supporters")
        .update({ receipt_2026_status: "Failed" })
        .eq("id", supporter_id);

      return new Response(
        JSON.stringify({
          error: "Email service not configured",
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

    // Send via Resend with PDF attachment
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
            filename: pdfFilename,
            content: pdfBase64,
            type: "application/pdf",
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
