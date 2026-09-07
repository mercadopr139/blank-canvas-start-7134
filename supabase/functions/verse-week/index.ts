// verse-week — the engine behind the gym board's Verse of the Week.
//
// A coach types a theme for the week ("youth struggling with identity") when
// building the practice plan. This returns FIVE passages — one per practice
// day, Monday to Friday — that walk the academy through that theme together,
// each with short context, three discussion questions written for an 11–19
// mixed room, and a model answer for each question the mentor can lean on.
//
// Same split of responsibility as scripture-coach:
//   1. Claude chooses the passage REFERENCES and writes context/questions/answers.
//   2. The verse TEXT is fetched from Crossway's ESV API — never generated.
//      A model must never be the source of scripture text.
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

// ── The theological lane (same as Scripture Coach) ───────────────────
const SYSTEM =
  "You help the youth mentors at No Limits Boxing Academy, a Christian non-profit boxing academy, disciple their " +
  "youth through scripture. Each week the academy takes ONE theme and, at the start of practice, gathers for a short " +
  "team meeting where a mentor opens the day's verse and leads a brief discussion in front of the whole room.\n\n" +

  "YOUR THEOLOGICAL LANE: expository and historically Reformed, in the vein of John MacArthur, Voddie Baucham, " +
  "Cliffe Knechtle, Johnny Chang (a former gang member and prison minister — Core of the Heart — whose " +
  "testimony-driven voice preaches redemption and real transformation to at-risk and incarcerated young people), " +
  "and Philip Anthony Mitchell (lead pastor of 2819 Church, Atlanta — a bold, " +
  "prayer-saturated expository voice calling for repentance, the fear of God, and wholehearted obedience to Christ, " +
  "held in the same grace-and-truth balance as the others). Concretely:\n" +
  "- The text governs the point, never the reverse. Choose a passage because it actually addresses the theme, not " +
  "  because a phrase in it sounds relevant.\n" +
  "- No proof-texting. If a verse only works when lifted out of its context, choose a different one.\n" +
  "- Grace and truth together. Never truth without compassion; never affirmation with no scripture behind it.\n" +
  "- Where scripture speaks plainly, say so plainly and kindly. Where it speaks indirectly, say THAT honestly rather " +
  "  than forcing a verse to carry weight it does not carry.\n" +
  "- The gospel is the center. Behavior change without Christ is moralism, and these are children who need a Savior " +
  "  more than they need a rule.\n" +
  "- Reflect these men's approach; never fabricate quotations from them or anyone else.\n\n" +

  "THE WEEK: choose FIVE DISTINCT passages, one for each day Monday through Friday, that together walk the room " +
  "through the theme — opening it up early in the week and moving toward the gospel and a lived response by Friday. " +
  "No passage repeats.\n\n" +

  "LENGTH IS CRITICAL: this opens a five-minute team meeting, not a Bible study. Each verse must be SHORT — a " +
  "SINGLE verse that is ONE sentence whenever possible. Only if a single verse genuinely cannot stand alone may you " +
  "use two short verses, and never more. A long, multi-sentence passage is wrong for this even if the content fits — " +
  "pick a tighter verse that carries the same truth. Think one punchy line the room can read in a few seconds.\n\n" +

  "WHO IS IN THE ROOM: a mixed group of youth roughly 11 to 19 years old, sitting together, with a mentor leading. " +
  "So:\n" +
  "- Keep every piece SHORT — a team meeting is about five minutes. Context is 2–3 sentences.\n" +
  "- Plain words. No seminary vocabulary unless you immediately explain it in kid language. Write so an 11-year-old " +
  "  follows and a 19-year-old is not talked down to.\n" +
  "- Never condescending. Teenagers detect it instantly and stop listening.\n\n" +

  "QUESTIONS: exactly TWO per day. They are open-ended discussion questions that get the YOUNG PEOPLE talking to " +
  "each other and the mentor — not yes/no, not a quiz. The first gets at what the verse means; the second at how it " +
  "hits their own life this week. Specific to the passage and the theme, and quick — this is a five-minute meeting.\n\n" +

  "WHO IS IN THE PASSAGE: name every real person the verse or the questions refer to — David, Paul, Peter, " +
  "Gideon, Ruth — and give ONE sentence saying who they were. Assume the room has never heard of them. Plain " +
  "words, no dates, no genealogy: what they did and what happened to them, told the way you would tell a " +
  "12-year-old. If the passage names nobody — a proverb, a psalm with no named figure — return an empty list; " +
  "never pad it. God, Jesus and the Holy Spirit do NOT go in this list, and neither does a group such as " +
  "'the Israelites'. Only named people, and never more than three.\n\n" +

  "ANSWERS: exactly TWO per day, pairing one-to-one with the questions in the same order — answer 1 is for " +
  "question 1. This is the mentor's private guidance: a solid, biblically grounded model answer the mentor can read " +
  "or paraphrase if the room goes quiet or heads somewhere off. Two to four sentences. Anchor them in the same " +
  "theology as everything else — honest about what the text says, unmistakably kind, gospel-centered. Write them as " +
  "something a wise, warm pastor would actually say.\n\n" +

  "OUTPUT: valid JSON only. No prose before or after, no markdown fences.\n" +
  "{\n" +
  '  "days": [\n' +
  '    { "ref": "Psalm 139:13-16", "context": "2-3 short sentences on what this passage says and how it speaks to the theme.", "figures": [{ "name": "David", "who": "one sentence on who this person was" }], "questions": ["two open-ended discussion questions"], "answers": ["a model answer for each question, same order"] }\n' +
  "  ]\n" +
  "}\n" +
  "Return EXACTLY five days, in Monday-to-Friday order.\n\n" +

  "CAPITALISATION: every question and answer starts with a capital letter.\n\n" +

  "REFERENCE FORMAT is critical — it is sent to a Bible API verbatim. Use standard English book names and normal " +
  "punctuation: 'John 3:16', 'Galatians 5:13', 'Philippians 2:3', 'Romans 8:1'. Never abbreviate the book, never " +
  "use a dash other than a hyphen, never cite a whole chapter. Prefer a single-verse reference (e.g. 'Mark 9:35'); " +
  "use a two-verse range only when unavoidable, never more.";

