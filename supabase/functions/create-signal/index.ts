import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  try {
    const { title, pillar, token } = await req.json()

    if (token !== Deno.env.get("SIGNALS_WEBHOOK_TOKEN")) {
      return new Response("Unauthorized", { status: 401 })
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    const { error } = await supabase.from("signals").insert({
      title: title,
      pillar: pillar || "Operations",
      status: "Pending",
      signal_kind: "Action",
      signal_type: "Action",
      priority_layer: null,
      date_assigned: null,
      is_archived: false,
    })

    if (error) throw error

    return new Response("Signal created", { status: 200 })

  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
})
