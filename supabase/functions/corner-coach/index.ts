// Corner Coach — a natural-language query assistant over the NLA Postgres database.
//
// Three modes (selected by `mode` in the request body):
//   - "chat" (default): plain-English Q&A. Claude reads the schema, writes
//     read-only SQL via the run_sql tool, and answers in words.
//   - "report": turns a prior Q&A into a structured, branded report. Claude may
//     pull extra detail with run_sql, writes a narrative, then calls emit_report
//     to return { title, period_label, stats[], narrative, table }.
//   - "revise_narrative": rewrites just a report's narrative from an instruction.
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
// answer. Kept small — this is what the report/PDF export will format.
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

const runSqlTool = {
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
};

const emitReportTool = {
  name: "emit_report",
  description:
    "Emit the finished report as structured data. Call this exactly once, after you have the numbers and have written the narrative. This is what produces the downloadable branded PDF, so make it complete and professional.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "A clear report title, e.g. 'Attendance Report' or 'Meal Service Summary'." },
      period_label: { type: "string", description: "Human-readable date range if the report is time-bound, e.g. 'June 16 – July 16, 2026'. Empty string if the report is not time-bound." },
      stats: {
        type: "array",
        description: "3 to 5 headline figures for the summary strip at the top of the report. Short label + short value.",
        items: {
          type: "object",
          properties: {
            label: { type: "string" },
            value: { type: "string" },
          },
          required: ["label", "value"],
        },
      },
      narrative: {
        type: "string",
        description: "A 1–2 paragraph written narrative summarizing the findings in plain, professional English suitable for a board or grant funder. State the key numbers and any notable trend. No markdown headings.",
      },
      table: {
        type: "object",
        description: "The main supporting data table. Omit entirely if the answer has no natural table (e.g. a single number). Keep to at most 100 rows.",
        properties: {
          columns: { type: "array", items: { type: "string" } },
          rows: { type: "array", items: { type: "array", items: { type: "string" } } },
        },
        required: ["columns", "rows"],
      },
    },
    required: ["title", "narrative", "stats"],
  },
};

