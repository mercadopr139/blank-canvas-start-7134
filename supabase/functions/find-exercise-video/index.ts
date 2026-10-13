// find-exercise-video — a kid-safe YouTube demo for an exercise, cached.
//
// { name }                → the cached pick, or a fresh search (anyone).
// { name, refresh: true } → throw the current pick out and find another,
//                           skipping every video already rejected for this
//                           exercise (a signed-in coach, from Edit tonight on
//                           the Battle Team board — Josh, 2026-10-13: the
//                           "standing dumbbell press" was showing a seated
//                           press). Each tap brings one not seen before.
//
// Ranking: YouTube's relevance order, except that when the exercise name has
// a qualifying word — standing, seated, incline, single-arm — results whose
// title carries that word come first, so the first pick is more often right.
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

// Words in an exercise name that change what the movement IS. A title that
// carries them outranks one that doesn't; a title that carries the opposite
// one (seated for a standing press) drops to the back.
const QUALIFIERS: Record<string, string[]> = {
  standing: ["seated", "sitting", "kneeling", "lying"],
  seated: ["standing", "kneeling", "lying"],
  kneeling: ["standing", "seated"],
  lying: ["standing", "seated"],
  incline: ["decline", "flat"],
  decline: ["incline", "flat"],
  flat: ["incline", "decline"],
  "single-arm": [],
  "single arm": [],
  "one-arm": [],
  "one arm": [],
  alternating: [],
  dumbbell: ["barbell", "kettlebell", "cable", "machine"],
  barbell: ["dumbbell", "kettlebell", "cable", "machine"],
  kettlebell: ["dumbbell", "barbell"],
  cable: ["dumbbell", "barbell"],
  "close-grip": ["wide-grip", "wide grip"],
  "close grip": ["wide-grip", "wide grip"],
  "wide-grip": ["close-grip", "close grip"],
  "wide grip": ["close-grip", "close grip"],
  reverse: [],
  overhead: [],
  front: ["back"],
  back: ["front"],
  bulgarian: [],
  romanian: ["conventional", "sumo"],
  sumo: ["conventional", "romanian"],
  goblet: [],
  hammer: [],
};

/**
 * How well a title matches the name's qualifiers: 0 when it contradicts one
 * (seated, for a standing press), 1 when it says nothing, and 1 + the number
 * of qualifiers it carries otherwise — so "standing dumbbell" beats
 * "dumbbell" alone (Josh, 2026-10-13: the dumbbell clip was a seated one).
 */
const agreement = (name: string, title: string): number => {
  const n = name.toLowerCase();
  const t = title.toLowerCase();
  let matched = 0;
  for (const [word, opposites] of Object.entries(QUALIFIERS)) {
    if (!n.includes(word)) continue;
    if (opposites.some((o) => t.includes(o)) && !t.includes(word)) return 0;
    if (t.includes(word)) matched++;
  }
  return 1 + matched;
};

/** Does the title carry every qualifier the name has? */
const fullyAgrees = (name: string, title: string): boolean => {
  const n = name.toLowerCase();
  const t = title.toLowerCase();
  return Object.keys(QUALIFIERS).filter((w) => n.includes(w)).every((w) => t.includes(w));
};

