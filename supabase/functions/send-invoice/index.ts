import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SendInvoiceRequest {
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  billingEmail: string;
  month: number;
  year: number;
  total: number;
  pdfBase64: string;
  emailNote?: string | null;
  isResend?: boolean;
  resendTo?: string;
}

const LOGO_URL = "https://qnjpurehimuqppyrfxui.supabase.co/storage/v1/object/public/email-assets/nla-logo.png";

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
  const titleLine = mode === "resend"
    ? `Reminder: Invoice ${invoiceNumber}`
    : `Invoice ${invoiceNumber}`;

  const greeting = mode === "resend"
    ? `<p style="margin: 0 0 16px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 16px; line-height: 1.7; color: #374151;">Hi <strong>${clientName}</strong>,</p>
       <p style="margin: 0 0 20px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 16px; line-height: 1.7; color: #374151;">Just a friendly reminder — we have an outstanding invoice for services during <strong>${periodLabel}</strong>. Details are below and the full invoice is attached.</p>`
    : `<p style="margin: 0 0 16px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 16px; line-height: 1.7; color: #374151;">Hi <strong>${clientName}</strong>,</p>
       <p style="margin: 0 0 20px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 16px; line-height: 1.7; color: #374151;">Thank you for your continued partnership! Please find attached your invoice for services rendered during <strong>${periodLabel}</strong>.</p>`;

  const trimmedNote = note?.trim();
  const noteHtml = trimmedNote
    ? `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 28px 0;">
        <tr>
          <td style="background-color: #fef9ef; border-left: 4px solid #d97706; border-radius: 6px; padding: 16px 20px;">
            <p style="margin: 0 0 4px 0; font-family: Arial, Helvetica, sans-serif; font-size: 11px; font-weight: 700; color: #92400e; text-transform: uppercase; letter-spacing: 1px;">Note from Josh</p>
            <p style="margin: 0; font-family: Georgia, 'Times New Roman', serif; font-size: 15px; line-height: 1.6; color: #78350f; white-space: pre-wrap;">${trimmedNote.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
          </td>
        </tr>
      </table>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${titleLine}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: Arial, Helvetica, sans-serif; -webkit-text-size-adjust: 100%;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f3f4f6; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="padding: 36px 32px 28px 32px; text-align: center; background: linear-gradient(180deg, #ffffff 0%, #f9fafb 100%);">
              <img src="${LOGO_URL}" alt="No Limits Academy" style="height: 80px; width: auto; display: inline-block;" />
              <p style="margin: 14px 0 0 0; font-family: Georgia, 'Times New Roman', serif; font-size: 20px; font-weight: 700; color: #111827; letter-spacing: 0.3px;">No Limits Academy</p>
              <p style="margin: 4px 0 0 0; font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #9ca3af; letter-spacing: 0.5px;">Empowering Youth Through Boxing &amp; Mentorship</p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 32px;">
              <hr style="border: none; border-top: 2px solid #111827; margin: 0;" />
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px 32px 16px 32px;">
              <!-- Title -->
              <h1 style="margin: 0 0 20px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 24px; font-weight: 700; color: #111827;">${titleLine}</h1>

              <!-- Greeting -->
              ${greeting}

              <!-- Optional Note -->
              ${noteHtml}

              <!-- Amount Due Card -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 28px 0;">
                <tr>
                  <td style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 28px; text-align: center;">
                    <p style="margin: 0 0 8px 0; font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600;">Amount Due</p>
                    <p style="margin: 0 0 16px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 36px; font-weight: 800; color: #111827;">${total}</p>
                    <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #6b7280;">Payment Terms: Due within 30 days of invoice date</p>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 4px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 15px; line-height: 1.7; color: #374151;">The full invoice is attached as a PDF for your records.</p>
            </td>
          </tr>

          <!-- Signature -->
          <tr>
            <td style="padding: 0 32px 32px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-top: 20px; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0 0 4px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 15px; color: #374151;">With gratitude,</p>
                    <p style="margin: 0 0 2px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 16px; font-weight: 700; color: #111827;">Josh Mercado</p>
                    <p style="margin: 0 0 2px 0; font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #6b7280;">Program Director, No Limits Academy</p>
                    <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #6b7280;">joshmercado@nolimitsboxingacademy.org</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; border-top: 1px solid #e5e7eb; background-color: #fafafa; border-radius: 0 0 12px 12px; text-align: center;">
              <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #9ca3af;">Questions? Simply reply to this email and we'll be happy to help.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError || !roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const body: SendInvoiceRequest = await req.json();
    const {
      invoiceId, invoiceNumber, clientName, billingEmail,
      month, year, total, pdfBase64, emailNote,
      isResend, resendTo,
    } = body;

    if (!invoiceId || !invoiceNumber || !pdfBase64) {
      throw new Error("Missing required fields");
    }

    const recipientEmail = isResend && resendTo ? resendTo : billingEmail;
    if (!recipientEmail) throw new Error("No recipient email");

    const sendType = isResend ? "resend" : "initial";
    console.log(`Sending invoice ${invoiceNumber} (${sendType}) to ${recipientEmail}`);

    const monthName = new Date(year, month - 1).toLocaleString("default", { month: "long" });
    const periodLabel = `${monthName} ${year}`;
    const formattedTotal = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(total);

    // Build subject
    const emailSubject = isResend
      ? `Friendly Reminder: Invoice ${invoiceNumber} – ${clientName} – ${periodLabel}`
      : `Invoice ${invoiceNumber} – No Limits Academy`;

    // Build branded HTML
    const html = renderInvoiceEmailHtml({
      mode: sendType,
      invoiceNumber,
      clientName,
      periodLabel,
      total: formattedTotal,
      note: emailNote,
    });

    const emailResponse = await resend.emails.send({
      from: "No Limits Academy <joshmercado@nolimitsboxingacademy.org>",
      to: [recipientEmail],
      subject: emailSubject,
      html,
      attachments: [
        {
          filename: `NLA_Invoice_${invoiceNumber}.pdf`,
          content: pdfBase64,
        },
      ],
    });

    if (emailResponse.error) {
      console.error("Resend API error:", emailResponse.error);

      await supabase.from("invoice_sends").insert({
        invoice_id: invoiceId,
        sent_to: recipientEmail,
        subject: emailSubject,
        message: emailNote || null,
        sent_by_user_id: user.id,
        type: sendType,
        status: "failed",
        error: emailResponse.error.message,
      });

      throw new Error(`Email sending failed: ${emailResponse.error.message}`);
    }

    console.log("Email sent successfully, ID:", emailResponse.data?.id);

    // Log successful send
    await supabase.from("invoice_sends").insert({
      invoice_id: invoiceId,
      sent_to: recipientEmail,
      subject: emailSubject,
      message: emailNote || null,
      sent_by_user_id: user.id,
      type: sendType,
      status: "success",
    });

    // Update invoice tracking
    const updateFields: Record<string, any> = {
      last_sent_at: new Date().toISOString(),
      vendor_email: recipientEmail,
    };

    if (!isResend) {
      updateFields.status = "sent";
      updateFields.sent_at = new Date().toISOString();
      updateFields.sent_to = recipientEmail;
      updateFields.email_note = emailNote || null;
      updateFields.send_count = 1;
    }

    if (isResend) {
      const { data: currentInv } = await supabase
        .from("invoices")
        .select("send_count")
        .eq("id", invoiceId)
        .single();
      
      updateFields.send_count = ((currentInv as any)?.send_count || 0) + 1;
    }

    const { error: updateError } = await supabase
      .from("invoices")
      .update(updateFields)
      .eq("id", invoiceId);

    if (updateError) {
      console.error("Error updating invoice:", updateError);
    }

    return new Response(
      JSON.stringify({ success: true, emailId: emailResponse.data?.id }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-invoice function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

Deno.serve(handler);
