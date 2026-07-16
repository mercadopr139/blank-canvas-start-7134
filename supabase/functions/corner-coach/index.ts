// Corner Coach — a natural-language query assistant over the NLA Postgres database.
//
// Flow: super-admin asks a plain-English question -> Claude reads the live DB
// schema -> Claude writes read-only SQL and calls the `run_sql` tool -> we run
// it through the ask_nla_run_query RPC (read-only at the DB level) -> Claude
// turns the rows into a plain-English answer.
//
// Security:
//   - Locked to the super-admin email (server-side check on the verified JWT).
//   - SQL runs through a read-only RPC; writes are impossible even if the model
//     tried. The Anthropic key never leaves the server.
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.63.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.94.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Change this one line to swap models. Sonnet 5 is the sweet spot for
// text-to-SQL: strong multi-table reasoning, fast, and inexpensive.
const MODEL = "claude-sonnet-5";
const SUPER_ADMIN_EMAIL = "joshmercado@nolimitsboxingacademy.org";
const MAX_STEPS = 8; // safety cap on the tool-use loop

// How many rows of each query we hand back to the browser alongside the prose
// answer. Kept small — this is what a future "Download PDF" export will format,
// not a raw data dump.
const ROWS_RETURNED_TO_CLIENT = 500;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Fetch a compact description of the public schema so Claude knows what tables
// and columns exist. Uses the same read-only RPC, so it can never write.
async function loadSchema(serviceClient: any): Promise<string> {
  const { data, error } = await serviceClient.rpc("ask_nla_run_query", {
    query_text: `
      select table_name, column_name, data_type
      from information_schema.columns
      where table_schema = 'public'
        and table_name not like 'pg_%'
      order by table_name, ordinal_position
    `,
  });
  if (error) throw new Error(`Schema load failed: ${error.message}`);

  const byTable = new Map<string, string[]>();
  for (const row of data as any[]) {
    const cols = byTable.get(row.table_name) ?? [];
    cols.push(`${row.column_name} ${row.data_type}`);
    byTable.set(row.table_name, cols);
  }
  return [...byTable.entries()]
    .map(([t, cols]) => `TABLE ${t}(\n  ${cols.join(",\n  ")}\n)`)
    .join("\n\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    // --- Auth: verify the caller's JWT and require the super-admin ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);

    const email = String(claimsData.claims.email ?? "").toLowerCase();
    if (email !== SUPER_ADMIN_EMAIL) {
      return json({ error: "This assistant is restricted to the account owner." }, 403);
    }

    // --- Input ---
    const { question, history } = await req.json();
    if (!question || typeof question !== "string") {
      return json({ error: "A question is required." }, 400);
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const schema = await loadSchema(serviceClient);
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    const tools = [
      {
        name: "run_sql",
        description:
          "Run a single read-only PostgreSQL SELECT query against the NLA database and get the matching rows back as JSON. Only SELECT works — the database rejects any write. Prefer aggregate queries (COUNT, SUM, AVG) and always filter to exactly what the question needs. For relative date ranges like 'the last 10 days' or 'this month', use CURRENT_DATE with interval math (e.g. CURRENT_DATE - INTERVAL '10 days', or date_trunc('month', CURRENT_DATE)). If a first query returns nothing useful, try a different column or table before giving up. Names may be split across first/last name columns — search case-insensitively with ILIKE.",
        input_schema: {
          type: "object",
          properties: {
            query: { type: "string", description: "A single PostgreSQL SELECT statement." },
          },
          required: ["query"],
        },
      },
    ];

    const system = [
      {
        type: "text",
        text:
          "You are Corner Coach, the data assistant for No Limits Boxing Academy, a youth boxing non-profit. " +
          "You're in the operator's corner: they ask a question, you check the live Postgres database with the run_sql tool, " +
          "then give it to them straight in plain English. Rules:\n" +
          "- Always base numeric answers on an actual query result. Never guess or estimate from memory.\n" +
          "- Write standard PostgreSQL. You may run several queries if needed to get the answer.\n" +
          "- Talk like a coach: short, direct, plain. Lead with the number or fact, then one line on how you got it (which table, what date range). No filler.\n" +
          "- If a query errors, read the error and fix your SQL, then retry.\n" +
          "- If you genuinely can't find the data after a couple of tries, say so plainly and suggest what would help.\n" +
          "- You can't build files, PDFs, spreadsheets, or charts — you answer in text only. If asked for one, give the answer in text and say a download isn't available yet.\n" +
          "- This data includes minors' personal info — answer the question asked, don't dump raw personal records unless the question truly needs them.\n\n" +
          "Here is the database schema (table_name(columns)):\n\n" +
          schema,
        // Cache the schema block so repeated questions are cheap and fast.
        cache_control: { type: "ephemeral" },
      },
    ];

    // Seed with prior turns (if the UI passes recent history) plus the new question.
    const messages: any[] = Array.isArray(history) ? [...history] : [];
    messages.push({ role: "user", content: question });

    const steps: { sql: string; rowCount: number | null; error?: string; rows?: any[] }[] = [];

    for (let i = 0; i < MAX_STEPS; i++) {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 4096,
        system,
        tools,
        messages,
      });

      if (response.stop_reason !== "tool_use") {
        // Final answer.
        const answer = response.content
          .filter((b: any) => b.type === "text")
          .map((b: any) => b.text)
          .join("\n")
          .trim();
        return json({ answer, steps });
      }

      // Push the assistant turn verbatim (preserves thinking/tool_use blocks).
      messages.push({ role: "assistant", content: response.content });

      // Execute every tool call and collect the results.
      const toolResults: any[] = [];
      for (const block of response.content as any[]) {
        if (block.type !== "tool_use" || block.name !== "run_sql") continue;
        const sql = String(block.input?.query ?? "");
        const { data, error } = await serviceClient.rpc("ask_nla_run_query", {
          query_text: sql,
        });

        if (error) {
          steps.push({ sql, rowCount: null, error: error.message });
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            is_error: true,
            content: `Query error: ${error.message}`,
          });
        } else {
          const rows = (data as any[]) ?? [];
          // Return a capped copy of the rows to the client so a future PDF /
          // report export has clean tabular data to format — the model still
          // only sees the payload below.
          steps.push({ sql, rowCount: rows.length, rows: rows.slice(0, ROWS_RETURNED_TO_CLIENT) });
          // Cap the payload handed back to the model so a large result set
          // doesn't blow the context window.
          let payload = JSON.stringify(rows);
          if (payload.length > 24000) {
            payload = JSON.stringify(rows.slice(0, 50)) +
              `\n...(${rows.length} rows total; showing first 50)`;
          }
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: payload,
          });
        }
      }
      messages.push({ role: "user", content: toolResults });
    }

    return json({
      answer: "I couldn't work that out within a reasonable number of steps. Try rephrasing or narrowing the question.",
      steps,
    });
  } catch (e) {
    console.error("corner-coach error:", e);
    if (e instanceof Anthropic.RateLimitError) {
      return json({ error: "The AI is busy right now — try again in a moment." }, 429);
    }
    if (e instanceof Anthropic.APIError) {
      return json({ error: `AI service error: ${e.message}` }, e.status ?? 500);
    }
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
