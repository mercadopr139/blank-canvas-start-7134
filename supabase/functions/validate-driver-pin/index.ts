import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { driver_id, pin } = await req.json();

    if (!driver_id || !pin) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (typeof pin !== "string" || pin.length < 4 || pin.length > 6) {
      return new Response(
        JSON.stringify({ valid: false, error: "Invalid PIN format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: driver, error } = await supabase
      .from("drivers")
      .select("id, name, pin_hash, status")
      .eq("id", driver_id)
      .maybeSingle();

    if (error || !driver) {
      return new Response(
        JSON.stringify({ valid: false, error: "Driver not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (driver.status !== "active") {
      return new Response(
        JSON.stringify({ valid: false, error: "Driver account is inactive" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Compare PIN (stored as plain hash for simplicity — PIN is hashed client-side with SHA-256)
    // For now, compare directly since we store the PIN as a simple hash
    const encoder = new TextEncoder();
    const data_buf = encoder.encode(pin);
    const hash_buf = await crypto.subtle.digest("SHA-256", data_buf);
    const hash_arr = Array.from(new Uint8Array(hash_buf));
    const pin_hash = hash_arr.map((b) => b.toString(16).padStart(2, "0")).join("");

    if (pin_hash !== driver.pin_hash) {
      return new Response(
        JSON.stringify({ valid: false, error: "Incorrect PIN. Try again." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ valid: true, driver_name: driver.name }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
