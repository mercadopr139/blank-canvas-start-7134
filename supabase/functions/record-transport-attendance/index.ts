import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { run_id, youth_id, status } = await req.json();
    if (!run_id || !youth_id || !status) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["picked_up", "dropped_off", "present", "no_show"].includes(status)) {
      return new Response(JSON.stringify({ error: "Invalid status" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Upsert: one record per run+youth+status
    // First check if record exists
    const { data: existing } = await supabase
      .from("transport_attendance")
      .select("id")
      .eq("run_id", run_id)
      .eq("youth_id", youth_id)
      .eq("status", status)
      .maybeSingle();

    if (existing) {
      // Remove (toggle off)
      await supabase.from("transport_attendance").delete().eq("id", existing.id);
      return new Response(JSON.stringify({ action: "removed" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      // Insert (toggle on)
      const { error } = await supabase.from("transport_attendance").insert({
        run_id, youth_id, status,
      });
      if (error) throw error;
      return new Response(JSON.stringify({ action: "added" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch {
    return new Response(JSON.stringify({ error: "Failed to record attendance" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
