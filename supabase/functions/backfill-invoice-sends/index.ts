// One-shot backfill: for every invoice that's been sent at least once
// but has no invoice_sends audit row yet, synthesize one. The email body
// is reconstructed from current invoice fields + the shared template;
// the PDF comes straight from invoices.pdf_base64 (already stored).
// Personal note isn't recoverable from before audit logging, so the
// synthesized row has message=null and is_regenerated=true. The viewer
// modal renders a disclaimer on regenerated rows.
//
// Safe to re-run: invoices with any existing invoice_sends row are
// skipped, so subsequent invocations only process new gaps.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOGO_URL = "https://rkdkmzjontaufbyjbcku.supabase.co/storage/v1/object/public/email-assets/nla-logo.png";

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function buildInvoiceEmailSubject({
  mode,
  invoiceNumber,
  clientName,
  periodLabel,
}: {
  mode: "initial" | "resend";
  invoiceNumber: string;
  clientName: string;
  periodLabel: string;
}): string {
  return mode === "resend"
    ? `Friendly Reminder: Invoice ${invoiceNumber} – ${clientName} – ${periodLabel}`
    : `Invoice ${invoiceNumber} – No Limits Academy`;
}

function renderInvoiceEmailHtml({
  mode,
  invoiceNumber,
  clientName,
  periodLabel,
  total,
  note,
}: {
  mode: "initial" | "resend";
  invoiceNumber: string;
  clientName: string;
  periodLabel: string;
  total: string;
  note?: string | null;
}): string {
  const titleLine = mode === "resend" ? `Reminder: Invoice ${invoiceNumber}` : `Invoice ${invoiceNumber}`;
  const greetingLine = mode === "resend"
    ? `Hi <strong>${escapeHtml(clientName)}</strong> — a friendly reminder that your <strong>${escapeHtml(periodLabel)}</strong> invoice is still outstanding (attached below).`
    : `Hi <strong>${escapeHtml(clientName)}</strong> — your <strong>${escapeHtml(periodLabel)}</strong> invoice is attached below.`;

  const trimmedNote = note?.trim();
  const noteHtml = trimmedNote
    ? `<p style="margin: 0 0 24px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 16px; line-height: 1.7; color: #374151; white-space: pre-wrap;">${escapeHtml(trimmedNote)}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(titleLine)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: Arial, Helvetica, sans-serif; -webkit-text-size-adjust: 100%;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f3f4f6; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="padding: 24px 32px; border-bottom: 1px solid #e5e7eb;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align: middle; padding-right: 14px;" width="56">
                    <img src="${LOGO_URL}" alt="" width="48" style="display: block; width: 48px; height: auto; max-width: 48px; border: 0; outline: none; -ms-interpolation-mode: bicubic;" />
                  </td>
                  <td style="vertical-align: middle;">
                    <p style="margin: 0; font-family: Georgia, 'Times New Roman', serif; font-size: 18px; font-weight: 700; color: #111827; letter-spacing: 0.3px;">No Limits Academy</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 22px 0;">
                <tr>
                  <td style="vertical-align: middle;">
                    <h1 style="margin: 0; font-family: Georgia, 'Times New Roman', serif; font-size: 22px; font-weight: 700; color: #111827;">${escapeHtml(titleLine)}</h1>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <span style="font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #6b7280;">${escapeHtml(periodLabel)}</span>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 20px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 16px; line-height: 1.7; color: #374151;">${greetingLine}</p>
              ${noteHtml}
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 28px 0;">
                <tr>
                  <td style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 24px; text-align: center;">
                    <p style="margin: 0 0 6px 0; font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600;">Amount Due</p>
                    <p style="margin: 0 0 10px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 32px; font-weight: 800; color: #111827;">${escapeHtml(total)}</p>
                    <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #6b7280;">Due within 30 days of invoice date</p>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 12px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 15px; color: #374151;">With Gratitude,</p>
              <p style="margin: 0 0 2px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 16px; font-weight: 700; color: #111827;">Josh Mercado</p>
              <p style="margin: 0 0 2px 0; font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #6b7280;">Program Director, No Limits Academy</p>
              <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #6b7280;">joshmercado@nolimitsboxingacademy.org</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

interface BackfillSummary {
  considered: number;
  inserted: number;
  skipped_existing: number;
  skipped_no_pdf: number;
  errors: { invoice_id: string; error: string }[];
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

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Admin gate (same pattern as send-invoice).
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Optional input: invoice_id — backfill only that one. Used by the
    // viewer modal's lazy auto-regenerate when an operator opens an
    // invoice that's marked Sent but has no audit row yet.
    let onlyInvoiceId: string | null = null;
    try {
      const body = (await req.json()) as { invoice_id?: string };
      if (body?.invoice_id) onlyInvoiceId = body.invoice_id;
    } catch {
      // No body / not JSON — fine, run full backfill.
    }

    // Pull invoices that have been sent or paid. We need pdf_base64 for
    // the synthesized row's attachment; skip rows that don't have one.
    let invoicesQuery: any = supabase
      .from("invoices")
      .select("id, invoice_number, invoice_month, invoice_year, total, pdf_base64, sent_to, sent_at, last_sent_at, vendor_email, client_id, clients(name)")
      .in("status", ["sent", "paid"]);
    if (onlyInvoiceId) {
      invoicesQuery = invoicesQuery.eq("id", onlyInvoiceId);
    }
    const { data: invoices, error: invErr } = await invoicesQuery;

    if (invErr) {
      return new Response(JSON.stringify({ error: invErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const summary: BackfillSummary = {
      considered: invoices?.length ?? 0,
      inserted: 0,
      skipped_existing: 0,
      skipped_no_pdf: 0,
      errors: [],
    };

    for (const inv of (invoices ?? [])) {
      try {
        // Skip if any invoice_sends row already exists for this invoice.
        const { data: existing } = await supabase
          .from("invoice_sends")
          .select("id")
          .eq("invoice_id", inv.id)
          .limit(1);

        if (existing && existing.length > 0) {
          summary.skipped_existing++;
          continue;
        }

        if (!inv.pdf_base64) {
          summary.skipped_no_pdf++;
          continue;
        }

        const clientName: string = (inv.clients as any)?.name || "Partner";
        const monthName = new Date(inv.invoice_year, inv.invoice_month - 1)
          .toLocaleString("default", { month: "long" });
        const periodLabel = `${monthName} ${inv.invoice_year}`;
        const formattedTotal = new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(Number(inv.total ?? 0));

        const subject = buildInvoiceEmailSubject({
          mode: "initial",
          invoiceNumber: inv.invoice_number,
          clientName,
          periodLabel,
        });
        const emailHtml = renderInvoiceEmailHtml({
          mode: "initial",
          invoiceNumber: inv.invoice_number,
          clientName,
          periodLabel,
          total: formattedTotal,
          note: null, // pre-audit personal notes are not recoverable
        });
        const pdfFilename = `NLA_Invoice_${inv.invoice_number}.pdf`;
        const sentAt = inv.last_sent_at || inv.sent_at || new Date().toISOString();
        const sentTo = inv.sent_to || inv.vendor_email || "—";

        const { error: insertErr } = await supabase.from("invoice_sends").insert({
          invoice_id: inv.id,
          sent_to: sentTo,
          subject,
          message: null,
          sent_by_user_id: user.id,
          type: "initial",
          status: "success",
          sent_at: sentAt,
          email_html: emailHtml,
          pdf_base64: inv.pdf_base64,
          pdf_filename: pdfFilename,
          is_regenerated: true,
        });

        if (insertErr) {
          summary.errors.push({ invoice_id: inv.id, error: insertErr.message });
        } else {
          summary.inserted++;
        }
      } catch (e: any) {
        summary.errors.push({ invoice_id: inv.id, error: String(e?.message || e) });
      }
    }

    return new Response(JSON.stringify({ success: true, summary }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("backfill-invoice-sends fatal:", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
