import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Send, Sparkles, ChevronDown, ChevronRight, Loader2, Database } from "lucide-react";

const SUPER_ADMIN_EMAIL = "joshmercado@nolimitsboxingacademy.org";

type Step = { sql: string; rowCount: number | null; error?: string; rows?: any[] };
type Msg = {
  role: "user" | "assistant";
  content: string;
  steps?: Step[];
  error?: boolean;
};

const SUGGESTIONS = [
  "How many trips has Harold made in the past 10 days?",
  "How many days has Maicol attended this month?",
  "Which youth have the most call-outs this month?",
  "How many meals did we serve last week?",
];

const AdminCornerCoach = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [openSteps, setOpenSteps] = useState<Record<number, boolean>>({});
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Extra guard on top of the server-side super-admin check.
  if (user && user.email?.toLowerCase() !== SUPER_ADMIN_EMAIL) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-center px-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Not available</h1>
          <p className="text-zinc-400">Corner Coach is restricted to the account owner.</p>
          <Button variant="outline" className="mt-6 border-white/10 text-zinc-300" onClick={() => navigate("/admin/dashboard")}>
            Back to dashboard
          </Button>
        </div>
      </div>
    );
  }

  const ask = async (q: string) => {
    const question = q.trim();
    if (!question || loading) return;
    setInput("");

    const nextMessages: Msg[] = [...messages, { role: "user", content: question }];
    setMessages(nextMessages);
    setLoading(true);

    // Pass prior text turns so follow-up questions have context.
    const history = messages.map((m) => ({ role: m.role, content: m.content }));

    try {
      const { data, error } = await supabase.functions.invoke("corner-coach", {
        body: { question, history },
      });
      if (error) throw error;
      if (data?.error) {
        setMessages([...nextMessages, { role: "assistant", content: data.error, error: true }]);
      } else {
        setMessages([...nextMessages, { role: "assistant", content: data.answer || "(no answer)", steps: data.steps }]);
      }
    } catch (e: any) {
      setMessages([...nextMessages, { role: "assistant", content: e?.message || "Something went wrong. Try again.", error: true }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <header className="border-b border-white/[0.06] bg-[#09090b]/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/dashboard")} aria-label="Back to dashboard" className="text-zinc-400 hover:text-white hover:bg-white/5">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#bf0f3e]" />
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">Corner Coach</h1>
              <p className="text-xs text-zinc-500 font-medium">Your data, in your corner</p>
            </div>
          </div>
        </div>
      </header>

      {/* Conversation */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-6 space-y-4">
          {messages.length === 0 && !loading && (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#bf0f3e]/10 mb-4">
                <Sparkles className="w-7 h-7 text-[#bf0f3e]" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">What can I look up for you?</h2>
              <p className="text-zinc-500 mb-6 text-sm">Ask in plain English — trips, attendance, call-outs, meals, supporters, anything in your data.</p>
              <div className="grid sm:grid-cols-2 gap-2 max-w-xl mx-auto">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => ask(s)}
                    className="text-left text-sm text-zinc-300 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-xl px-4 py-3 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  m.role === "user"
                    ? "max-w-[85%] bg-[#bf0f3e] text-white rounded-2xl rounded-br-sm px-4 py-2.5 text-sm"
                    : `max-w-[85%] rounded-2xl rounded-bl-sm px-4 py-3 text-sm whitespace-pre-wrap ${m.error ? "bg-red-950/40 border border-red-900/40 text-red-200" : "bg-white/[0.04] border border-white/[0.06] text-zinc-100"}`
                }
              >
                {m.content}

                {/* Transparency: what queries ran */}
                {m.role === "assistant" && m.steps && m.steps.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-white/[0.06]">
                    <button
                      onClick={() => setOpenSteps((p) => ({ ...p, [i]: !p[i] }))}
                      className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
                    >
                      {openSteps[i] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      <Database className="w-3 h-3" />
                      {m.steps.length} quer{m.steps.length === 1 ? "y" : "ies"} run
                    </button>
                    {openSteps[i] && (
                      <div className="mt-2 space-y-2">
                        {m.steps.map((s, j) => (
                          <div key={j} className="text-xs">
                            <pre className="bg-black/40 border border-white/[0.06] rounded-lg p-2 overflow-x-auto text-zinc-400 whitespace-pre-wrap">{s.sql}</pre>
                            <p className={`mt-0.5 ${s.error ? "text-red-400" : "text-zinc-600"}`}>
                              {s.error ? `error: ${s.error}` : `${s.rowCount} row${s.rowCount === 1 ? "" : "s"}`}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl rounded-bl-sm px-4 py-3 text-sm text-zinc-400 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Checking the tape…
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      {/* Composer */}
      <div className="border-t border-white/[0.06] bg-[#09090b]/80 backdrop-blur-md sticky bottom-0">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  ask(input);
                }
              }}
              placeholder="e.g. How many days has Maicol attended this month?"
              rows={1}
              className="resize-none bg-white/[0.04] border-white/10 text-white placeholder:text-zinc-600 min-h-[44px] max-h-40"
            />
            <Button
              onClick={() => ask(input)}
              disabled={loading || !input.trim()}
              className="bg-[#bf0f3e] hover:bg-[#bf0f3e]/80 text-white h-11 px-4 shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-[11px] text-zinc-600 mt-2 text-center">Corner Coach reads your database only — it can't change anything. Double-check figures before sharing externally.</p>
        </div>
      </div>
    </div>
  );
};

export default AdminCornerCoach;
