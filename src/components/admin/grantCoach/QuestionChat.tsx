// Grant Coach, in the question (Josh, 2026-10-22): open a question and talk
// it through the way you would with Claude — which program is strongest,
// what the numbers say, "write it", "fill in the amount and total cost too".
// The answer lands in the box above; other questions on the screen fill only
// when asked. One thread per question, kept with the folder.
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check, Loader2, Send, Sparkles, Library, Vault } from "lucide-react";
import ResourcePanel from "@/components/admin/grantCoach/ResourcePanel";
import { GC_BLUE, GC_SHADE } from "@/components/admin/grantCoach/GcCard";
import { StoryDraftCard } from "@/components/admin/grantCoach/StoryBank";
import { draftWithGrantCoach, type DraftFolder, type LibraryEntry, type FunderBrief, type WriterStory } from "@/lib/grantCoach/writer";
import type { Fact } from "@/lib/grantCoach/liveFacts";
import type { StoryDraft } from "@/lib/grantCoach/stories";
import { needsFrom } from "@/lib/grantCoach/answers";
import { siblingForWriter, type SiblingContext } from "@/lib/grantCoach/sibling";
import NeedMarks from "@/components/admin/grantCoach/NeedMarks";
import DraftDiff from "@/components/admin/grantCoach/DraftDiff";

/** A Vault entry Grant Coach proposes to change (2026-10-30): the text as it stands, the new text, and whether Josh saved it. */
export interface VaultChange { key: string; label: string; before: string; after: string; why: string; saved?: boolean }
interface Msg { id: string; role: "user" | "coach"; content: string; payload: { story_draft?: StoryDraft; story_done?: boolean; /** A draft answer Grant Coach wrote; it goes to the box only when Josh clicks. */ draft?: string; draft_story_id?: string | null; draft_words?: number; /** Josh clicked Use this on it (2026-10-30): the card then shows his edits since. */ used?: boolean; vault_changes?: VaultChange[] } | null }
interface Q { id: string; section: string; label: string; detail: string | null; kind: string; answer: string | null; limit_kind?: "words" | "characters" | null; limit_value?: number | null; needs_case?: boolean }

interface Props {
  folderId: string;
  item: Q;
  /** What is in the box right now (it may not be saved yet). */
  draft: string;
  /** The other questions on the same screen, which Grant Coach fills only when asked. */
  siblings: Q[];
  /** The sister application to the same funder (2026-10-30): Grant Coach draws on it when asked. */
  sibling?: SiblingContext | null;
  folder: DraftFolder;
  library: LibraryEntry[];
  getFacts: () => Promise<Fact[]>;
  answered: () => { section: string; label: string; answer: string }[];
  funderBrief: FunderBrief | null;
  stories: WriterStory[];
  usedStoryIds: string[];
  userId: string | null;
  onAnswer: (text: string, storyId: string | null) => void;
  onFills: (fills: { id: string; answer: string }[]) => Promise<void>;
  /** Wipe this question clean: its conversation and its answer. */
  onStartOver: () => Promise<void>;
}

