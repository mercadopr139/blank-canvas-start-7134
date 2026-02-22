import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface BulkEmailRequest {
  supporter_ids: string[];
  from_address: string;
  subject: string;
  html_body: string;
  logged_by: string;
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

    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify admin
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

    const { supporter_ids, from_address, subject, html_body, logged_by } =
      (await req.json()) as BulkEmailRequest;

    if (!supporter_ids?.length || !from_address || !subject || !html_body) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch supporters with email_opt_in = true
    const { data: supporters, error: suppErr } = await supabase
      .from("supporters")
      .select("id, name, email, email_opt_in")
      .in("id", supporter_ids)
      .eq("email_opt_in", true);

    if (suppErr) {
      return new Response(JSON.stringify({ error: suppErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const eligible = (supporters || []).filter((s: any) => s.email);

    let sent = 0;
    let failed = 0;
    const skippedNoEmail = (supporters || []).length - eligible.length;
    const skippedOptOut = supporter_ids.length - (supporters || []).length;
    const today = new Date().toISOString().split("T")[0];

    // Determine from name
    const fromName = "No Limits Academy";

    for (const s of eligible) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${fromName} <${from_address}>`,
            reply_to: from_address,
            to: [s.email],
            subject,
            html: html_body,
          }),
        });

        if (res.ok) {
          sent++;
          // Create engagement record
          await supabase.from("engagements").insert({
            supporter_id: s.id,
            date: today,
            engagement_type: "Email",
            summary: `Bulk Email Sent: ${subject}`,
            logged_by: logged_by || null,
          });
        } else {
          const errText = await res.text();
          console.error(`Failed to send to ${s.email}:`, errText);
          failed++;
        }
      } catch (e) {
        console.error(`Error sending to ${s.email}:`, e);
        failed++;
      }
    }

    return new Response(
      JSON.stringify({
        sent,
        failed,
        skipped_no_email: skippedNoEmail,
        skipped_opt_out: skippedOptOut,
        total_requested: supporter_ids.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Bulk email error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
