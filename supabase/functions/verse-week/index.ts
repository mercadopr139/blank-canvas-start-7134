// verse-week — the engine behind the gym board's Verse of the Week.
//
// A coach types a theme for the week ("youth struggling with identity") when
// building the practice plan. This returns FIVE passages — one per practice
// day, Monday to Friday — that walk the academy through that theme together,
// each with short context, a one-line introduction to anyone the passage names,
// and ONE discussion question. The question is deliberately about the youth’s
// own life rather than the text: a comprehension question turns a gym into a
// classroom, where only the confident kids speak. With it comes a short script
// the mentor reads out loud to close the discussion — the actual words, not
// notes about what to say.
//
// Same split of responsibility as scripture-coach:
//   1. Claude chooses the passage REFERENCES and writes context/questions/answers.
//   2. The verse TEXT is fetched from Crossway's ESV API — never generated.
//      A model must never be the source of scripture text.
//
// Both keys stay server-side.
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.63.0";
import { thinking, textOf, extractJson } from "../_shared/claude.ts";

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
const SYSTEM_HEAD =
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

  "";

// The scope of the ask. A whole week is an arc — open the theme on Monday, land
// on the gospel by Friday. A single day is a REPLACEMENT: it has to stand on its
// own inside a week already written, which is a genuinely different instruction.
const scopeSection = (single: boolean, dayLabel: string) =>
  single
    ? `ONE DAY ONLY: you are replacing the passage for ${dayLabel} in a week that is already written. Choose ` +
      "ONE passage that fits the theme and stands on its own that day — it does not need to open or close an arc. " +
      "The coach rejected what was there, so take a genuinely different angle on the theme rather than a " +
      "near-synonym of anything already in use.\n\n"
    : "THE WEEK: choose FIVE DISTINCT passages, one for each day Monday through Friday, that together walk the " +
      "room through the theme — opening it up early in the week and moving toward the gospel and a lived " +
      "response by Friday. No passage repeats.\n\n";

const SYSTEM_BODY =
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

  "THE QUESTION: exactly ONE per day. It is the entire discussion, so it has to earn its place.\n" +
  "Write it so a teenager answers out of THEIR OWN LIFE, not out of Bible knowledge. Do NOT ask what the passage " +
  "means, what a word means, or what the person in it did — the context already covered that, and a comprehension " +
  "question turns the room into a classroom where only the confident kids speak.\n" +
  "Instead, find the pressure, fear, choice or relationship in the verse and ask about where THAT shows up in a " +
  "13-to-19-year-old's week: school, the gym, their phone, their friends, their family, money, who they are when " +
  "nobody is watching, what they do after they lose. Same truth, their lens.\n" +
  "- Concrete beats abstract. 'Where do you feel like you have to pretend?' beats 'What does authenticity mean?'\n" +
  "- A 13-year-old can answer it and a 19-year-old still finds it worth answering.\n" +
  "- Open. Never yes/no, never a right answer they can guess, never a question with 'God' or 'Jesus' as the obvious " +
  "  one-word reply.\n" +
  "- No church vocabulary in the question itself.\n" +
  "- ONE sentence. It gets read aloud to a room of eighty.\n\n" +

  "WHO IS IN THE PASSAGE: name every real person the verse or the questions refer to — David, Paul, Peter, " +
  "Gideon, Ruth — and give ONE sentence saying who they were. Assume the room has never heard of them. Plain " +
  "words, no dates, no genealogy: what they did and what happened to them, told the way you would tell a " +
  "12-year-old. If the passage names nobody — a proverb, a psalm with no named figure — return an empty list; " +
  "never pad it. God, Jesus and the Holy Spirit do NOT go in this list, and neither does a group such as " +
  "'the Israelites'. Only named people, and never more than three.\n\n" +

  "WHAT THE MENTOR READS OUT LOUD: exactly ONE per day, to close the discussion after the youth have answered " +
  "the question.\n" +
  "This is a SCRIPT, not a note. The mentor reads it word for word off a screen, standing in front of eighty " +
  "young people, so write the actual words he says — not advice about what to say. Never describe the youth in " +
  "the third person ('let them be specific', 'encourage them to...'). Speak TO the room, as 'you'.\n" +
  "- Spoken English, not written English. Short sentences. Contractions. The way a man talks, not the way an " +
  "  essay reads.\n" +
  "- Three to five sentences. Long enough to land, short enough to hold a gym.\n" +
  "- Name honestly what they are probably carrying, then bring it to what the verse actually says, then leave " +
  "  them with one thing that is true whether or not they feel it today.\n" +
  "- No church vocabulary they would have to be taught. If a weighty word is unavoidable, say it and then say " +
  "  what it means in the same breath.\n" +
  "- Never a lecture, never scolding, and never sentimental. These are children who have heard adults perform " +
  "  sincerity before and can tell.\n" +
  "- The gospel is the destination, not a slogan tacked on the end.\n" +
  "Anchor it in the same theology as everything else — honest about what the text says, unmistakably kind, " +
  "gospel-centered. If you would be embarrassed to say it out loud to a room of teenagers, rewrite it.\n\n" +

  "OUTPUT: valid JSON only. No prose before or after, no markdown fences.\n" +
  "{\n" +
  '  "days": [\n' +
  '    { "ref": "Psalm 139:13-16", "context": "2-3 short sentences on what this passage says and how it speaks to the theme.", "figures": [{ "name": "David", "who": "one sentence on who this person was" }], "questions": ["the one life-application question"], "answers": ["the words the mentor reads out loud"] }\n' +
  "  ]\n" +
  "}\n" +
  "";

