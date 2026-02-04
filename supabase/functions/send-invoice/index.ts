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
    const { invoiceId, invoiceNumber, clientName, billingEmail, month, year, total, pdfBase64 } = body;

    console.log(`Sending invoice ${invoiceNumber} to ${billingEmail}`);

    // Validate required fields
    if (!invoiceId || !invoiceNumber || !billingEmail || !pdfBase64) {
      throw new Error("Missing required fields");
    }

    const monthName = new Date(year, month - 1).toLocaleString("default", { month: "long" });
    const formattedTotal = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(total);

    // Send email with PDF attachment
    const emailResponse = await resend.emails.send({
      from: "No Limits Academy <invoices@nolimitsboxingacademy.org>",
      to: [billingEmail],
      subject: `Invoice ${invoiceNumber} – No Limits Academy`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Invoice ${invoiceNumber}</h2>
          
          <p>Dear ${clientName},</p>
          
          <p>Please find attached your invoice for services rendered during <strong>${monthName} ${year}</strong>.</p>
          
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-size: 18px;"><strong>Amount Due: ${formattedTotal}</strong></p>
            <p style="margin: 10px 0 0 0; color: #666;">Payment Terms: Due within 30 days of invoice date</p>
          </div>
          
          <p>If you have any questions regarding this invoice, please don't hesitate to contact us.</p>
          
          <p>Thank you for your continued support of No Limits Academy.</p>
          
          <p style="margin-top: 30px;">
            Best regards,<br>
            <strong>No Limits Academy</strong>
          </p>
        </div>
      `,
      attachments: [
        {
          filename: `NLA_Invoice_${invoiceNumber}.pdf`,
          content: pdfBase64,
        },
      ],
    });

    console.log("Email sent successfully:", emailResponse);

    // Update invoice with sent info
    const { error: updateError } = await supabase
      .from("invoices")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        sent_to: billingEmail,
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
