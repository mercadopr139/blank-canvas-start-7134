import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const CACHE_DAYS = 60;

// Skip videos with profanity in the title — it's a kids' app. Catches common
// censored forms too (f*ck, sh*t, etc.).
const BAD_TITLE = /(f+[\*\W_]*u*[\*\W_]*ck|f\*+k|sh[\*\W_]*i*t|\bshit\b|b[\*\W_]*i*tch|assh[o0]le|\bdick\b|\bcunt\b|motherf|\bwtf\b)/i;

// ISO-8601 duration (e.g. "PT5M12S") → seconds.
const durSecs = (iso: string): number => {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso || "");
  if (!m) return 0;
  return (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0));
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { name } = await req.json();
    if (!name || typeof name !== "string") return json({ youtube_id: null });

    const nameNorm = name.trim().toLowerCase();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1) Cache hit (recent) → return immediately.
    const { data: cached } = await supabase
      .from("exercise_videos")
      .select("youtube_id, title, fetched_at")
      .eq("name_norm", nameNorm)
      .maybeSingle();

    if (cached) {
      const ageMs = Date.now() - new Date(cached.fetched_at).getTime();
      if (cached.youtube_id && ageMs < CACHE_DAYS * 864e5) {
        return json({ youtube_id: cached.youtube_id, title: cached.title });
      }
      if (!cached.youtube_id && ageMs < 864e5) return json({ youtube_id: null });
    }

    const key = Deno.env.get("YOUTUBE_API_KEY");
    if (!key) return json({ youtube_id: null, error: "no_key" });

    // 2) Search — kid-safe, short, most relevant. Grab several candidates so we
    //    can drop any that won't actually embed.
    const searchParams = new URLSearchParams({
      part: "snippet",
      type: "video",
      maxResults: "8",
      q: `how to ${name} proper form technique`,
      videoEmbeddable: "true",
      videoDuration: "medium", // 4–20 min → real tutorials, never Shorts (Shorts are ≤3 min)
      safeSearch: "strict",
      order: "relevance",
      key,
    });
    const sres = await fetch(`https://www.googleapis.com/youtube/v3/search?${searchParams}`);
    if (!sres.ok) return json({ youtube_id: cached?.youtube_id ?? null });
    const sdata = await sres.json();
    const ids: string[] = (sdata.items ?? [])
      .map((it: any) => it?.id?.videoId)
      .filter((v: unknown): v is string => typeof v === "string");

    let youtubeId: string | null = null;
    let title: string | null = null;

    if (ids.length > 0) {
      // 3) Verify each candidate REALLY plays embedded: embeddable + public +
      //    not age-restricted. Keep search's relevance order.
      const vparams = new URLSearchParams({
        part: "status,contentDetails,snippet",
        id: ids.join(","),
        key,
      });
      const vres = await fetch(`https://www.googleapis.com/youtube/v3/videos?${vparams}`);
      if (vres.ok) {
        const vdata = await vres.json();
        const byId: Record<string, any> = {};
        (vdata.items ?? []).forEach((v: any) => { byId[v.id] = v; });
        for (const id of ids) {
          const v = byId[id];
          if (!v) continue;
          const secs = durSecs(v.contentDetails?.duration);
          const t: string = v.snippet?.title ?? "";
          if (
            v.status?.embeddable === true &&
            v.status?.privacyStatus === "public" &&
            v.status?.uploadStatus === "processed" &&
            v.contentDetails?.contentRating?.ytRating !== "ytAgeRestricted" &&
            secs >= 90 && secs <= 900 &&          // no Shorts, no 20-min rambles
            !/#shorts?\b/i.test(t) &&             // extra guard against Shorts
            !BAD_TITLE.test(t)                    // kid-appropriate title
          ) {
            youtubeId = id;
            title = t || null;
            break;
          }
        }
      }
    }

    // 4) Cache the result (found or not).
    await supabase.from("exercise_videos").upsert({
      name_norm: nameNorm,
      youtube_id: youtubeId,
      title,
      fetched_at: new Date().toISOString(),
    });

    return json({ youtube_id: youtubeId, title });
  } catch (e) {
    return json({ youtube_id: null, error: String(e) }, 200);
  }
});