// ISO-8601 duration (e.g. "PT5M12S") → seconds.
const durSecs = (iso: string): number => {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso || "");
  if (!m) return 0;
  return (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0));
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const name = body?.name;
    const refresh = body?.refresh === true;
    if (!name || typeof name !== "string") return json({ youtube_id: null });

    const nameNorm = name.trim().toLowerCase();
    const url = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // A refresh spends YouTube quota and changes what the wall shows, so it
    // takes a signed-in person — the coach who unlocked Edit tonight.
    if (refresh) {
      const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
      const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: { persistSession: false } });
      const { data: who } = token ? await anon.auth.getUser(token) : { data: { user: null } };
      if (!who?.user || who.user.is_anonymous) return json({ youtube_id: null, error: "Sign in to pick a new video." }, 401);
    }

    // 1) The cached pick.
    const { data: cached } = await supabase
      .from("exercise_videos")
      .select("youtube_id, title, fetched_at, rejected_ids")
      .eq("name_norm", nameNorm)
      .maybeSingle();
    const rejected = new Set<string>((cached?.rejected_ids as string[] | null) ?? []);

    if (cached && !refresh) {
      const ageMs = Date.now() - new Date(cached.fetched_at).getTime();
      if (cached.youtube_id && ageMs < CACHE_DAYS * 864e5) {
        return json({ youtube_id: cached.youtube_id, title: cached.title });
      }
      if (!cached.youtube_id && ageMs < 864e5) return json({ youtube_id: null });
    }
    // Throwing the current one out: it is never offered for this exercise again.
    if (refresh && cached?.youtube_id) rejected.add(cached.youtube_id);

    const key = Deno.env.get("YOUTUBE_API_KEY");
    if (!key) return json({ youtube_id: null, error: "no_key" });

    // 2) Search — kid-safe, medium length, most relevant. Several candidates,
    //    so the ones that won't embed, or were rejected, can be dropped.
    const searchParams = new URLSearchParams({
      part: "snippet",
      type: "video",
      maxResults: refresh ? "20" : "10",
      q: `how to ${name} proper form technique`,
      videoEmbeddable: "true",
      videoDuration: "medium", // 4–20 min → real tutorials, never Shorts (Shorts are ≤3 min)
      safeSearch: "strict",
      order: "relevance",
      key,
    });
    const sres = await fetch(`https://www.googleapis.com/youtube/v3/search?${searchParams}`);
    if (!sres.ok) return json({ youtube_id: refresh ? null : (cached?.youtube_id ?? null), error: refresh ? "YouTube didn't answer. Try again." : undefined });
    const sdata = await sres.json();
    const seen = new Set<string>();
    const ids: string[] = (sdata.items ?? [])
      .map((it: any) => it?.id?.videoId)
      .filter((v: unknown): v is string => typeof v === "string" && !rejected.has(v) && !seen.has(v) && !!seen.add(v));

    // When the name carries a qualifier (dumbbell, standing…) and nothing
    // YouTube returned says so in its title, ask once more in plainer words —
    // "standing dumbbell overhead press" rather than "how to … proper form
    // technique" — which surfaces the titles that name the exact movement.
    const hasQualifier = Object.keys(QUALIFIERS).some((w) => nameNorm.includes(w));
    const titleAgrees = (it: any) => fullyAgrees(name, it?.snippet?.title ?? "");
    if (hasQualifier && !(sdata.items ?? []).some(titleAgrees)) {
      const again = new URLSearchParams(searchParams);
      again.set("q", `${name} tutorial`);
      again.set("maxResults", "15");
      const r2 = await fetch(`https://www.googleapis.com/youtube/v3/search?${again}`);
      if (r2.ok) {
        const d2 = await r2.json();
        for (const it of d2.items ?? []) {
          const v = it?.id?.videoId;
          if (typeof v === "string" && !rejected.has(v) && !seen.has(v)) { seen.add(v); ids.push(v); }
        }
      }
    }

    let youtubeId: string | null = null;
    let title: string | null = null;

    if (ids.length > 0) {
      // 3) Verify each candidate REALLY plays embedded: embeddable + public +
      //    not age-restricted. Search's relevance order, with titles that
      //    agree with the name's qualifiers first and ones that contradict
      //    them last.
      const vparams = new URLSearchParams({ part: "status,contentDetails,snippet", id: ids.join(","), key });
      const vres = await fetch(`https://www.googleapis.com/youtube/v3/videos?${vparams}`);
      if (vres.ok) {
        const vdata = await vres.json();
        const byId: Record<string, any> = {};
        (vdata.items ?? []).forEach((v: any) => { byId[v.id] = v; });
        const playable = ids
          .map((id) => byId[id])
          .filter((v) => {
            if (!v) return false;
            const secs = durSecs(v.contentDetails?.duration);
            const t: string = v.snippet?.title ?? "";
            return (
              v.status?.embeddable === true &&
              v.status?.privacyStatus === "public" &&
              v.status?.uploadStatus === "processed" &&
              v.contentDetails?.contentRating?.ytRating !== "ytAgeRestricted" &&
              secs >= 90 && secs <= 900 &&          // no Shorts, no 20-min rambles
              !/#shorts?\b/i.test(t) &&             // extra guard against Shorts
              !BAD_TITLE.test(t)                    // kid-appropriate title
            );
          })
          .map((v, i) => ({ v, i, agree: agreement(name, v.snippet?.title ?? "") }))
          .sort((a, b) => b.agree - a.agree || a.i - b.i);
        const best = playable[0];
        if (best) {
          youtubeId = best.v.id;
          title = best.v.snippet?.title || null;
        }
      }
    }

    // 4) Cache the result (found or not), with everything rejected so far.
    await supabase.from("exercise_videos").upsert({
      name_norm: nameNorm,
      youtube_id: youtubeId,
      title,
      fetched_at: new Date().toISOString(),
      rejected_ids: Array.from(rejected),
    });

    return json({
      youtube_id: youtubeId,
      title,
      error: refresh && !youtubeId ? "No other playable video found for that name. Try rewording it." : undefined,
    });
  } catch (e) {
    return json({ youtube_id: null, error: String(e) }, 200);
  }
});