export default function QuestionChat({ folderId, item, draft, siblings, sibling, folder, library, getFacts, answered, funderBrief, stories, usedStoryIds, userId, onAnswer, onFills, onStartOver }: Props) {
  const qc = useQueryClient();
  const key = ["grant-chat", item.id];
  const [line, setLine] = useState("");
  const [thinking, setThinking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [resources, setResources] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const startOver = async () => {
    const { error } = await supabase.from("grant_messages" as never).delete().eq("item_id", item.id);
    if (error) { toast.error(error.message); return; }
    qc.setQueryData<Msg[]>(key, []);
    await onStartOver();
    setConfirming(false);
    toast.success("Wiped clean. Start the conversation again.");
  };
  const listRef = useRef<HTMLDivElement>(null);
  const { data: msgs = [] } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.from("grant_messages" as never).select("id, role, content, payload").eq("item_id", item.id).order("created_at");
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as Msg[];
    },
  });
  // A new reply is read from its first line (Josh, 2026-10-29: landing at the
  // bottom of a long draft card meant scrolling back up to find the note).
  // While the reviewer is thinking, the "thinking…" line is kept in view.
  useEffect(() => {
    const el = listRef.current; if (!el) return;
    if (thinking) { el.scrollTop = el.scrollHeight; return; }
    const last = el.querySelector<HTMLElement>("[data-msg]:last-of-type");
    if (last) el.scrollTop = Math.max(0, last.offsetTop - 8); else el.scrollTop = el.scrollHeight;
  }, [msgs.length, thinking]);

  const save = async (role: "user" | "coach", content: string, payload: Msg["payload"] = null) => {
    const { error } = await supabase.from("grant_messages" as never).insert({ folder_id: folderId, item_id: item.id, role, content, payload, created_by: userId } as never);
    if (error) throw new Error(error.message);
  };

  const send = async (text: string) => {
    const said = text.trim();
    if (!said || thinking) return;
    setLine("");
    setThinking(true);
    qc.setQueryData<Msg[]>(key, (old = []) => [...old, { id: `tmp-${Date.now()}`, role: "user", content: said, payload: null }]);
    try {
      await save("user", said);
      const sibs = siblings.map((q, k) => ({ i: k + 1, label: q.label, help: q.detail, kind: q.kind, answer: q.answer, limit_kind: q.limit_kind, limit_value: q.limit_value }));
      // The last draft card is the text a requested change is applied to.
      const currentDraft = [...msgs].reverse().find((m) => m.payload?.draft)?.payload?.draft ?? null;
      const res = await draftWithGrantCoach({
        mode: "chat", folder, library, facts: await getFacts(), answered: answered(), funderBrief, stories, usedStoryIds, currentDraft,
        item: { id: item.id, section: item.section, label: item.label, detail: item.detail, kind: item.kind, answer: draft.trim() || item.answer, limit_kind: item.limit_kind, limit_value: item.limit_value },
        messages: [...msgs.map((m) => ({ role: m.role, content: m.content })), { role: "user", content: said }],
        siblings: sibs,
        sibling: siblingForWriter(sibling),
      });
      // Nothing left out silently: if the reply did not say it, the list is added to it.
      const left = res.left_out ?? [];
      const reply = (res.reply ?? "Here it is.") + (left.length && !/left out/i.test(res.reply ?? "") ? `

Left out: ${left.join("; ")}` : "");
      // The draft stays in the chat until Josh says it is the answer.
      const vaultChanges: VaultChange[] = (res.vault_changes ?? []).flatMap((v) => {
        const entry = library.find((e) => e.key === v.key);
        return entry ? [{ key: v.key, label: entry.label, before: entry.value, after: v.after, why: v.why }] : [];
      });
      const payload: Msg["payload"] = {
        ...(res.story_draft ? { story_draft: res.story_draft } : {}),
        ...(res.answer ? { draft: res.answer, draft_story_id: res.story_id ?? null, draft_words: res.words } : {}),
        ...(vaultChanges.length ? { vault_changes: vaultChanges } : {}),
      };
      await save("coach", reply, Object.keys(payload ?? {}).length ? payload : null);
      if (res.fills?.length) {
        const mapped = res.fills.map((f) => ({ id: siblings[f.i - 1]?.id, answer: f.answer })).filter((f): f is { id: string; answer: string } => !!f.id);
        if (mapped.length) { await onFills(mapped); toast.success(`Filled ${mapped.length} more question${mapped.length === 1 ? "" : "s"} on this screen. Approve them when you get there.`); }
      }
    } catch (e) {
      toast.error(`Grant Coach: ${(e as Error).message}`);
    } finally {
      setThinking(false);
      qc.invalidateQueries({ queryKey: key });
    }
  };

  /** Save a proposed Vault change: the field is written, every grant reads it from now on, the card says so. */
  const saveVaultChange = async (m: Msg, idx: number) => {
    const v = m.payload?.vault_changes?.[idx];
    if (!v) return;
    const { error } = await supabase.from("grant_org_fields" as never).upsert({ key: v.key, value: v.after, updated_at: new Date().toISOString(), updated_by: userId } as never, { onConflict: "key" } as never);
    if (error) { toast.error(`Couldn't save to the Vault: ${error.message}`); return; }
    const next = m.payload!.vault_changes!.map((x, k) => (k === idx ? { ...x, saved: true } : x));
    await supabase.from("grant_messages" as never).update({ payload: { ...(m.payload ?? {}), vault_changes: next } } as never).eq("id", m.id);
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["grant-vault-raw"] });
    qc.invalidateQueries({ queryKey: ["grant-library"] });
    toast.success(`Saved to the Vault: ${v.label}. Every grant from now on reads it.`);
  };
  /** Use this: the draft goes to the answer box, and the card remembers it was used, so it can show Josh's edits from here. */
  const takeDraft = async (m: Msg) => {
    onAnswer(m.payload!.draft!, m.payload!.draft_story_id ?? null);
    if (!m.payload?.used && !m.id.startsWith("tmp-")) {
      await supabase.from("grant_messages" as never).update({ payload: { ...(m.payload ?? {}), used: true } } as never).eq("id", m.id);
      qc.invalidateQueries({ queryKey: key });
    }
  };
  const settle = async (m: Msg) => {
    await supabase.from("grant_messages" as never).update({ payload: { ...(m.payload ?? {}), story_done: true } } as never).eq("id", m.id);
    qc.invalidateQueries({ queryKey: key });
  };

  return (
    <div className="rounded-xl border-2 overflow-hidden" style={{ borderColor: GC_BLUE, backgroundColor: "#0a2238", boxShadow: `0 0 0 4px ${GC_BLUE}26, 0 16px 40px -12px ${GC_BLUE}99` }}>
      {/* The chat wears the Finance blue: a header band and a tint, so it never reads as the answer box under it. */}
      <div className="px-3 py-2 border-b flex items-center justify-between gap-2" style={{ backgroundColor: `${GC_BLUE}26`, borderColor: `${GC_BLUE}55` }}>
        <p className="text-[11px] font-black uppercase tracking-[0.18em] inline-flex items-center gap-1.5" style={{ color: GC_BLUE }}>
          <Sparkles className="w-3.5 h-3.5" /> Grant Coach · the conversation
        </p>
        <div className="flex items-center gap-3">
          {thinking ? (
            <p className="text-[11px] font-bold inline-flex items-center gap-1.5 rounded-md px-2 py-0.5" style={{ backgroundColor: GC_BLUE, color: "#0a0a0a" }}><Loader2 className="w-3.5 h-3.5 animate-spin" /> Grant Coach is working on it…</p>
          ) : (
            <p className="text-[11px] text-white/45 hidden md:block">Drafts land here · "Use this" puts one in the answer box below, where you edit</p>
          )}
          <button
            type="button"
            onClick={() => setResources(true)}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-bold ${resources ? "text-black" : "text-white/85 hover:bg-white/10"}`}
            style={resources ? { backgroundColor: GC_BLUE, borderColor: GC_BLUE } : { borderColor: `${GC_BLUE}88` }}
          >
            <Library className="w-3.5 h-3.5" /> Resources
          </button>
        </div>
      </div>
      {(msgs.length > 0 || !!draft.trim()) && (
        <div className="px-3 pt-2 flex justify-end items-center gap-2 text-[11px]">
          {confirming ? (
            <>
              <span className="text-white/60">Clear this conversation and the answer box?</span>
              <button type="button" onClick={() => void startOver()} disabled={thinking} className="font-semibold text-red-300 hover:text-red-200">Yes, start over</button>
              <button type="button" onClick={() => setConfirming(false)} className="text-white/50 hover:text-white">Keep it</button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirming(true)} disabled={thinking} className="text-white/45 hover:text-white underline underline-offset-2">Start over</button>
          )}
        </div>
      )}
      {(msgs.length > 0 || thinking) && (
        <div ref={listRef} className="relative max-h-[420px] overflow-y-auto p-3 space-y-2.5">
          {msgs.map((m, mi) => (
            <div key={m.id} data-msg className={m.role === "user" ? "flex justify-end" : "space-y-2"}>
              {m.role === "user" ? (
                <p className="max-w-[85%] rounded-xl px-3 py-1.5 text-sm text-white whitespace-pre-wrap border" style={{ backgroundColor: `${GC_BLUE}2e`, borderColor: `${GC_BLUE}55` }}>{m.content}</p>
              ) : (
                <>
                  <p className="max-w-[92%] text-sm text-white/90 whitespace-pre-wrap leading-relaxed"><span className="font-bold mr-1.5" style={{ color: GC_BLUE }}>Grant Coach</span><NeedMarks text={m.content} /></p>
                  {m.payload?.draft && (
                    <div className="max-w-[92%] rounded-lg border bg-black/40 overflow-hidden" style={{ borderColor: `${GC_BLUE}66` }}>
                      <div className="px-3 py-1.5 border-b flex items-center justify-between gap-2" style={{ borderColor: `${GC_BLUE}33`, backgroundColor: `${GC_BLUE}14` }}>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: GC_BLUE }}>Draft{m.payload.draft_words ? ` · ${m.payload.draft_words} words` : ""}<span className="ml-2 font-semibold normal-case tracking-normal text-white/40">Use this puts it in your answer box below, where you edit</span></p>
                        {draft.trim() === m.payload.draft.trim() ? (
                          <p className="text-[11px] font-semibold text-emerald-300 inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" /> In the answer box</p>
                        ) : m.payload.used ? (
                          <p className="text-[11px] font-semibold text-emerald-300 inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Used · your edits since are marked</p>
                        ) : (
                          <button type="button" onClick={() => void takeDraft(m)} className="rounded-md px-2.5 py-1 text-[11px] font-bold text-white hover:opacity-90" style={{ backgroundColor: GC_BLUE, color: "#0a0a0a" }}>
                            Use this
                          </button>
                        )}
                      </div>
                      {/* The draft is a text box, which cannot colour its own words — so the
                          [NEED] notes are called out in red above it (Josh, 2026-10-28). */}
                      {needsFrom(m.payload.draft) && (
                        <p className="px-3 py-1.5 text-[12px] font-bold text-red-300 bg-red-500/10 border-b border-red-500/30">{needsFrom(m.payload.draft)}</p>
                      )}
                      {/* The change against the answer as it stands: added words amber, removed words struck (Josh, 2026-10-29). */}
                      {(() => {
                        // Used: what Josh changed since (the answer against the draft). Unused: what changed from the
                        // previous draft card — the text a requested change was applied to (Josh, 2026-10-30) — or,
                        // when there is no earlier card, what Use this would change in the answer box.
                        const current = draft.trim() || item.answer || "";
                        const prevDraft = [...msgs.slice(0, mi)].reverse().find((x) => x.payload?.draft)?.payload?.draft ?? "";
                        const used = !!m.payload!.used && current.trim() !== m.payload!.draft!.trim();
                        const before = used ? m.payload!.draft! : prevDraft || current;
                        const after = used ? current : m.payload!.draft!;
                        const vsPrev = !used && !!prevDraft;
                        const differsNow = before.replace(/\s+/g, " ").trim() !== after.replace(/\s+/g, " ").trim();
                        return (
                          <>
                            {differsNow && before.trim() && (
                              <p className="px-3 pt-1.5 text-[10px] text-white/40">
                                {used ? <><mark className="rounded-sm px-0.5 bg-amber-400/35 text-amber-50">amber</mark> = what you added since · <del className="text-white/35">struck</del> = what you removed</> : vsPrev ? <><mark className="rounded-sm px-0.5 bg-amber-400/35 text-amber-50">amber</mark> = what changed from the previous draft · <del className="text-white/35">struck</del> = what came out</> : <><mark className="rounded-sm px-0.5 bg-amber-400/35 text-amber-50">amber</mark> = what this draft adds to your answer · <del className="text-white/35">struck</del> = what it removes</>}
                              </p>
                            )}
                            <DraftDiff before={before} after={after} className="px-3 py-2 text-sm text-white whitespace-pre-wrap leading-relaxed" />
                          </>
                        );
                      })()}
                    </div>
                  )}
                  {m.payload?.vault_changes?.map((v, idx) => (
                    <div key={v.key} className="max-w-[92%] rounded-lg border bg-black/40 overflow-hidden" style={{ borderColor: "#fbbf2466" }}>
                      <div className="px-3 py-1.5 border-b flex items-center justify-between gap-2" style={{ borderColor: "#fbbf2433", backgroundColor: "#fbbf2414" }}>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300 inline-flex items-center gap-1.5"><Vault className="w-3.5 h-3.5" /> Vault change · {v.label}</p>
                        {v.saved ? (
                          <p className="text-[11px] font-semibold text-emerald-300 inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Saved · in the Vault</p>
                        ) : (
                          <button type="button" onClick={() => void saveVaultChange(m, idx)} className="rounded-md px-2.5 py-1 text-[11px] font-bold hover:opacity-90" style={{ backgroundColor: "#fbbf24", color: "#0a0a0a" }}>Save to the Vault</button>
                        )}
                      </div>
                      {v.why && <p className="px-3 pt-2 text-[12px] text-white/55">{v.why}</p>}
                      <DraftDiff before={v.before} after={v.after} className="px-3 py-2 text-sm text-white whitespace-pre-wrap leading-relaxed" />
                    </div>
                  ))}
                  {m.payload?.story_draft && !m.payload.story_done && (
                    <StoryDraftCard draft={m.payload.story_draft} folderId={folderId} onSaved={() => void settle(m)} onDismiss={() => void settle(m)} />
                  )}
                </>
              )}
            </div>
          ))}
          {thinking && <p className="text-sm text-white/50 inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" style={{ color: GC_BLUE }} /> Grant Coach is thinking…</p>}
        </div>
      )}
      <ResourcePanel open={resources} onOpenChange={setResources} stories={stories} />
      <div className="p-3 flex gap-2 items-end">
        {/* Room to see whole paragraphs while typing; the box grows with the text. */}
        <div className="flex-1 min-w-0">
          <Textarea
            ref={inputRef}
            value={line}
            onChange={(e) => {
              setLine(e.target.value);
              e.currentTarget.style.height = "auto";
              e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 560)}px`;
            }}
            // Enter is a new paragraph (Josh, 2026-10-24: paste a whole answer with its paragraphs); Ctrl+Enter sends.
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void send(line); } }}
            rows={8}
            disabled={thinking}
            placeholder={thinking ? "Grant Coach is working on it…" : "Ask Grant Coach anything about this question, or say “write it”…"}
            className="min-h-[200px] max-h-[560px] bg-black/50 text-white text-base leading-relaxed resize-y"
            style={{ borderColor: `${GC_BLUE}66` }}
          />
          <p className="mt-1 text-[11px] text-white/35">Enter for a new paragraph · Ctrl+Enter or the arrow sends</p>
        </div>
        <Button onClick={() => void send(line)} disabled={thinking || !line.trim()} className="font-bold shrink-0 mb-5" style={{ backgroundColor: GC_BLUE, color: "#0a0a0a" }} aria-label="Send"><Send className="w-4 h-4" /></Button>
      </div>
    </div>
  );
}