// Run a run_sql tool call and return the tool_result block + record the step.
async function execRunSql(serviceClient: any, block: any, steps: any[]) {
  const sql = String(block.input?.query ?? "");
  const { data, error } = await serviceClient.rpc("ask_nla_run_query", { query_text: sql });
  if (error) {
    steps.push({ sql, rowCount: null, error: error.message });
    return { type: "tool_result", tool_use_id: block.id, is_error: true, content: `Query error: ${error.message}` };
  }
  const rows = (data as any[]) ?? [];
  steps.push({ sql, rowCount: rows.length, rows: rows.slice(0, ROWS_RETURNED_TO_CLIENT) });
  let payload = JSON.stringify(rows);
  if (payload.length > 24000) {
    payload = JSON.stringify(rows.slice(0, 50)) + `\n...(${rows.length} rows total; showing first 50)`;
  }
  return { type: "tool_result", tool_use_id: block.id, content: payload };
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

    const body = await req.json();
    const mode: string = body.mode ?? "chat";
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    // ─────────────────────────────────────────────────────────────────────
    // Mode: revise_narrative — rewrite just the narrative from an instruction.
    // No DB access needed; fast single call.
    // ─────────────────────────────────────────────────────────────────────
    if (mode === "revise_narrative") {
      const { report, instruction } = body;
      if (!report?.narrative || !instruction) {
        return json({ error: "A report and an instruction are required." }, 400);
      }
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 1500,
        system:
          "You are Corner Coach, editing the narrative section of a report for No Limits Boxing Academy, a youth boxing non-profit. " +
          "Apply the user's instruction to the narrative. Keep it truthful to the figures given — never invent numbers. " +
          "Return ONLY the revised narrative as plain prose: no preamble, no markdown headings, no quotes around it.",
        messages: [
          {
            role: "user",
            content:
              `Report title: ${report.title}\n` +
              `Headline figures: ${JSON.stringify(report.stats ?? [])}\n\n` +
              `Current narrative:\n${report.narrative}\n\n` +
              `Revise it with this instruction: ${instruction}`,
          },
        ],
      });
      const narrative = response.content
        .filter((b: any) => b.type === "text")
        .map((b: any) => b.text)
        .join("\n")
        .trim();
      return json({ narrative });
    }

    // Both chat and report modes talk to the database.
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const schema = await loadSchema(serviceClient);

    // ─────────────────────────────────────────────────────────────────────
    // Mode: report — turn a prior Q&A into a structured, branded report.
    // ─────────────────────────────────────────────────────────────────────
    if (mode === "report") {
      const { question, answer, steps: priorSteps } = body;
      if (!question) return json({ error: "A question is required." }, 400);

      // Summarize the data already gathered so Claude can reuse it (and pull
      // more detail with run_sql if it needs a proper table).
      const priorData = Array.isArray(priorSteps)
        ? priorSteps
            .map((s: any, i: number) => {
              const rowsJson = JSON.stringify(s.rows ?? []).slice(0, 8000);
              return `Query ${i + 1}: ${s.sql}\nRows: ${rowsJson}`;
            })
            .join("\n\n")
        : "(none)";

      const system = [
        {
          type: "text",
          text:
            "You are Corner Coach, preparing a polished, professional report for No Limits Boxing Academy, a youth boxing non-profit. " +
            "The report will be rendered into a branded PDF for internal review, boards, and grant funders. Rules:\n" +
            "- Base every figure on actual query results. Use run_sql to pull any extra detail you need (e.g. a per-item breakdown for the table). Never invent numbers.\n" +
            "- Write standard PostgreSQL. Handle relative dates with CURRENT_DATE + interval math.\n" +
            "- When you have what you need, call emit_report exactly once with: a clear title, the period (if time-bound), 3–5 headline stats, a professional 1–2 paragraph narrative, and a data table if one makes sense (skip the table for single-number answers).\n" +
            "- Keep the table to at most 100 rows; summarize/aggregate rather than dumping raw personal records.\n\n" +
            "Database schema (table_name(columns)):\n\n" + schema,
          cache_control: { type: "ephemeral" },
        },
      ];

      const messages: any[] = [
        {
          role: "user",
          content:
            `Prepare a report based on this question and the answer already given.\n\n` +
            `Question: ${question}\n\n` +
            `Answer given: ${answer ?? "(none)"}\n\n` +
            `Data already pulled (reuse it; run more queries if you need detail for the table):\n${priorData}\n\n` +
            `Build the report and call emit_report.`,
        },
      ];

      const steps: any[] = [];
      for (let i = 0; i < MAX_STEPS; i++) {
        const response = await anthropic.messages.create({
          model: MODEL,
          max_tokens: 4096,
          system,
          tools: [runSqlTool, emitReportTool],
          messages,
        });

        if (response.stop_reason !== "tool_use") {
          // Model answered in prose without emitting a report — wrap it so the
          // client still gets something usable.
          const text = response.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n").trim();
          return json({ report: { title: "Report", period_label: "", stats: [], narrative: text, table: null }, steps });
        }

        messages.push({ role: "assistant", content: response.content });

        const emit = (response.content as any[]).find((b) => b.type === "tool_use" && b.name === "emit_report");
        if (emit) {
          return json({ report: emit.input, steps });
        }

        // Otherwise run any run_sql calls and continue.
        const toolResults: any[] = [];
        for (const block of response.content as any[]) {
          if (block.type === "tool_use" && block.name === "run_sql") {
            toolResults.push(await execRunSql(serviceClient, block, steps));
          }
        }
        messages.push({ role: "user", content: toolResults });
      }

      return json({ error: "Couldn't assemble the report within a reasonable number of steps. Try a narrower question." }, 422);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Mode: chat (default) — plain-English Q&A.
    // ─────────────────────────────────────────────────────────────────────
    const { question, history } = body;
    if (!question || typeof question !== "string") {
      return json({ error: "A question is required." }, 400);
    }

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
          "- You can't build files, PDFs, spreadsheets, or charts yourself — but the operator can turn any answer into a report with the Make Report button, so just answer clearly.\n" +
          "- This data includes minors' personal info — answer the question asked, don't dump raw personal records unless the question truly needs them.\n\n" +
          "Here is the database schema (table_name(columns)):\n\n" + schema,
        cache_control: { type: "ephemeral" },
      },
    ];

    const messages: any[] = Array.isArray(history) ? [...history] : [];
    messages.push({ role: "user", content: question });

    const steps: any[] = [];
    for (let i = 0; i < MAX_STEPS; i++) {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 4096,
        system,
        tools: [runSqlTool],
        messages,
      });

      if (response.stop_reason !== "tool_use") {
        const answer = response.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n").trim();
        return json({ answer, steps });
      }

      messages.push({ role: "assistant", content: response.content });

      const toolResults: any[] = [];
      for (const block of response.content as any[]) {
        if (block.type === "tool_use" && block.name === "run_sql") {
          toolResults.push(await execRunSql(serviceClient, block, steps));
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
