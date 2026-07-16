import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Send, Sparkles, ChevronDown, ChevronRight, Loader2, Database, Pin, Archive, Trash2, Plus, FileDown } from "lucide-react";
import CornerCoachReportSheet, { type ReportSource } from "@/components/admin/CornerCoachReportSheet";

const SUPER_ADMIN_EMAIL = "joshmercado@nolimitsboxingacademy.org";

type Step = { sql: string; rowCount: number | null; error?: string; rows?: any[] };
type Msg = {
  role: "user" | "assistant";
  content: string;
  steps?: Step[];
  error?: boolean;
};
type HistoryRow = Tables<"corner_coach_history">;

// "Jul 16, 2026, 9:42 AM" — every saved question carries its full date + time.
const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const AdminCornerCoach = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [openSteps, setOpenSteps] = useState<Record<number, boolean>>({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [reportSource, setReportSource] = useState<ReportSource | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Saved Q&A history (owner-only via RLS). Newest first; split into pinned /
  // recent / archived on the client.
  const { data: history = [] } = useQuery({
    queryKey: ["corner-coach-history", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("corner_coach_history")
        .select("id, question, answer, steps, pinned, archived, created_at, user_id")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as HistoryRow[];
    },
  });

  const refreshHistory = () =>
    queryClient.invalidateQueries({ queryKey: ["corner-coach-history", user?.id] });

  const pinned = history.filter((h) => h.pinned && !h.archived);
  const recent = history.filter((h) => !h.pinned && !h.archived);
  const archived = history.filter((h) => h.archived);

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
        const answer = data.answer || "(no answer)";
        const steps: Step[] | undefined = data.steps;
        setMessages([...nextMessages, { role: "assistant", content: answer, steps }]);
        // Save the completed Q&A so it can be reopened later.
        if (user) {
          await supabase.from("corner_coach_history").insert({
            user_id: user.id,
            question,
            answer,
            steps: (steps ?? null) as any,
          });
          refreshHistory();
        }
      }
    } catch (e: any) {
      setMessages([...nextMessages, { role: "assistant", content: e?.message || "Something went wrong. Try again.", error: true }]);
    } finally {
      setLoading(false);
    }
  };

  // Reopen a saved item as its full exchange (question + answer + queries).
  const reopen = (h: HistoryRow) => {
    setConfirmDelete(null);
    setMessages([
      { role: "user", content: h.question },
      { role: "assistant", content: h.answer, steps: (h.steps as unknown as Step[]) ?? undefined },
    ]);
  };

  const togglePin = async (h: HistoryRow) => {
    await supabase.from("corner_coach_history").update({ pinned: !h.pinned }).eq("id", h.id);
    refreshHistory();
  };
  const toggleArchive = async (h: HistoryRow) => {
    await supabase.from("corner_coach_history").update({ archived: !h.archived }).eq("id", h.id);
    refreshHistory();
  };
  const doDelete = async (h: HistoryRow) => {
    await supabase.from("corner_coach_history").delete().eq("id", h.id);
    setConfirmDelete(null);
    refreshHistory();
  };

  const startNew = () => {
    setMessages([]);
    setInput("");
    setConfirmDelete(null);
  };

  // The input row is used in two spots: centered under the question when the
  // screen is empty, and pinned to the bottom once a conversation is going.
  const composer = (
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
  );

  const renderItem = (h: HistoryRow) => (
    <div
      key={h.id}
      className="group flex items-start gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] px-4 py-3 transition-colors"
    >
      <button onClick={() => reopen(h)} className="flex-1 text-left min-w-0">
        <p className="text-sm text-zinc-200 truncate">{h.question}</p>
        <p className="text-[11px] text-zinc-600 mt-0.5">{formatWhen(h.created_at)}</p>
      </button>
      <div className="flex items-center gap-0.5 shrink-0">
        {confirmDelete === h.id ? (
          <>
            <button onClick={() => doDelete(h)} className="text-[11px] font-medium text-red-400 hover:text-red-300 px-1.5 py-1">Delete</button>
            <button onClick={() => setConfirmDelete(null)} className="text-[11px] text-zinc-500 hover:text-zinc-300 px-1.5 py-1">Cancel</button>
          </>
        ) : (
          <>
            <button
              onClick={() => togglePin(h)}
              title={h.pinned ? "Unpin" : "Pin"}
              className={`p-1.5 rounded transition-colors ${h.pinned ? "text-[#bf0f3e]" : "text-zinc-600 hover:text-zinc-300"}`}
            >
              <Pin className="w-3.5 h-3.5" fill={h.pinned ? "currentColor" : "none"} />
            </button>
            <button
              onClick={() => toggleArchive(h)}
              title={h.archived ? "Unarchive" : "Archive"}
              className="p-1.5 rounded text-zinc-600 hover:text-zinc-300 transition-colors"
            >
              <Archive className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setConfirmDelete(h.id)}
              title="Delete"
              className="p-1.5 rounded text-zinc-600 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );

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
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={startNew}
              className="ml-auto text-zinc-400 hover:text-white hover:bg-white/5 text-xs h-8"
            >
              <Plus className="w-4 h-4 mr-1" /> New question
            </Button>
          )}
        </div>
      </header>

      {/* Conversation */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-6 space-y-4">
          {messages.length === 0 && !loading && (
            <div className="py-12 max-w-xl mx-auto">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#bf0f3e]/10 mb-4">
                  <Sparkles className="w-7 h-7 text-[#bf0f3e]" />
                </div>
                <h2 className="text-xl font-semibold text-white mb-5">What data would you like me to pull?</h2>
              </div>
              {composer}

              {/* History */}
              {pinned.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2 flex items-center gap-1.5">
                    <Pin className="w-3 h-3" fill="currentColor" /> Pinned
                  </h3>
                  <div className="space-y-2">{pinned.map(renderItem)}</div>
                </div>
              )}

              {recent.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">Recent</h3>
                  <div className="space-y-2">{recent.map(renderItem)}</div>
                </div>
              )}

              {archived.length > 0 && (
                <div className="mt-6">
                  <button
                    onClick={() => setShowArchived((s) => !s)}
                    className="text-xs font-semibold uppercase tracking-wide text-zinc-600 hover:text-zinc-400 mb-2 flex items-center gap-1"
                  >
                    {showArchived ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    Archived ({archived.length})
                  </button>
                  {showArchived && <div className="space-y-2">{archived.map(renderItem)}</div>}
                </div>
              )}
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

                {/* Actions + transparency (queries run) */}
                {m.role === "assistant" && !m.error && (
                  <div className="mt-3 pt-2 border-t border-white/[0.06]">
                    <div className="flex items-center gap-4 flex-wrap">
                      <button
                        onClick={() => setReportSource({ question: messages[i - 1]?.content ?? "", answer: m.content, steps: m.steps })}
                        className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white"
                      >
                        <FileDown className="w-3.5 h-3.5" />
                        Make Report
                      </button>
                      {m.steps && m.steps.length > 0 && (
                        <button
                          onClick={() => setOpenSteps((p) => ({ ...p, [i]: !p[i] }))}
                          className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
                        >
                          {openSteps[i] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                          <Database className="w-3 h-3" />
                          {m.steps.length} quer{m.steps.length === 1 ? "y" : "ies"} run
                        </button>
                      )}
                    </div>
                    {m.steps && openSteps[i] && (
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

      {/* Composer — pinned to the bottom only while a conversation is active;
          when the screen is empty it lives up under the question instead. */}
      {(messages.length > 0 || loading) && (
        <div className="border-t border-white/[0.06] bg-[#09090b]/80 backdrop-blur-md sticky bottom-0">
          <div className="max-w-3xl mx-auto px-6 py-4">
            {composer}
            <p className="text-[11px] text-zinc-600 mt-2 text-center">Corner Coach reads your live data — it can't change anything. For figures you'll report externally, glance at the query to confirm it asked what you meant.</p>
          </div>
        </div>
      )}

      <CornerCoachReportSheet
        open={!!reportSource}
        source={reportSource}
        onClose={() => setReportSource(null)}
      />
    </div>
  );
};

export default AdminCornerCoach;
