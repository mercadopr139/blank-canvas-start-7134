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
    const body = await req.json();
    const { first_name, last_name, pickup_zone, photo_url, address, emergency_contact_name, emergency_contact_phone, date_of_birth } = body;

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

    // Check for existing profile with same name and zone
    const { data: existing } = await supabase
      .from("youth_profiles")
      .select("id")
      .ilike("first_name", first_name.trim())
      .ilike("last_name", last_name.trim())
      .eq("pickup_zone", pickup_zone)
      .limit(1)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ id: existing.id, duplicate: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const record: Record<string, unknown> = {
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      pickup_zone,
      photo_url: photo_url || null,
      status: "active",
    };

    if (address) record.address = address;
    if (emergency_contact_name) record.emergency_contact_name = emergency_contact_name;
    if (emergency_contact_phone) record.emergency_contact_phone = emergency_contact_phone;
    if (date_of_birth) record.date_of_birth = date_of_birth;

    const { data, error } = await supabase
      .from("youth_profiles")
      .insert(record)
      .select("id")
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ id: data.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Failed to add youth" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
