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
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the JWT token and check admin role
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check admin role
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError || !roleData) {
      console.error("Role check failed:", roleError);
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const body: SendInvoiceRequest = await req.json();
    const { invoiceId, invoiceNumber, clientName, billingEmail, month, year, total, pdfBase64, emailNote } = body;

    console.log(`Sending invoice ${invoiceNumber} to ${billingEmail}`, emailNote ? "(with note)" : "");

    // Validate required fields
    if (!invoiceId || !invoiceNumber || !billingEmail || !pdfBase64) {
      throw new Error("Missing required fields");
    }

    const monthName = new Date(year, month - 1).toLocaleString("default", { month: "long" });
    const formattedTotal = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(total);

    // Format the optional note with line breaks preserved
    const noteHtml = emailNote 
      ? `
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 24px 0;">
          <tr>
            <td style="background-color: #f0f7ff; border: 1px solid #d0e3f7; border-left: 4px solid #3b82f6; border-radius: 8px; padding: 16px;">
              <p style="margin: 0; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1e3a5f; white-space: pre-wrap;">${emailNote.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
            </td>
          </tr>
        </table>`
      : '';

    // Send email with PDF attachment
    const emailResponse = await resend.emails.send({
      from: "No Limits Academy <joshmercado@nolimitsboxingacademy.org>",
      to: [billingEmail],
      subject: `Invoice ${invoiceNumber} – No Limits Academy`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f5f5; padding: 32px 16px;">
    <tr>
      <td align="left">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border: 1px solid #e5e5e5; border-radius: 8px;">
          
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px 32px; border-bottom: 1px solid #e5e5e5;">
              <h1 style="margin: 0; font-family: Arial, sans-serif; font-size: 24px; font-weight: bold; color: #111827;">No Limits Academy</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              
              <!-- Invoice Title -->
              <h2 style="margin: 0 0 24px 0; font-family: Arial, sans-serif; font-size: 20px; font-weight: 600; color: #374151;">Invoice ${invoiceNumber}</h2>
              
              <!-- Note Box (if exists) -->
              ${noteHtml}
              
              <!-- Amount Card -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 24px 0;">
                <tr>
                  <td style="background-color: #f9fafb; border: 1px solid #e5e5e5; border-radius: 8px; padding: 24px;">
                    <p style="margin: 0 0 8px 0; font-family: Arial, sans-serif; font-size: 14px; color: #6b7280;">Amount Due</p>
                    <p style="margin: 0 0 16px 0; font-family: Arial, sans-serif; font-size: 28px; font-weight: bold; color: #111827;">${formattedTotal}</p>
                    <p style="margin: 0; font-family: Arial, sans-serif; font-size: 14px; color: #6b7280;">Payment Terms: Due within 30 days of invoice date</p>
                  </td>
                </tr>
              </table>
              
              <!-- Service Period -->
              <p style="margin: 0 0 24px 0; font-family: Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #374151;">Please find attached your invoice for services rendered during <strong>${monthName} ${year}</strong>.</p>
              
            </td>
          </tr>
          
          <!-- Footer -->
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
</html>
      `,
      attachments: [
        {
          filename: `NLA_Invoice_${invoiceNumber}.pdf`,
          content: pdfBase64,
        },
      ],
    });

    console.log("Resend API response:", emailResponse);

    // Check if there was an error from Resend
    if (emailResponse.error) {
      console.error("Resend API error:", emailResponse.error);
      throw new Error(`Email sending failed: ${emailResponse.error.message}`);
    }

    console.log("Email sent successfully, ID:", emailResponse.data?.id);

    // Update invoice with sent info and note
    const { error: updateError } = await supabase
      .from("invoices")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        sent_to: billingEmail,
        email_note: emailNote || null,
      })
      .eq("id", invoiceId);

    if (updateError) {
      console.error("Error updating invoice:", updateError);
      // Still return success since email was sent
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
