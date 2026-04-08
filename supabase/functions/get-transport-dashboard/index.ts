import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch routes
    const { data: routes, error: routesErr } = await supabase
      .from("routes")
      .select("id, name")
      .order("name");

    if (routesErr) throw routesErr;

    // Fetch active youth counts per zone
    const { data: youthData, error: youthErr } = await supabase
      .from("youth_profiles")
      .select("pickup_zone")
      .eq("status", "active");

    if (youthErr) throw youthErr;

    const youth_counts: Record<string, number> = {};
    for (const y of youthData || []) {
      youth_counts[y.pickup_zone] = (youth_counts[y.pickup_zone] || 0) + 1;
    }

    return new Response(
      JSON.stringify({ routes, youth_counts }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: "Failed to load dashboard data" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
