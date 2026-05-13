// One-shot backfill: for every supporter who has a "Sent" status on their
// 2026 receipt but no receipt_sends audit row yet, regenerate the PDF +
// email HTML from current data and insert an audit row tagged
// is_regenerated = true. No outbound email is sent.
//
// Safe to re-run: existing rows for a given (supporter_id, receipt_year)
// are skipped, so subsequent invocations only process supporters that
// don't already have an audit row.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  generateReceiptPdf,
  buildReceiptEmailHtml,
  buildReceiptEmailText,
  RECEIPT_SUBJECT,
  RECEIPT_PDF_FILENAME_PREFIX,
} from "../_shared/receiptContent.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface BackfillSummary {
  considered: number;
  inserted: number;
  skipped_existing: number;
  skipped_no_qualifying_donations: number;
  errors: { supporter_id: string; error: string }[];
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

    // Admin gate (same pattern as send-receipt).
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

    // Optional inputs:
    //   year         — calendar year to backfill, defaults to 2026
    //   supporter_id — if set, only regenerate for this one supporter
    //                  (used by the viewer modal's lazy auto-regenerate)
    let receiptYear = 2026;
    let onlySupporterId: string | null = null;
    try {
      const body = (await req.json()) as { year?: number; supporter_id?: string };
      if (body?.year && Number.isInteger(body.year)) receiptYear = body.year;
      if (body?.supporter_id) onlySupporterId = body.supporter_id;
    } catch {
      // No body / not JSON — fine, use defaults.
    }

    const yearStart = `${receiptYear}-01-01`;
    const yearEnd = `${receiptYear}-12-31`;
    const issuedAt = new Date().toISOString();
    const issuedDateStr = new Date().toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    });
    const logoUrl = `${supabaseUrl}/storage/v1/object/public/email-assets/nla-logo.png`;

    // Best-effort logo fetch — same pattern as send-receipt.
    let logoBytes: Uint8Array | undefined;
    try {
      const logoRes = await fetch(logoUrl);
      if (logoRes.ok) logoBytes = new Uint8Array(await logoRes.arrayBuffer());
    } catch (e) {
      console.error("Logo fetch failed:", e);
    }

    // Build the supporter query. Two modes:
    //   - Bulk: every supporter marked Sent on either the legacy column
    //     or the new generic column (one-shot from the admin UI).
    //   - Single: a specific supporter (auto-regenerate from the modal
    //     when the user clicks View on someone who has no audit rows yet).
    let supportersQuery: any = supabase
      .from("supporters")
      .select("id, name, email, receipt_2026_status, latest_receipt_status, latest_receipt_year, latest_receipt_sent_at, latest_receipt_sent_to");
    if (onlySupporterId) {
      supportersQuery = supportersQuery.eq("id", onlySupporterId);
    } else {
      supportersQuery = supportersQuery.or("receipt_2026_status.eq.Sent,latest_receipt_status.eq.Sent");
    }
    const { data: supporters, error: suppErr } = await supportersQuery;

    if (suppErr) {
      return new Response(JSON.stringify({ error: suppErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const summary: BackfillSummary = {
      considered: supporters?.length ?? 0,
      inserted: 0,
      skipped_existing: 0,
      skipped_no_qualifying_donations: 0,
      errors: [],
    };

    for (const supporter of (supporters ?? [])) {
      try {
        // Skip if there's already a receipt_sends row for this
        // supporter + receipt_year. Idempotent re-runs are the goal.
        const { data: existingSend } = await supabase
          .from("receipt_sends")
          .select("id")
          .eq("supporter_id", supporter.id)
          .eq("receipt_year", receiptYear)
          .limit(1);

        if (existingSend && existingSend.length > 0) {
          summary.skipped_existing++;
          continue;
        }

        // Pull qualifying donations for the receipt year (same filter as
        // the live send path: Donation rows, plus Fundraising/Sponsor rows).
        const { data: donations } = await supabase
          .from("donations")
          .select("deposit_date, reference_id, amount, revenue_type, revenue_description, donor_name")
          .eq("supporter_id", supporter.id)
          .gte("deposit_date", yearStart)
          .lte("deposit_date", yearEnd)
          .order("deposit_date", { ascending: true });

        const qualifying = (donations ?? []).filter(
          (d: any) =>
            d.revenue_type === "Donation" ||
            (d.revenue_type === "Fundraising" && d.revenue_description === "Sponsor"),
        );

        if (qualifying.length === 0) {
          summary.skipped_no_qualifying_donations++;
          continue;
        }

        const total = qualifying.reduce((sum: number, d: any) => sum + Number(d.amount), 0);
        const receiptName: string =
          qualifying.map((d: any) => d.donor_name?.trim()).find((n: string) => n && n !== "N/A") ||
          supporter.name?.trim() ||
          "Supporter";

        const pdfBytes = await generateReceiptPdf(receiptName, qualifying, total, issuedDateStr, logoBytes);
        const pdfBase64 = btoa(String.fromCharCode(...pdfBytes));
        const pdfFilename = `${RECEIPT_PDF_FILENAME_PREFIX}${receiptName.replace(/\s+/g, "-")}.pdf`;
        const emailHtml = buildReceiptEmailHtml(receiptName, null, logoUrl);
        const emailText = buildReceiptEmailText(receiptName, null);

        // sent_at uses the recorded send timestamp if we have one, otherwise
        // falls back to now. sent_to uses the recorded recipient if known.
        const sentAt =
          (supporter as any).latest_receipt_sent_at || issuedAt;
        const sentTo =
          (supporter as any).latest_receipt_sent_to || supporter.email;

        const { error: insertErr } = await supabase.from("receipt_sends").insert({
          supporter_id: supporter.id,
          receipt_year: receiptYear,
          status: "Sent",
          sent_at: sentAt,
          sent_to: sentTo,
          subject: RECEIPT_SUBJECT,
          email_html: emailHtml,
          email_text: emailText,
          pdf_base64: pdfBase64,
          pdf_filename: pdfFilename,
          personal_message: null, // never stored on the original send
          is_regenerated: true,
        });

        if (insertErr) {
          summary.errors.push({ supporter_id: supporter.id, error: insertErr.message });
        } else {
          summary.inserted++;
        }
      } catch (e: any) {
        summary.errors.push({ supporter_id: supporter.id, error: String(e?.message || e) });
      }
    }

    return new Response(JSON.stringify({ success: true, summary }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("backfill-receipt-sends fatal:", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
