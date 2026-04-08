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
    const { driver_id, route_id, run_type } = await req.json();

    if (!driver_id || !route_id || !run_type) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["pickup", "dropoff"].includes(run_type)) {
      return new Response(
        JSON.stringify({ error: "Invalid run type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify driver exists and is active
    const { data: driver, error: driverErr } = await supabase
      .from("drivers")
      .select("id, name")
      .eq("id", driver_id)
      .eq("status", "active")
      .single();

    if (driverErr || !driver) {
      return new Response(
        JSON.stringify({ error: "Driver not found or inactive" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify route exists
    const { data: route, error: routeErr } = await supabase
      .from("routes")
      .select("id, name")
      .eq("id", route_id)
      .single();

    if (routeErr || !route) {
      return new Response(
        JSON.stringify({ error: "Route not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create the run
    const { data: run, error: runErr } = await supabase
      .from("runs")
      .insert({
        driver_id,
        route_id,
        run_type,
        status: "in_progress",
      })
      .select("id, started_at")
      .single();

    if (runErr) {
      return new Response(
        JSON.stringify({ error: "Failed to create run" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ run_id: run.id, started_at: run.started_at }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: "Something went wrong" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