const countLine = (single: boolean) =>
  single
    ? "Return EXACTLY ONE day in the array.\n\n"
    : "Return EXACTLY five days, in Monday-to-Friday order.\n\n";

const SYSTEM_RULES =
  "CAPITALISATION: the question and the read-aloud each start with a capital letter.\n\n" +

  "REFERENCE FORMAT is critical — it is sent to a Bible API verbatim. Use standard English book names and normal " +
  "punctuation: 'John 3:16', 'Galatians 5:13', 'Philippians 2:3', 'Romans 8:1'. Never abbreviate the book, never " +
  "use a dash other than a hyphen, never cite a whole chapter. Prefer a single-verse reference (e.g. 'Mark 9:35'); " +
  "use a two-verse range only when unavoidable, never more.";

const systemFor = (single: boolean, dayLabel: string) =>
  SYSTEM_HEAD + scopeSection(single, dayLabel) + SYSTEM_BODY + countLine(single) + SYSTEM_RULES;

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
    // Replacing a single day: the coach didn't like Wednesday and wants another
    // one, without disturbing the four days that are fine — or the day the room
    // has already heard.
    const dayLabel = String(body?.dayLabel ?? "").trim();
    const single = !!dayLabel;

    if (theme.length < 3) {
      return json({ error: "Tell me the theme for the week." }, 400);
    }

    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    const userPrompt =
      `The theme for this week is:\n"${theme}"\n\n` +
      (exclude.length
        ? "Do NOT use any of these references — they are already in use this week:\n" +
          exclude.map((r) => `- ${r}`).join("\n") + "\n\n"
        : "") +
      (single
        ? `Return ONLY the JSON shape described, with exactly one day — the replacement for ${dayLabel}.`
        : "Return ONLY the JSON shape described, with exactly five days (Monday to Friday).");

    const response = await anthropic.messages.create({
      model: MODEL,
      // One day needs a fraction of the room a full week does — but thinking
      // is charged against this too, so neither is as small as the answer.
      max_tokens: single ? 6000 : 12000,
      system: systemFor(single, dayLabel),
      messages: [{ role: "user", content: userPrompt }],
      ...thinking("low"),
    } as never);

    const parsed = extractJson(textOf(response));

    const rawDays: Array<{ ref?: string; context?: string; figures?: unknown; questions?: unknown; answers?: unknown }> =
      Array.isArray(parsed?.days) ? parsed.days : [];

    // Look the verses up in parallel; drop anything the ESV API can't resolve
    // rather than showing an empty verse. Text from Crossway; the rest is the
    // model's, carried through.
    const withText = await Promise.all(
      rawDays.slice(0, single ? 1 : 5).map(async (d) => {
        const ref = String(d?.ref ?? "").trim();
        if (!ref) return null;
        const esv_text = await fetchEsv(ref, ESV_API_KEY);
        if (!esv_text) return null;
        return {
          ref,
          esv_text,
          context: String(d?.context ?? "").trim(),
          figures: figureList(d?.figures),
          questions: strArray(d?.questions, 1),
          answers: strArray(d?.answers, 1),
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
