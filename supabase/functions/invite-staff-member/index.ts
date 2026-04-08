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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await callerClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = claimsData.claims.sub;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check caller is admin
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden: Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, full_name, job_title } = await req.json();
    if (!email || !full_name || !job_title) {
      return new Response(JSON.stringify({ error: "Email, full name, and job title are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Add to allowlist if not already there
    await adminClient
      .from("admin_allowlist")
      .upsert({ email: normalizedEmail, added_by: callerId }, { onConflict: "email" });

    // Try to invite the user
    const { data: invitedUser, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(normalizedEmail);

    let userId: string;

    if (inviteError) {
      // If user already exists, look them up
      if (inviteError.message?.includes("already been registered") || inviteError.status === 422) {
        const { data: listData } = await adminClient.auth.admin.listUsers();
        const existing = listData?.users?.find((u: any) => u.email === normalizedEmail);
        if (!existing) {
          return new Response(JSON.stringify({ error: "Could not find existing user" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        userId = existing.id;

        // Check if staff profile already exists
        const { data: existingProfile } = await adminClient
          .from("staff_profiles")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();

        if (existingProfile) {
          return new Response(JSON.stringify({
            already_exists: true,
            user_id: userId,
            message: "This email already has an account. You can manage their permissions directly.",
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        return new Response(JSON.stringify({ error: inviteError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      userId = invitedUser.user.id;
    }

    // Create staff profile
    await adminClient.from("staff_profiles").upsert({
      user_id: userId,
      full_name: full_name.trim(),
      email: normalizedEmail,
      job_title: job_title.trim(),
    }, { onConflict: "user_id" });

    // Initialize permissions (all false by default)
    const permKeys = ["driver_checkin", "operations", "sales_marketing", "finance", "pd_signals", "settings"];
    const inserts = permKeys.map((key) => ({
      user_id: userId,
      permission_key: key,
      granted: false,
    }));
    
    for (const perm of inserts) {
      await adminClient.from("staff_permissions").upsert(perm, { onConflict: "user_id,permission_key" });
    }

    // Assign admin role
    await adminClient.from("user_roles").upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });

    const wasInvited = !inviteError;
    return new Response(JSON.stringify({
      success: true,
      user_id: userId,
      message: wasInvited
        ? `Invite sent to ${normalizedEmail}. They will receive an email to set their password.`
        : `Account linked for ${normalizedEmail}. Staff profile and permissions created.`,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
