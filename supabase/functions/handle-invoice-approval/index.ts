import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (req.method === "GET") {
      // Fetch approval details by token
      const url = new URL(req.url);
      const token = url.searchParams.get("token");

      if (!token) {
        return new Response(JSON.stringify({ error: "Token required" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const { data: approval, error } = await supabase
        .from("invoice_approvals")
        .select("*")
        .eq("token", token)
        .maybeSingle();

      if (error || !approval) {
        return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // Fetch the invoice details
      const { data: invoice } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", approval.invoice_id)
        .single();

      // Fetch client details
      let clientName = "Unknown";
      let serviceLogs: any[] = [];
      if (invoice) {
        const { data: client } = await supabase
          .from("clients")
          .select("client_name, billing_email")
          .eq("id", invoice.client_id)
          .single();
        if (client) clientName = client.client_name;

        // Fetch service logs for this invoice's client/month/year
        const startDate = `${invoice.invoice_year}-${String(invoice.invoice_month).padStart(2, '0')}-01`;
        const endDate = invoice.invoice_month === 12
          ? `${invoice.invoice_year + 1}-01-01`
          : `${invoice.invoice_year}-${String(invoice.invoice_month + 1).padStart(2, '0')}-01`;

        const { data: logs } = await supabase
          .from("service_logs")
          .select("service_date, service_type, hours, flat_amount, line_total, billing_method, notes")
          .eq("client_id", invoice.client_id)
          .gte("service_date", startDate)
          .lt("service_date", endDate)
          .order("service_date", { ascending: true });

        serviceLogs = logs || [];
      }

      return new Response(
        JSON.stringify({
          approval,
          invoice,
          clientName,
          serviceLogs,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (req.method === "POST") {
      const { token, action, notes } = await req.json();

      if (!token || !action || !["approve", "reject"].includes(action)) {
        return new Response(JSON.stringify({ error: "Invalid request" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // Find the approval
      const { data: approval, error: fetchError } = await supabase
        .from("invoice_approvals")
        .select("*")
        .eq("token", token)
        .maybeSingle();

      if (fetchError || !approval) {
        return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      if (approval.status !== "pending") {
        return new Response(
          JSON.stringify({ error: "This approval has already been responded to", status: approval.status }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const newStatus = action === "approve" ? "approved" : "rejected";
      const now = new Date().toISOString();

      // Update approval record
      const { error: updateApprovalError } = await supabase
        .from("invoice_approvals")
        .update({
          status: newStatus,
          responded_at: now,
          notes: notes || null,
        })
        .eq("id", approval.id);

      if (updateApprovalError) {
        throw new Error(`Failed to update approval: ${updateApprovalError.message}`);
      }

      // Update invoice
      const invoiceUpdate: Record<string, any> = {
        approval_status: newStatus,
        approval_notes: notes || null,
      };

      if (action === "approve") {
        invoiceUpdate.approved_by = approval.approver_email;
        invoiceUpdate.approved_at = now;
      }

      const { error: updateInvoiceError } = await supabase
        .from("invoices")
        .update(invoiceUpdate)
        .eq("id", approval.invoice_id);

      if (updateInvoiceError) {
        throw new Error(`Failed to update invoice: ${updateInvoiceError.message}`);
      }

      console.log(`Invoice approval ${action}d for invoice ${approval.invoice_id}`);

      return new Response(
        JSON.stringify({ success: true, status: newStatus }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in handle-invoice-approval:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

Deno.serve(handler);
