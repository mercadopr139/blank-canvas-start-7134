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
  // Resend fields
  isResend?: boolean;
  resendSubject?: string;
  resendMessage?: string;
  resendTo?: string;
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
      isResend, resendSubject, resendMessage, resendTo,
    } = body;

    if (!invoiceId || !invoiceNumber || !pdfBase64) {
      throw new Error("Missing required fields");
    }

    const recipientEmail = isResend && resendTo ? resendTo : billingEmail;
    if (!recipientEmail) throw new Error("No recipient email");

    const sendType = isResend ? "resend" : "initial";
    console.log(`Sending invoice ${invoiceNumber} (${sendType}) to ${recipientEmail}`);

    const monthName = new Date(year, month - 1).toLocaleString("default", { month: "long" });
    const formattedTotal = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(total);

    // Build subject
    const emailSubject = isResend && resendSubject
      ? resendSubject
      : `Invoice ${invoiceNumber} – No Limits Academy`;

    // Build HTML body
    const noteOrMessage = isResend && resendMessage ? resendMessage : emailNote;
    const noteHtml = noteOrMessage
      ? `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 24px 0;">
          <tr>
            <td style="background-color: #f0f7ff; border: 1px solid #d0e3f7; border-left: 4px solid #3b82f6; border-radius: 8px; padding: 16px;">
              <p style="margin: 0; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1e3a5f; white-space: pre-wrap;">${noteOrMessage.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
            </td>
          </tr>
        </table>`
      : '';

    const emailResponse = await resend.emails.send({
      from: "No Limits Academy <joshmercado@nolimitsboxingacademy.org>",
      to: [recipientEmail],
      subject: emailSubject,
      html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f5f5; padding: 32px 16px;">
    <tr>
      <td align="left">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border: 1px solid #e5e5e5; border-radius: 8px;">
          <tr>
            <td style="padding: 32px 32px 24px 32px; border-bottom: 1px solid #e5e5e5;">
              <h1 style="margin: 0; font-family: Arial, sans-serif; font-size: 24px; font-weight: bold; color: #111827;">No Limits Academy</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <h2 style="margin: 0 0 24px 0; font-family: Arial, sans-serif; font-size: 20px; font-weight: 600; color: #374151;">${isResend ? 'Reminder: ' : ''}Invoice ${invoiceNumber}</h2>
              ${noteHtml}
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 24px 0;">
                <tr>
                  <td style="background-color: #f9fafb; border: 1px solid #e5e5e5; border-radius: 8px; padding: 24px;">
                    <p style="margin: 0 0 8px 0; font-family: Arial, sans-serif; font-size: 14px; color: #6b7280;">Amount Due</p>
                    <p style="margin: 0 0 16px 0; font-family: Arial, sans-serif; font-size: 28px; font-weight: bold; color: #111827;">${formattedTotal}</p>
                    <p style="margin: 0; font-family: Arial, sans-serif; font-size: 14px; color: #6b7280;">Payment Terms: Due within 30 days of invoice date</p>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 24px 0; font-family: Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #374151;">Please find attached your invoice for services rendered during <strong>${monthName} ${year}</strong>.</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px; border-top: 1px solid #e5e5e5; background-color: #fafafa;">
              <p style="margin: 0; font-family: Arial, sans-serif; font-size: 14px; color: #6b7280;">If you have questions, reply to this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
      attachments: [
        {
          filename: `NLA_Invoice_${invoiceNumber}.pdf`,
          content: pdfBase64,
        },
      ],
    });

    if (emailResponse.error) {
      console.error("Resend API error:", emailResponse.error);

      // Log failed send
      await supabase.from("invoice_sends").insert({
        invoice_id: invoiceId,
        sent_to: recipientEmail,
        subject: emailSubject,
        message: noteOrMessage || null,
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
      message: noteOrMessage || null,
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
      // Initial send
      updateFields.status = "sent";
      updateFields.sent_at = new Date().toISOString();
      updateFields.sent_to = recipientEmail;
      updateFields.email_note = emailNote || null;
      updateFields.send_count = 1;
    }

    // For resend, increment send_count via raw update
    if (isResend) {
      // First get current count
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
