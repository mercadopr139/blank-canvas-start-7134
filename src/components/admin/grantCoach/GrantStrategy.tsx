// Grant Coach — the strategy session (Josh, 2026-10-22).
//
// Before any story question is answered (program name, purpose, need,
// outcomes, amount, dates), Josh and Grant Coach decide WHAT NLA proposes.
// Grant Coach opens the session prepared — two or three program options, each
// with the proof from the back end and the weak spots a reviewer will poke —
// then argues it through with Josh and proposes the case. Josh locks the case;
// every story answer after it is written from it.
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Loader2, Send, Lock, Compass, Check, Pencil, AlertTriangle } from "lucide-react";
import GcCard, { GC_BLUE } from "@/components/admin/grantCoach/GcCard";
import { strategyTurn, type CaseBrief, type StrategyOption, type DraftFolder, type LibraryEntry, type ChatMessage, type FunderBrief } from "@/lib/grantCoach/writer";
import type { Fact } from "@/lib/grantCoach/liveFacts";
import { loadStories, usableStories, type StoryDraft } from "@/lib/grantCoach/stories";
import { StoryDraftCard } from "@/components/admin/grantCoach/StoryBank";

interface Msg { id: string; role: "user" | "coach"; content: string; created_at: string; payload: { options?: StrategyOption[]; case?: CaseBrief; story_draft?: StoryDraft; story_done?: boolean } | null }

interface Props {
  folderId: string;
  folder: DraftFolder;
  library: LibraryEntry[];
  getFacts: () => Promise<Fact[]>;
  answered: () => { section: string; label: string; answer: string }[];
  waiting: { label: string; help: string | null; kind: string; limit_kind?: string | null; limit_value?: number | null }[];
  caseBrief: CaseBrief | null;
  caseLockedAt: string | null;
  userId: string | null;
  onLock: (c: CaseBrief) => Promise<void>;
  funderBrief: FunderBrief | null;
}

