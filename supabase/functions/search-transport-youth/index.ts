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
    const { query } = await req.json();
    if (!query || typeof query !== "string" || query.trim().length < 2) {
      return new Response(JSON.stringify({ profiles: [], registrations: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const q = query.trim();

    // Search youth_profiles
    const { data: profiles } = await supabase
      .from("youth_profiles")
      .select("id, first_name, last_name, photo_url, pickup_zone")
      .eq("status", "active")
      .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
      .order("last_name")
      .limit(10);

    // Search youth_registrations
    const { data: registrations } = await supabase
      .from("youth_registrations")
      .select("id, child_first_name, child_last_name, child_headshot_url, child_primary_address, child_date_of_birth, parent_first_name, parent_last_name, parent_phone")
      .or(`child_first_name.ilike.%${q}%,child_last_name.ilike.%${q}%`)
      .order("child_last_name")
      .limit(10);

    // Filter out registrations that already exist in profiles (by matching name)
    const profileNames = new Set(
      (profiles || []).map((p: any) => `${p.first_name.toLowerCase()}|${p.last_name.toLowerCase()}`)
    );

    const filteredRegistrations = (registrations || []).filter((r: any) =>
      !profileNames.has(`${r.child_first_name.toLowerCase()}|${r.child_last_name.toLowerCase()}`)
    );

    return new Response(JSON.stringify({
      profiles: profiles || [],
      registrations: filteredRegistrations,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ profiles: [], registrations: [] }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
