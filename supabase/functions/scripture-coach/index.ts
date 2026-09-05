// scripture-coach — the engine behind Scripture Coach.
//
// A youth mentor types what a kid walked in with ("my girlfriend and I think
// we're ready", "kids are calling me names", "my dad left"). This returns
// passages to walk through, short context for each, talking points to carry a
// 10–20 minute conversation, and prayer points to name before praying together.
//
// Two responsibilities, deliberately split:
//   1. Claude chooses the passage REFERENCES and writes the context/points.
//   2. The verse TEXT is fetched from Crossway's ESV API — never generated.
//      A model must never be the source of scripture text.
//
// Modes:
//   - full  (count = 5): a fresh topic. Passages + talking points + prayer points.
//   - refill (count < 5): the mentor dropped some passages and wants
//     replacements for just those slots. Passages only — the client keeps the
//     talking and prayer points it already has. `exclude` carries every
//     reference already seen or rejected so a refill never repeats one.
//
// Both keys stay server-side.
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.63.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODEL = "claude-opus-5";
const ESV_ENDPOINT = "https://api.esv.org/v3/passage/text/";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// ── The theological lane ─────────────────────────────────────────────
const SYSTEM =
  "You help youth mentors at No Limits Boxing Academy, a Christian non-profit boxing academy, walk a young person " +
  "through something they are wrestling with — using scripture rather than the mentor's personal opinion.\n\n" +

  "YOUR THEOLOGICAL LANE: expository and historically Reformed, in the vein of John MacArthur, Voddie Baucham, " +
  "Cliffe Knechtle, and Jonny Ardavanis. Concretely:\n" +
  "- The text governs the point, never the reverse. Choose a passage because it actually addresses this, not because " +
  "  a phrase in it sounds relevant.\n" +
  "- No proof-texting. If a verse only works when lifted out of its context, choose a different one.\n" +
  "- Grace and truth together. Never truth delivered without compassion; never affirmation that has no scripture " +
  "  behind it. A young person should leave feeling both told the truth and genuinely loved.\n" +
  "- Where scripture speaks plainly, say so plainly and kindly. Where it speaks indirectly, say THAT honestly rather " +
  "  than forcing a verse to carry weight it does not carry.\n" +
  "- The gospel is the center. Behavior change without Christ is moralism, and these are children who need a Savior " +
  "  more than they need a rule.\n\n" +

  "WHO IS IN THE ROOM: a real child, sitting across the desk right now, who has just told an adult something hard. " +
  "The mentor will be glancing at a screen while talking to them. So:\n" +
  "- Keep every piece SHORT. Context is 2–3 sentences. Talking points are one sentence each.\n" +
  "- Plain words. No seminary vocabulary — no 'sanctification', 'eschatological', 'covenantal' unless you immediately " +
  "  explain it in kid language.\n" +
  "- Write for the specific age you are given. A 9-year-old and a 17-year-old get the same theology in very " +
  "  different words.\n" +
  "- Never condescending. Teenagers detect it instantly and stop listening.\n\n" +

  "TALKING POINTS are questions and prompts that get the YOUNG PERSON talking — not a lecture outline for the mentor. " +
  "Open-ended, specific to their situation, the kind of thing that opens a 10–20 minute conversation.\n\n" +

  "RESPONSES pair one-to-one with the talking points, in the same order — response 1 goes with talking point 1. " +
  "A mentor can be lost for words when a child answers something heavy, so each response is the thing you would " +
  "want a wise, warm, biblically grounded pastor to say next. Write them as words the mentor could actually SAY " +
  "OUT LOUD, in the second person, to the child. One or two short sentences — a guide, not a script. Anchor them " +
  "in the same theology as everything else: honest about what scripture says, unmistakably kind, gospel-centered, " +
  "never dismissive of what the child just admitted.\n\n" +

  "PRAYER POINTS are a few short things to name before praying together — 'thank God for how he made you', " +
  "'ask for freedom from lust', 'forgiveness for...'. They are reminders, NOT a written prayer to read aloud. " +
  "Three to four words to a short phrase each.\n\n" +

  "HARD TOPICS: some of these will be heavy — sexuality, abuse, self-harm, a parent leaving, suicidal thoughts. " +
  "Do not soften scripture, and do not become clinical. Handle the child with the tenderness of someone who knows " +
  "they are made in God's image and is speaking to them at the hardest moment of their week.\n\n" +

  "OUTPUT: valid JSON only. No prose before or after, no markdown fences.\n" +
  "{\n" +
  '  "passages": [ { "ref": "1 Corinthians 6:18-20", "context": "2-3 short sentences on what this passage is saying and why it speaks to this situation." } ],\n' +
  '  "talking_points": ["one sentence each"],\n' +
  '  "responses": ["what the mentor could say next — same order and count as talking_points"],\n' +
  '  "prayer_points": ["short phrase each"]\n' +
  "}\n\n" +

  "CAPITALISATION: every talking point, response, and prayer point starts with a capital letter.\n\n" +

  "REFERENCE FORMAT is critical — it is sent to a Bible API verbatim. Use standard English book names and normal " +
  "punctuation: 'John 3:16', 'Psalm 139:13-16', '1 Corinthians 6:18-20', 'Romans 8:1'. Never abbreviate the book, " +
  "never use a dash other than a hyphen, never cite a whole chapter. Keep each passage to roughly 1–8 verses so it " +
  "can be read aloud in under a minute.";

// Strip fences and pull the outermost JSON object — same defensive parse the
// other coach functions use.
const parseJson = (raw: string) => {
  let s = raw.trim();
  if (s.startsWith("```")) s = s.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("The AI did not return usable JSON.");
  return JSON.parse(s.slice(start, end + 1));
};