const money = (n: number | null) => (n == null ? "" : `$${Number(n).toLocaleString()}`);
const sameCase = (a: CaseBrief | null, b: CaseBrief | null) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export default function GrantStrategy({ folderId, folder, library, getFacts, answered, waiting, caseBrief, caseLockedAt, userId, onLock, funderBrief }: Props) {
  const qc = useQueryClient();
  const locked = !!caseBrief && !!caseLockedAt;
  const [open, setOpen] = useState(!locked);
  const [line, setLine] = useState("");
  const [thinking, setThinking] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  const key = ["grant-strategy", folderId];
  const { data: stories = [] } = useQuery({ queryKey: ["grant-stories"], queryFn: loadStories });
  /** A story offered in the session is settled (saved or dismissed): it stops asking. */
  const settleStory = async (m: Msg) => {
    await supabase.from("grant_messages" as never).update({ payload: { ...(m.payload ?? {}), story_done: true } } as never).eq("id", m.id);
    qc.invalidateQueries({ queryKey: key });
  };
  const { data: msgs = [], isSuccess } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.from("grant_messages" as never).select("id, role, content, created_at, payload").eq("folder_id", folderId).is("item_id", null).order("created_at");
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as Msg[];
    },
  });

  const save = async (role: "user" | "coach", content: string, payload?: Msg["payload"]) => {
    const { error } = await supabase.from("grant_messages" as never).insert({ folder_id: folderId, item_id: null, role, content, payload: payload ?? null, created_by: userId } as never);
    if (error) throw new Error(error.message);
  };

  /** One turn: what Josh said (or nothing, to open the session), and Grant Coach's answer. */
  const turn = async (said: string | null) => {
    if (thinking) return;
    setThinking(true);
    try {
      if (said) await save("user", said);
      const history: ChatMessage[] = [...msgs.map((m) => ({ role: m.role, content: m.content })), ...(said ? [{ role: "user" as const, content: said }] : [])];
      qc.setQueryData<Msg[]>(key, (old = []) => said ? [...old, { id: `tmp-${Date.now()}`, role: "user", content: said, created_at: new Date().toISOString(), payload: null }] : old);
      const res = await strategyTurn({ folder, library, facts: await getFacts(), answered: answered(), messages: history, waiting, caseBrief, stories: usableStories(stories), funderBrief });
      await save("coach", res.reply, res.options || res.case || res.story_draft ? { options: res.options, case: res.case, story_draft: res.story_draft } : null);
    } catch (e) {
      toast.error(`Grant Coach: ${(e as Error).message}`);
    } finally {
      setThinking(false);
      qc.invalidateQueries({ queryKey: key });
    }
  };

  // Grant Coach opens the session itself, prepared — the first time it is opened.
  const opened = useRef(false);
  useEffect(() => {
    if (!open || !isSuccess || opened.current || msgs.length > 0 || waiting.length === 0) return;
    opened.current = true;
    void turn(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isSuccess, msgs.length, waiting.length]);

  useEffect(() => { bottom.current?.scrollIntoView({ block: "nearest" }); }, [msgs.length, thinking]);

  const send = () => { const t = line.trim(); if (!t) return; setLine(""); void turn(t); };
  const latestCase = [...msgs].reverse().find((m) => m.payload?.case)?.payload?.case ?? null;

  return (
    <GcCard
      icon={<Compass className="w-4 h-4" />}
      title="Strategy session"
      blurb={locked
        ? `Case locked · ${caseBrief!.program_name}${waiting.length ? ` · ${waiting.length} story question${waiting.length === 1 ? "" : "s"} being written from it` : ""}`
        : `${waiting.length} story question${waiting.length === 1 ? "" : "s"} wait${waiting.length === 1 ? "s" : ""} for this · pick the program, build the case`}
      open={open}
      onToggle={() => setOpen((o) => !o)}
      right={locked ? <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-emerald-300"><Lock className="w-3.5 h-3.5" /> Locked</span> : undefined}
    >
      <div className="p-4 space-y-4">
        {locked && <CaseView c={caseBrief!} />}

        <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1">
          {msgs.map((m) => (
            <div key={m.id} className={m.role === "user" ? "flex justify-end" : ""}>
              {m.role === "user" ? (
                <p className="max-w-[85%] rounded-xl bg-white/[0.07] px-3 py-2 text-sm text-white whitespace-pre-wrap">{m.content}</p>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-xl border px-3 py-2.5" style={{ borderColor: `${GC_BLUE}40`, background: "#0f243380" }}>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] mb-1" style={{ color: GC_BLUE }}>Grant Coach</p>
                    <p className="text-sm text-white/90 whitespace-pre-wrap leading-relaxed">{m.content}</p>
                  </div>
                  {m.payload?.options?.length ? (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {m.payload.options.map((o) => (
                        <OptionCard key={o.program} o={o} disabled={thinking} onPick={() => void turn(`Let's go with ${o.program}.`)} />
                      ))}
                    </div>
                  ) : null}
                  {m.payload?.story_draft && !m.payload.story_done && (
                    <StoryDraftCard
                      draft={m.payload.story_draft}
                      raw={[...msgs].slice(0, msgs.indexOf(m)).reverse().find((x) => x.role === "user")?.content ?? null}
                      folderId={folderId}
                      onSaved={() => void settleStory(m)}
                      onDismiss={() => void settleStory(m)}
                    />
                  )}
                  {m.payload?.case && m.payload.case === latestCase && !sameCase(m.payload.case, locked ? caseBrief : null) && (
                    <CaseProposal c={m.payload.case} relock={locked} onLock={onLock} />
                  )}
                </div>
              )}
            </div>
          ))}
          {thinking && (
            <p className="text-sm text-white/55 inline-flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" style={{ color: GC_BLUE }} />
              {msgs.length === 0 ? "Grant Coach is reviewing your programs against this funder and pulling the numbers…" : "Grant Coach is thinking…"}
            </p>
          )}
          {msgs.length === 0 && !thinking && waiting.length === 0 && (
            <p className="text-sm text-white/45">No story questions yet. When a screen asks for the program, the purpose or the outcomes, Grant Coach opens this session.</p>
          )}
          <div ref={bottom} />
        </div>

        <div className="flex gap-2 items-end">
          <Textarea
            value={line}
            onChange={(e) => setLine(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            rows={2}
            placeholder="Ask anything — which program is strongest, what the numbers say, tell it a story…"
            className="bg-neutral-950 border-white/15 text-white text-sm"
          />
          <Button onClick={send} disabled={thinking || !line.trim()} className="text-white shrink-0" style={{ backgroundColor: "#bf0f3e" }} aria-label="Send">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </GcCard>
  );
}

function OptionCard({ o, disabled, onPick }: { o: StrategyOption; disabled: boolean; onPick: () => void }) {
  return (
    <div className="rounded-xl border border-white/12 bg-black/40 p-3 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <p className="font-bold text-white leading-tight">{o.program}</p>
        <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: `${GC_BLUE}22`, color: GC_BLUE }}>Fit {o.fit}/10</span>
      </div>
      <p className="text-[13px] text-white/70">{o.why}</p>
      {o.proof?.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-300/80">The proof</p>
          <ul className="mt-0.5 space-y-0.5">{o.proof.map((p) => <li key={p} className="text-[12px] text-white/80 flex gap-1.5"><Check className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-400" />{p}</li>)}</ul>
        </div>
      )}
      {o.weak_spots?.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-amber-300/80">What a reviewer will poke</p>
          <ul className="mt-0.5 space-y-0.5">{o.weak_spots.map((p) => <li key={p} className="text-[12px] text-white/70 flex gap-1.5"><AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-300" />{p}</li>)}</ul>
        </div>
      )}
      <Button size="sm" onClick={onPick} disabled={disabled} variant="outline" className="mt-auto bg-transparent border-white/20 text-white hover:bg-white/10">Go with this</Button>
    </div>
  );
}

/** The case, read-only: what every story answer is written from. */
function CaseView({ c }: { c: CaseBrief }) {
  return (
    <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/[0.04] p-4 space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-300">The case · every story answer is written from this</p>
      <p className="text-lg font-bold text-white">{c.program_name}</p>
      <p className="text-sm text-white/85 italic">{c.pitch}</p>
      <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2 text-[13px]">
        {c.ask_amount != null && <p><span className="text-white/45">Ask:</span> {money(c.ask_amount)}</p>}
        {c.total_cost != null && <p><span className="text-white/45">Total cost:</span> {money(c.total_cost)}</p>}
        {(c.start_date || c.end_date) && <p><span className="text-white/45">Dates:</span> {c.start_date} – {c.end_date}</p>}
        {c.service_frequency && <p><span className="text-white/45">Frequency:</span> {c.service_frequency}</p>}
      </div>
      <p className="text-[13px]"><span className="text-white/45">The money pays for:</span> {c.what_the_money_pays_for}</p>
      <p className="text-[13px]"><span className="text-white/45">Who is served:</span> {c.who_is_served}</p>
      {c.proof_points?.length > 0 && <ul className="text-[13px] space-y-0.5">{c.proof_points.map((p) => <li key={p} className="flex gap-1.5"><Check className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-400" />{p}</li>)}</ul>}
      {c.outcomes?.length > 0 && <div><p className="text-[11px] text-white/45">Outcomes</p><ul className="text-[13px] space-y-0.5">{c.outcomes.map((p) => <li key={p}>• {p}</li>)}</ul></div>}
      {c.story && <p className="text-[13px]"><span className="text-white/45">The story:</span> {c.story}</p>}
    </div>
  );
}

/** A proposed case: edit any line, then lock it. */
function CaseProposal({ c, relock, onLock }: { c: CaseBrief; relock: boolean; onLock: (c: CaseBrief) => Promise<void> }) {
  const [d, setD] = useState<CaseBrief>(c);
  const [editing, setEditing] = useState(false);
  const [locking, setLocking] = useState(false);
  useEffect(() => setD(c), [c]);
  const lines = (v: string) => v.split("\n").map((x) => x.trim()).filter(Boolean);
  const num = (v: string) => { const n = Number(v.replace(/[^0-9.]/g, "")); return v.trim() && Number.isFinite(n) ? n : null; };
  const lock = async () => { setLocking(true); try { await onLock(d); } finally { setLocking(false); } };

  return (
    <div className="rounded-xl border-2 p-4 space-y-3" style={{ borderColor: `${GC_BLUE}80` }}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: GC_BLUE }}>{relock ? "A revised case" : "The proposed case"}</p>
        <button type="button" onClick={() => setEditing((e) => !e)} className="text-[12px] text-white/55 hover:text-white inline-flex items-center gap-1"><Pencil className="w-3.5 h-3.5" /> {editing ? "Done editing" : "Edit"}</button>
      </div>
      {editing ? (
        <div className="space-y-2 text-sm">
          <Field label="Program / project name"><Input value={d.program_name} onChange={(e) => setD({ ...d, program_name: e.target.value })} className="bg-neutral-950 border-white/15 text-white" /></Field>
          <Field label="The pitch (one sentence)"><Textarea rows={2} value={d.pitch} onChange={(e) => setD({ ...d, pitch: e.target.value })} className="bg-neutral-950 border-white/15 text-white" /></Field>
          <Field label="What the money pays for"><Textarea rows={2} value={d.what_the_money_pays_for} onChange={(e) => setD({ ...d, what_the_money_pays_for: e.target.value })} className="bg-neutral-950 border-white/15 text-white" /></Field>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Amount requested ($)"><Input value={d.ask_amount ?? ""} onChange={(e) => setD({ ...d, ask_amount: num(e.target.value) })} className="bg-neutral-950 border-white/15 text-white" /></Field>
            <Field label="Total program cost ($)"><Input value={d.total_cost ?? ""} onChange={(e) => setD({ ...d, total_cost: num(e.target.value) })} className="bg-neutral-950 border-white/15 text-white" /></Field>
            <Field label="Start date"><Input type="date" value={d.start_date ?? ""} onChange={(e) => setD({ ...d, start_date: e.target.value || null })} className="bg-neutral-950 border-white/15 text-white" /></Field>
            <Field label="End date"><Input type="date" value={d.end_date ?? ""} onChange={(e) => setD({ ...d, end_date: e.target.value || null })} className="bg-neutral-950 border-white/15 text-white" /></Field>
          </div>
          <Field label="Service frequency"><Input value={d.service_frequency ?? ""} onChange={(e) => setD({ ...d, service_frequency: e.target.value || null })} className="bg-neutral-950 border-white/15 text-white" /></Field>
          <Field label="Who is served"><Textarea rows={2} value={d.who_is_served} onChange={(e) => setD({ ...d, who_is_served: e.target.value })} className="bg-neutral-950 border-white/15 text-white" /></Field>
          <Field label="Proof points (one per line)"><Textarea rows={4} value={d.proof_points.join("\n")} onChange={(e) => setD({ ...d, proof_points: lines(e.target.value) })} className="bg-neutral-950 border-white/15 text-white" /></Field>
          <Field label="Outcomes and targets (one per line)"><Textarea rows={3} value={d.outcomes.join("\n")} onChange={(e) => setD({ ...d, outcomes: lines(e.target.value) })} className="bg-neutral-950 border-white/15 text-white" /></Field>
          <Field label="The story (first names only)"><Textarea rows={3} value={d.story ?? ""} onChange={(e) => setD({ ...d, story: e.target.value || null })} className="bg-neutral-950 border-white/15 text-white" /></Field>
        </div>
      ) : (
        <CaseView c={d} />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => void lock()} disabled={locking || !d.program_name.trim()} className="bg-emerald-700 hover:bg-emerald-600 text-white">
          {locking ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Lock className="w-4 h-4 mr-1.5" />} {relock ? "Lock the revised case" : "Lock the case and write the answers"}
        </Button>
        <span className="text-[12px] text-white/45">Or keep talking — ask for changes and Grant Coach revises it.</span>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-[11px] text-white/50">{label}</span>{children}</label>;
}
