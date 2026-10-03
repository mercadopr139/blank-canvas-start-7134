import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isAccessManager } from "../_shared/superAdmins.ts";

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

    // Adding a person is an access change, so it belongs to the access
    // manager alone, whatever role the caller holds.
    const callerEmail = String(claimsData.claims.email ?? "").toLowerCase();
    if (!isAccessManager(callerEmail)) {
      return new Response(JSON.stringify({ error: "Only the access manager can add staff." }), {
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

        // A card that is still on Staff Management: nothing to add. A card
        // that was removed falls through and is brought back below.
        const { data: liveProfile } = await adminClient
          .from("staff_profiles")
          .select("id")
          .eq("user_id", userId)
          .is("removed_at", null)
          .maybeSingle();

        if (existingProfile && liveProfile) {
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

    // Create the staff card. Adding back someone who was removed also lifts
    // the block on their login and puts the card back on the page.
    await adminClient.auth.admin.updateUserById(userId, { ban_duration: "none" });
    await adminClient.from("staff_profiles").upsert({
      user_id: userId,
      full_name: full_name.trim(),
      email: normalizedEmail,
      job_title: job_title.trim(),
      status: "active",
      removed_at: null,
    }, { onConflict: "user_id" });

    // A new person starts with every box unchecked. Most boxes are off simply
    // by having no row; the two team tools were open to everyone before they
    // had boxes, so they are switched off here by name. Rows that already
    // exist (a login that was given a card later) are left as they are.
    for (const key of ["app_message_board", "app_agenda"]) {
      await adminClient.from("staff_permissions").upsert(
        { user_id: userId, permission_key: key, granted: false },
        { onConflict: "user_id,permission_key", ignoreDuplicates: true },
      );
    }

    await adminClient.from("access_log").insert({
      actor_email: callerEmail,
      action: inviteError ? "add_card" : "invite",
      target_email: normalizedEmail,
      detail: { user_id: userId, full_name: full_name.trim(), job_title: job_title.trim() },
    });

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
