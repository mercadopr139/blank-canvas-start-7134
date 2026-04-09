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
    const { first_name, last_name, pickup_zone, photo_url } = await req.json();

    if (!first_name || !last_name || !pickup_zone) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validZones = ["Woodbine", "Wildwood"];
    if (!validZones.includes(pickup_zone)) {
      return new Response(JSON.stringify({ error: "Invalid pickup zone" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supabase
      .from("youth_profiles")
      .insert({
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        pickup_zone,
        photo_url: photo_url || null,
        status: "active",
      })
      .select("id")
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ id: data.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Failed to add youth" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