// Fetch one passage's text from Crossway. Returns null when the reference
// cannot be resolved, so a bad pick is dropped rather than shown blank.
const fetchEsv = async (ref: string, key: string): Promise<string | null> => {
  const params = new URLSearchParams({
    q: ref,
    "include-headings": "false",
    "include-footnotes": "false",
    "include-verse-numbers": "false",
    "include-short-copyright": "false",
    "include-passage-references": "false",
    "indent-paragraphs": "0",
  });
  try {
    const res = await fetch(`${ESV_ENDPOINT}?${params}`, {
      headers: { Authorization: `Token ${key}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = (data?.passages?.[0] ?? "").trim();
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  const ESV_API_KEY = Deno.env.get("ESV_API_KEY");
  if (!ANTHROPIC_API_KEY) return json({ error: "ANTHROPIC_API_KEY is not configured." }, 500);
  if (!ESV_API_KEY) return json({ error: "ESV_API_KEY is not configured." }, 500);

  try {
    const body = await req.json();
    const topic = String(body?.topic ?? "").trim();
    const age = Number(body?.age) || null;
    const count = Math.min(Math.max(Number(body?.count) || 5, 1), 5);
    const exclude: string[] = Array.isArray(body?.exclude) ? body.exclude.slice(0, 40) : [];

    if (topic.length < 3) {
      return json({ error: "Tell me what the youth brought up." }, 400);
    }

    const isRefill = count < 5;
    const who = age
      ? `The young person is ${age} years old.`
      : "The young person is a youth-program age child.";

    // Prior conversations with THIS youth. A second session should build on
    // the first rather than starting cold — and it must not hand the mentor
    // the same five passages the child already heard.
    const history: Array<{ date?: string; topic?: string }> =
      Array.isArray(body?.history) ? body.history.slice(0, 6) : [];

    const situation =
      `${who}\n\n` +
      (history.length
        ? "This is not the first time this youth has sat down with a mentor. " +
          "Earlier conversations:\n" +
          history
            .map((h) => `- ${h.date ? `${h.date}: ` : ""}${h.topic ?? ""}`)
            .join("\n") +
          "\n\nBuild on that rather than starting over. You may acknowledge the " +
          "ongoing struggle, go deeper than the obvious first-conversation " +
          "passages, and choose scripture that moves them forward from where " +
          "they already are.\n\n"
        : "") +
      `What they brought up, in the mentor's words:\n"${topic}"\n\n`;

    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    // A mentor is waiting with a child in the room, so latency is part of the
    // product. Two things buy that back:
    //   - effort "low": the system prompt already specifies the job tightly,
    //     so the default "high" spends thinking this task doesn't need.
    //   - splitting the work: nearly all the wall time is spent GENERATING
    //     tokens, so the passages and the talking/prayer points are written by
    //     two requests running at the same time instead of one long one.
    const ask = async (userPrompt: string) => {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 4000,
        system: SYSTEM,
        messages: [{ role: "user", content: userPrompt }],
        output_config: { effort: "low" },
      } as never);
      const textBlock = response.content.find((b: { type: string }) => b.type === "text");
      return parseJson((textBlock as { text?: string })?.text ?? "");
    };

    const passagesPrompt =
      situation +
      (exclude.length
        ? "Do NOT use any of these references — they have already been shown or set aside " +
          "for this conversation:\n" + exclude.map((r) => `- ${r}`).join("\n") + "\n\n"
        : "") +
      `Return ONLY this shape, with exactly ${count} passage${count === 1 ? "" : "s"}:\n` +
      '{ "passages": [ { "ref": "...", "context": "..." } ] }';

    const pointsPrompt =
      situation +
      "Return ONLY this shape, with 4-6 talking points and 3-4 prayer points. " +
      '"responses" must have exactly as many items as "talking_points", in the same ' +
      "order — response 1 is what the mentor could say after talking point 1:\n" +
      '{ "talking_points": ["..."], "responses": ["..."], "prayer_points": ["..."] }';

    // A refill only needs replacement passages — the mentor keeps the talking
    // and prayer points already on screen, so that half isn't requested at all.
    const [passagesResult, pointsResult] = await Promise.all([
      ask(passagesPrompt),
      isRefill ? Promise.resolve({}) : ask(pointsPrompt),
    ]);

    const parsed = { ...pointsResult, ...passagesResult };

    const rawPassages: Array<{ ref?: string; context?: string }> =
      Array.isArray(passagesResult?.passages) ? passagesResult.passages : [];

    // Look the verses up in parallel; drop anything the ESV API can't resolve
    // rather than showing an empty card.
    const withText = await Promise.all(
      rawPassages.slice(0, count).map(async (p) => {
        const ref = String(p?.ref ?? "").trim();
        if (!ref) return null;
        const esv_text = await fetchEsv(ref, ESV_API_KEY);
        if (!esv_text) return null;
        return { ref, esv_text, context: String(p?.context ?? "").trim() };
      })
    );

    const passages = withText.filter(Boolean);
    if (passages.length === 0) {
      return json({ error: "Couldn't look those passages up. Try rewording the topic." }, 502);
    }

    return json({
      passages,
      talking_points: Array.isArray(parsed?.talking_points)
        ? parsed.talking_points.map((t: unknown) => String(t))
        : [],
      responses: Array.isArray(parsed?.responses)
        ? parsed.responses.map((t: unknown) => String(t))
        : [],
      prayer_points: Array.isArray(parsed?.prayer_points)
        ? parsed.prayer_points.map((t: unknown) => String(t))
        : [],
    });
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    if (err?.status === 429) {
      return json({ error: "The AI is busy right now — try again in a moment." }, 429);
    }
    if (err?.status) {
      return json({ error: `AI service error: ${err.message}` }, err.status);
    }
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
