import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.63.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.94.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODEL = "claude-haiku-4-5";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

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

    const needsEstimate = items.filter((i: any) => i.calories === null || i.calories === 0);
    if (needsEstimate.length === 0) {
      return new Response(JSON.stringify({ estimated: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const uniqueFoods = [...new Set(needsEstimate.map((i: any) => i.food_name))];

    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: "You are a nutrition expert. Return only valid JSON arrays with no markdown formatting, no code fences, no extra text. You MUST return the food_name EXACTLY as the user provided it — same spelling, same case, same pluralization.",
      messages: [{
        role: "user",
        content: `Give me estimated nutritional values per typical serving for the following food items served at a youth program dinner. Return one entry per food, and set food_name to the EXACT string I provided (case and pluralization preserved). Foods: ${uniqueFoods.map(f => `"${f}"`).join(", ")}. For each item return: calories, protein_g, carbs_g, fat_g, fiber_g. Respond only in JSON array format like: [{"food_name": "Fried Chicken", "calories": 320, "protein_g": 28, "carbs_g": 11, "fat_g": 19, "fiber_g": 0}]`,
      }],
    });

    const textBlock = response.content.find((b: any) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text block in AI response");
    }

    let content = textBlock.text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let nutritionData: any[];
    try {
      nutritionData = JSON.parse(content);
    } catch {
      console.error("Failed to parse AI response:", content);
      return new Response(JSON.stringify({ error: "Failed to parse nutrition data from AI" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log("AI returned nutrition for foods:", nutritionData.map((n: any) => n.food_name));
    console.log("DB has foods needing estimate:", needsEstimate.map((i: any) => i.food_name));

    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

    const nutritionMap = new Map<string, any>();
    for (const entry of nutritionData) {
      nutritionMap.set(normalize(entry.food_name), entry);
    }

    const findMatch = (foodName: string): any => {
      const norm = normalize(foodName);
      if (nutritionMap.has(norm)) return nutritionMap.get(norm);
      for (const [key, value] of nutritionMap.entries()) {
        if (key.includes(norm) || norm.includes(key)) return value;
      }
      return null;
    };

    let updated = 0;
    for (const item of needsEstimate) {
      const nutrition = findMatch((item as any).food_name);
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
    if (e instanceof Anthropic.RateLimitError) {
      return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (e instanceof Anthropic.APIError) {
      return new Response(JSON.stringify({ error: `AI service error: ${e.message}` }), { status: e.status ?? 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
