import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.94.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { event_ids } = await req.json();
    if (!event_ids || !Array.isArray(event_ids) || event_ids.length === 0) {
      return new Response(JSON.stringify({ error: "event_ids array is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get all meal items for these events that lack nutrition data
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: items, error: itemsError } = await serviceClient
      .from("meal_items")
      .select("id, food_name, meal_event_id, calories")
      .in("meal_event_id", event_ids);

    if (itemsError) throw itemsError;
    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ estimated: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Find items missing nutrition data
    const needsEstimate = items.filter((i: any) => i.calories === null || i.calories === 0);
    if (needsEstimate.length === 0) {
      return new Response(JSON.stringify({ estimated: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get unique food names
    const uniqueFoods = [...new Set(needsEstimate.map((i: any) => i.food_name))];

    const prompt = `Give me estimated nutritional values per typical serving for the following food items served at a youth program dinner: ${uniqueFoods.join(", ")}. For each item return: calories, protein_g, carbs_g, fat_g, fiber_g. Respond only in JSON array format like: [{"food_name": "Fried Chicken", "calories": 320, "protein_g": 28, "carbs_g": 11, "fat_g": 19, "fiber_g": 0}]`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a nutrition expert. Return only valid JSON arrays with no markdown formatting, no code fences, no extra text." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const aiData = await response.json();
    let content = aiData.choices?.[0]?.message?.content || "";
    
    // Strip markdown code fences if present
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let nutritionData: any[];
    try {
      nutritionData = JSON.parse(content);
    } catch {
      console.error("Failed to parse AI response:", content);
      return new Response(JSON.stringify({ error: "Failed to parse nutrition data from AI" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Build a lookup by food name (case-insensitive)
    const nutritionMap = new Map<string, any>();
    for (const entry of nutritionData) {
      nutritionMap.set(entry.food_name.toLowerCase(), entry);
    }

    // Update each item
    let updated = 0;
    for (const item of needsEstimate) {
      const nutrition = nutritionMap.get((item as any).food_name.toLowerCase());
      if (nutrition) {
        await serviceClient.from("meal_items").update({
          calories: nutrition.calories ?? null,
          protein_g: nutrition.protein_g ?? null,
          carbs_g: nutrition.carbs_g ?? null,
          fat_g: nutrition.fat_g ?? null,
          fiber_g: nutrition.fiber_g ?? null,
        }).eq("id", (item as any).id);
        updated++;
      }
    }

    return new Response(JSON.stringify({ estimated: updated, total_items: needsEstimate.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("estimate-meal-nutrition error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
