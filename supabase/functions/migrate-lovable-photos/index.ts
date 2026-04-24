import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify admin
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find registrations with URLs pointing to the old Supabase project
    const OLD_SUPABASE_HOST = "qnjpurehimuqppyrfxui.supabase.co";
    const { data: registrations, error: fetchError } = await supabase
      .from("youth_registrations")
      .select("id, child_first_name, child_last_name, child_headshot_url")
      .like("child_headshot_url", `%${OLD_SUPABASE_HOST}%`);

    if (fetchError) {
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!registrations || registrations.length === 0) {
      return new Response(JSON.stringify({ message: "No old photos found to migrate", migrated: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = { migrated: 0, failed: 0, errors: [] as string[] };

    for (const reg of registrations) {
      try {
        const oldUrl = reg.child_headshot_url;

        const res = await fetch(oldUrl, {
          headers: { "User-Agent": "Mozilla/5.0" },
        });

        if (!res.ok) {
          results.failed++;
          results.errors.push(`${reg.child_first_name} ${reg.child_last_name}: fetch failed (${res.status})`);
          continue;
        }

        const contentType = (res.headers.get("content-type") || "image/jpeg").toLowerCase();
        if (!contentType.startsWith("image/")) {
          results.failed++;
          results.errors.push(`${reg.child_first_name} ${reg.child_last_name}: not an image`);
          continue;
        }

        const imageData = await res.arrayBuffer();
        if (imageData.byteLength < 500) {
          results.failed++;
          results.errors.push(`${reg.child_first_name} ${reg.child_last_name}: file too small`);
          continue;
        }

        const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
        const fileName = `migrated_${reg.id}_${Date.now()}.${ext}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("youth-photos")
          .upload(fileName, imageData, { contentType, upsert: false });

        if (uploadError) {
          results.failed++;
          results.errors.push(`${reg.child_first_name} ${reg.child_last_name}: upload failed — ${uploadError.message}`);
          continue;
        }

        const { error: updateError } = await supabase
          .from("youth_registrations")
          .update({ child_headshot_url: uploadData.path })
          .eq("id", reg.id);

        if (updateError) {
          results.failed++;
          results.errors.push(`${reg.child_first_name} ${reg.child_last_name}: db update failed — ${updateError.message}`);
          continue;
        }

        results.migrated++;
      } catch (err) {
        results.failed++;
        results.errors.push(`${reg.child_first_name} ${reg.child_last_name}: ${String(err)}`);
      }
    }

    return new Response(JSON.stringify({ ...results, total: registrations.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
