// Shared handling for the Claude calls every AI edge function makes.
//
// Two failure modes hit all of them, and each function had its own
// half-version of the fix or none at all:
//
// 1. THE EMPTY REPLY. Claude 5 models think before they answer, and the
//    thinking is charged against max_tokens. Given a small budget the model
//    can spend all of it deliberating and return no text block whatsoever —
//    stop_reason "max_tokens", content [thinking]. Every function read that
//    back as "" and reported it as bad JSON or an empty narrative, which in
//    the UI looked like nothing had happened. Thursday on the NBT board
//    failed this way every single time before anyone noticed.
//
// 2. THE CUT-OFF REPLY. The parsers took the LAST closing brace, which on a
//    truncated reply is an inner one, so they sliced a fragment and threw a
//    byte offset that pointed at nothing a person could act on.
//
// So: one place to say how much to think, one place to read the text back,
// and one place to pull the JSON out.

export type Effort = "low" | "medium" | "high";

/**
 * Thinking settings for a Claude 5 model.
 *
 * "adaptive" lets the model think as much as the effort warrants, and the
 * effort is what actually bounds it — these models reject a token budget for
 * thinking. max_tokens must leave room for the thinking AND the answer:
 * treat 6000 as the floor for a short JSON reply and 8000+ for prose. The
 * SDK version pinned here does not know these fields, hence the cast at the
 * call site.
 */
export const thinking = (effort: Effort) => ({
  thinking: { type: "adaptive" as const },
  output_config: { effort },
});

type Reply = {
  stop_reason?: string | null;
  content: Array<{ type: string; text?: string }>;
};

/** The text of a reply, or a clear error saying why there is none. */
export const textOf = (response: Reply): string => {
  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("\n")
    .trim();
  if (text) return text;

  const kinds = response.content.map((b) => b.type).join(", ") || "none";
  const why =
    response.stop_reason === "max_tokens"
      ? "it ran out of room while thinking, before it wrote the answer"
      : `stop reason: ${response.stop_reason ?? "unknown"}`;
  throw new Error(`The AI sent back nothing (${why}; blocks: ${kinds}). Try again.`);
};

/**
 * Pull the JSON object out of a model reply.
 *
 * Walks from the first brace tracking string state and depth, and takes the
 * brace that actually closes it — so a reply cut off part way is reported as
 * cut off rather than as a syntax error at a meaningless offset. Trailing
 * commas are stripped, and a genuine syntax error quotes the text around it.
 */
export const extractJson = (raw: string) => {
  let s = raw.trim();
  if (s.startsWith("```")) s = s.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();

  const start = s.indexOf("{");
  if (start === -1) {
    const peek = s.slice(0, 200).replace(/\s+/g, " ").trim();
    throw new Error(`The AI did not return usable JSON. It said: "${peek || "(nothing)"}"`);
  }

  let depth = 0;
  let inString = false;
  let escaped = false;
  let end = -1;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (escaped) { escaped = false; continue; }
    if (c === "\\") { escaped = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (c === "{") depth += 1;
    else if (c === "}") {
      depth -= 1;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end === -1) {
    throw new Error("The AI's answer was cut off before it finished. Try again.");
  }

  const body = s.slice(start, end + 1).replace(/,(\s*[}\]])/g, "$1");
  try {
    return JSON.parse(body);
  } catch (e) {
    const at = Number(/position (\d+)/.exec((e as Error).message)?.[1] ?? -1);
    const near = at >= 0 ? ` near: ${body.slice(Math.max(0, at - 60), at + 60)}` : "";
    throw new Error(`The AI returned malformed JSON.${near}`);
  }
};
