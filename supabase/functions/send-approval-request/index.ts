import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SendApprovalRequest {
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  month: number;
  year: number;
  total: number;
  approvalToken: string;
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

    // Verify JWT and admin role
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const body: SendApprovalRequest = await req.json();
    const { invoiceId, invoiceNumber, clientName, month, year, total, approvalToken } = body;

    if (!invoiceId || !invoiceNumber || !approvalToken) {
      throw new Error("Missing required fields");
    }

    const monthName = new Date(year, month - 1).toLocaleString("default", { month: "long" });
    const formattedTotal = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(total);

    // Build approval page URL
    const approvalPageUrl = `https://blank-canvas-start-7134.lovable.app/approvals/invoice/${approvalToken}`;

    console.log(`Sending approval request for ${invoiceNumber} to chrissycasiello@nolimitsboxingacademy.org`);

    const emailResponse = await resend.emails.send({
      from: "No Limits Academy <joshmercado@nolimitsboxingacademy.org>",
      to: ["chrissycasiello@nolimitsboxingacademy.org"],
      subject: `Invoice Approval Needed: ${invoiceNumber} – ${clientName} – ${monthName} ${year}`,
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
              <h1 style="margin: 0; font-family: Arial, sans-serif; font-size: 24px; font-weight: bold; color: #111827;">Invoice Approval Required</h1>
              <p style="margin: 8px 0 0; font-family: Arial, sans-serif; font-size: 14px; color: #6b7280;">No Limits Academy</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 24px 0; font-family: Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #374151;">
                An invoice is ready for your review and approval before being sent to the vendor.
              </p>

              <!-- Invoice Summary Card -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 24px 0;">
                <tr>
                  <td style="background-color: #f9fafb; border: 1px solid #e5e5e5; border-radius: 8px; padding: 24px;">
                    <p style="margin: 0 0 8px 0; font-family: Arial, sans-serif; font-size: 13px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Invoice Details</p>
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding: 6px 0; font-family: Arial, sans-serif; font-size: 14px; color: #6b7280;">Invoice #</td>
                        <td style="padding: 6px 0; font-family: Arial, sans-serif; font-size: 14px; color: #111827; font-weight: 600; text-align: right;">${invoiceNumber}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-family: Arial, sans-serif; font-size: 14px; color: #6b7280;">Client</td>
                        <td style="padding: 6px 0; font-family: Arial, sans-serif; font-size: 14px; color: #111827; font-weight: 600; text-align: right;">${clientName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-family: Arial, sans-serif; font-size: 14px; color: #6b7280;">Period</td>
                        <td style="padding: 6px 0; font-family: Arial, sans-serif; font-size: 14px; color: #111827; font-weight: 600; text-align: right;">${monthName} ${year}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-family: Arial, sans-serif; font-size: 14px; color: #6b7280;">Amount</td>
                        <td style="padding: 6px 0; font-family: Arial, sans-serif; font-size: 24px; color: #111827; font-weight: bold; text-align: right;">${formattedTotal}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Action Buttons -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 16px 0;">
                <tr>
                  <td align="center" style="padding: 0 0 12px 0;">
                    <a href="${approvalPageUrl}" style="display: inline-block; padding: 14px 32px; background-color: #111827; color: #ffffff; font-family: Arial, sans-serif; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 8px;">
                      Review &amp; Approve Invoice
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; font-family: Arial, sans-serif; font-size: 13px; color: #9ca3af; text-align: center;">
                Click the button above to review the invoice details, then approve or reject.
              </p>
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
    });

    if (emailResponse.error) {
      console.error("Resend API error:", emailResponse.error);
      throw new Error(`Email sending failed: ${emailResponse.error.message}`);
    }

    console.log("Approval email sent successfully, ID:", emailResponse.data?.id);

    return new Response(
      JSON.stringify({ success: true, emailId: emailResponse.data?.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-approval-request:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

Deno.serve(handler);