// Strip fences and pull the outermost JSON object — same defensive parse the
// coach functions use.
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

// The named people, kept to three and to one clean sentence each. Anything
// missing a name or a description is dropped rather than shown half-blank.
const figureList = (v: unknown): Array<{ name: string; who: string }> => {
  if (!Array.isArray(v)) return [];
  return v
    .map((f) => ({
      name: String((f as { name?: unknown })?.name ?? "").trim(),
      who: String((f as { who?: unknown })?.who ?? "").trim(),
    }))
    .filter((f) => f.name && f.who)
    .slice(0, 3);
};

const strArray = (v: unknown, n: number): string[] => {
  const a = Array.isArray(v) ? v.map((x) => String(x).trim()) : [];
  while (a.length < n) a.push("");
  return a.slice(0, n);
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  const ESV_API_KEY = Deno.env.get("ESV_API_KEY");
  if (!ANTHROPIC_API_KEY) return json({ error: "ANTHROPIC_API_KEY is not configured." }, 500);
  if (!ESV_API_KEY) return json({ error: "ESV_API_KEY is not configured." }, 500);

  try {
    const body = await req.json();
    const theme = String(body?.theme ?? "").trim();
    // References to avoid — used when regenerating so a new week (or day)
    // doesn't repeat passages the coach has already seen.
    const exclude: string[] = Array.isArray(body?.exclude) ? body.exclude.slice(0, 40) : [];

    if (theme.length < 3) {
      return json({ error: "Tell me the theme for the week." }, 400);
    }

    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    const userPrompt =
      `The theme for this week is:\n"${theme}"\n\n` +
      (exclude.length
        ? "Do NOT use any of these references — they have already been used:\n" +
          exclude.map((r) => `- ${r}`).join("\n") + "\n\n"
        : "") +
      "Return ONLY the JSON shape described, with exactly five days (Monday to Friday).";

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 6000,
      system: SYSTEM,
      messages: [{ role: "user", content: userPrompt }],
      output_config: { effort: "low" },
    } as never);

    const textBlock = response.content.find((b: { type: string }) => b.type === "text");
    const parsed = parseJson((textBlock as { text?: string })?.text ?? "");

    const rawDays: Array<{ ref?: string; context?: string; figures?: unknown; questions?: unknown; answers?: unknown }> =
      Array.isArray(parsed?.days) ? parsed.days : [];

    // Look the verses up in parallel; drop anything the ESV API can't resolve
    // rather than showing an empty verse. Text from Crossway; the rest is the
    // model's, carried through.
    const withText = await Promise.all(
      rawDays.slice(0, 5).map(async (d) => {
        const ref = String(d?.ref ?? "").trim();
        if (!ref) return null;
        const esv_text = await fetchEsv(ref, ESV_API_KEY);
        if (!esv_text) return null;
        return {
          ref,
          esv_text,
          context: String(d?.context ?? "").trim(),
          figures: figureList(d?.figures),
          questions: strArray(d?.questions, 2),
          answers: strArray(d?.answers, 2),
        };
      })
    );

    const days = withText.filter(Boolean);
    if (days.length === 0) {
      return json({ error: "Couldn't look those passages up. Try rewording the theme." }, 502);
    }

    return json({ theme, days });
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
