// Spiritual Coach Intelligence — every saved Scripture Coach session, and the
// supervision workflow around it.
//
// A session is a record of a real conversation with a child, so it doesn't
// stand on one person's word. Every session is signed off by someone other
// than the mentor who ran it (enforced in the database, not just here), and a
// signed-off session locks — only a reviewer can reopen it.
//
// Two comment fields that must never be confused:
//   Journal notes   — written by the mentor who ran the session.
//   Review comments — written by the reviewer, and by nobody else.
//
// Plan: docs/SCRIPTURE_COACH_PLAN.md
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Search, FileDown, Trash2, Plus, AlertTriangle, BellRing, ShieldCheck,
  MessageCircleMore, Loader2, BookOpen, Lock, Undo2, CheckCircle2, RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import {
  NLA_RED, COUNSELOR_LINE, REVIEW_LABELS, ScriptureSession, ReviewStatus,
  sentenceCase, buildSessionPdf, sessionPdfFilename,
} from "@/lib/scriptureCoach";

type Filter = "all" | "awaiting" | "mine_to_review" | "follow_up" | "counselor";

const REVIEWER_PERM = "operations_scripture_coach_reviewer";

const AdminScriptureCoachIntelligence = () => {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hasPermission } = useStaffPermissions();
  const isReviewer = hasPermission(REVIEWER_PERM);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ScriptureSession | null>(null);

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["scripture-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scripture_sessions" as never)
        .select("*")
        .order("session_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ScriptureSession[];
    },
  });

  const updateSession = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<ScriptureSession> }) => {
      const { error } = await supabase
        .from("scripture_sessions" as never)
        .update(patch as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scripture-sessions"] }),
    // The database enforces the review rules, so its message is the useful one
    // ("A session must be reviewed by someone other than the mentor who ran it").
    onError: (e: Error) => toast.error(e.message || "Couldn't save that change."),
  });

  const deleteSession = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("scripture_sessions" as never)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Session deleted");
      setConfirmDelete(null);
      setOpenId(null);
      qc.invalidateQueries({ queryKey: ["scripture-sessions"] });
    },
    onError: (e: Error) => toast.error(e.message || "Couldn't delete."),
  });

  // Each session's place in that youth's thread — "Session 2 of 3" — plus
  // the sibling sessions, so a mentor can read the whole story.
  const threads = useMemo(() => {
    const byYouth = new Map<string, ScriptureSession[]>();
    for (const s of sessions) {
      const key = s.registration_id ?? `name:${s.youth_name}`;
      if (!byYouth.has(key)) byYouth.set(key, []);
      byYouth.get(key)!.push(s);
    }
    const seq = new Map<string, { index: number; total: number; siblings: ScriptureSession[] }>();
    for (const list of byYouth.values()) {
      // Oldest first, so session 1 is the first conversation.
      const ordered = [...list].sort((a, b) =>
        a.session_date === b.session_date
          ? a.created_at.localeCompare(b.created_at)
          : a.session_date.localeCompare(b.session_date)
      );
      ordered.forEach((s, i) =>
        seq.set(s.id, { index: i + 1, total: ordered.length, siblings: ordered })
      );
    }
    return seq;
  }, [sessions]);

  const live = openId ? sessions.find((s) => s.id === openId) ?? null : null;

  /** Nobody signs off their own session — the point of the whole workflow. */
  const canReview = (s: ScriptureSession) => isReviewer && s.coach_id !== user?.id;
  const isMineToReview = (s: ScriptureSession) =>
    canReview(s) && s.review_status !== "reviewed";

  const filtered = useMemo(() => {
    let list = sessions;
    if (filter === "awaiting") list = list.filter((s) => s.review_status !== "reviewed");
    if (filter === "mine_to_review") list = list.filter(isMineToReview);
    if (filter === "follow_up") list = list.filter((s) => s.follow_up_needed);
    if (filter === "counselor") list = list.filter((s) => s.nikki_notified === true);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (s) =>
          s.youth_name.toLowerCase().includes(q) ||
          s.topic.toLowerCase().includes(q) ||
          (s.notes || "").toLowerCase().includes(q)
      );
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, filter, search, isReviewer, user?.id]);

  const stats = useMemo(
    () => ({
      total: sessions.length,
      awaiting: sessions.filter((s) => s.review_status !== "reviewed").length,
      mine: sessions.filter(isMineToReview).length,
      followUp: sessions.filter((s) => s.follow_up_needed).length,
      counselor: sessions.filter((s) => s.nikki_notified === true).length,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessions, isReviewer, user?.id]
  );

  const downloadPdf = (session: ScriptureSession) => {
    try {
      buildSessionPdf(session).save(sessionPdfFilename(session));
    } catch {
      toast.error("Couldn't build the PDF.");
    }
  };

  const patch = (id: string, p: Partial<ScriptureSession>) =>
    updateSession.mutate({ id, patch: p });

  const setStatus = (s: ScriptureSession, status: ReviewStatus) => {
    patch(s.id, {
      review_status: status,
      // The trigger stamps reviewed_by / reviewed_at itself; the display name
      // is the one thing it can't derive.
      reviewed_by_name: status === "reviewed" ? user?.email ?? null : null,
    });
    toast.success(
      status === "reviewed"
        ? "Session reviewed and locked"
        : status === "changes_requested"
        ? "Sent back to the mentor"
        : "Session reopened"
    );
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto text-white">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-white">Spiritual Coach Intelligence</h2>
          <p className="text-sm text-neutral-400 mt-1">
            Every conversation, and what still needs attention.
          </p>
        </div>
        <Button
          onClick={() => navigate("/admin/operations/scripture-coach")}
          className="text-white font-semibold"
          style={{ backgroundColor: NLA_RED }}
        >
          <Plus className="w-4 h-4 mr-1.5" /> New session
        </Button>
      </div>

      {/* Each tile is also the filter for what it counts */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatTile label="Sessions" value={stats.total}
          active={filter === "all"} onClick={() => setFilter("all")} />
        <StatTile label="Awaiting review" value={stats.awaiting} tone="amber"
          active={filter === "awaiting"} onClick={() => setFilter("awaiting")} />
        {isReviewer && (
          <StatTile label="Awaiting my review" value={stats.mine} tone="violet"
            active={filter === "mine_to_review"} onClick={() => setFilter("mine_to_review")} />
        )}
        <StatTile label="Need follow-up" value={stats.followUp} tone="sky"
          active={filter === "follow_up"} onClick={() => setFilter("follow_up")} />
        <StatTile label="Nikki notified" value={stats.counselor} tone="red"
          active={filter === "counselor"} onClick={() => setFilter("counselor")} />
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-500" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search youth, topic, or notes..."
          className="pl-9 bg-neutral-900 border-neutral-800 text-white"
        />
      </div>

      {isLoading ? (
        <p className="text-neutral-500 text-sm text-center py-16">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 rounded-xl border border-neutral-800 bg-neutral-900/40">
          <BookOpen className="w-8 h-8 text-neutral-700 mx-auto mb-3" />
          <p className="text-neutral-400 text-sm">
            {sessions.length === 0
              ? "No sessions yet. Start one from Scripture Coach."
              : "Nothing matches that filter."}
          </p>
          {filter !== "all" && sessions.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setFilter("all")}
              className="mt-3 text-neutral-400 hover:text-white">
              Show all sessions
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => (
            <button
              key={s.id}
              onClick={() => setOpenId(s.id)}
              className={`w-full text-left p-4 rounded-xl border transition-colors ${
                isMineToReview(s)
                  ? "bg-violet-500/[0.06] border-violet-500/30 hover:border-violet-500/50"
                  : "bg-neutral-900 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800/50"
              }`}
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-white font-semibold">{s.youth_name}</p>
                    <span className="text-xs text-neutral-500">
                      {format(parseISO(s.session_date), "MMM d, yyyy")}
                    </span>
                    {s.coach_name && (
                      <span className="text-xs text-neutral-600">· {s.coach_name}</span>
                    )}
                  </div>
                  <p className="text-sm text-neutral-300 mt-1 line-clamp-1">{s.topic}</p>
                  {s.notes && (
                    <p className="text-xs text-neutral-500 mt-1 line-clamp-1">{s.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                  <ReviewBadge session={s} />
                  {s.follow_up_needed && (
                    <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px]">
                      <MessageCircleMore className="w-3 h-3 mr-1" /> Follow up
                    </Badge>
                  )}
                  {s.parents_notified === false && (
                    <Badge className="bg-sky-500/15 text-sky-400 border-sky-500/30 text-[10px]">
                      <BellRing className="w-3 h-3 mr-1" /> Parents
                    </Badge>
                  )}
                  {s.nikki_notified === true && (
                    <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-[10px]">
                      <AlertTriangle className="w-3 h-3 mr-1" /> Nikki notified
                    </Badge>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Centred so it reads like a document, not a drawer */}
      <Dialog open={!!live} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="bg-neutral-950 border-neutral-800 text-white max-w-3xl max-h-[88vh] overflow-y-auto">
          {live && (
            <SessionDetail
              session={live}
              thread={threads.get(live.id)}
              onOpenSession={setOpenId}
              onFollowUp={() =>
                navigate(
                  `/admin/operations/scripture-coach?youth=${live.registration_id ?? ""}`
                )
              }
              canReview={canReview(live)}
              isReviewer={isReviewer}
              onPatch={(p) => patch(live.id, p)}
              onStatus={(st) => setStatus(live, st)}
              onPdf={() => downloadPdf(live)}
              onDelete={() => setConfirmDelete(live)}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent className="bg-neutral-900 border-neutral-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this session?</AlertDialogTitle>
            <AlertDialogDescription className="text-neutral-400">
              This permanently removes the record of the conversation with{" "}
              <span className="text-white font-medium">{confirmDelete?.youth_name}</span> on{" "}
              {confirmDelete && format(parseISO(confirmDelete.session_date), "MMMM d, yyyy")}.
              Download the PDF first if you need a copy — this can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-neutral-700 text-white hover:bg-white/5">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && deleteSession.mutate(confirmDelete.id)}
              disabled={deleteSession.isPending}
              className="bg-red-600 hover:bg-red-500 text-white"
            >
              {deleteSession.isPending ? (
                <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Deleting…</>
              ) : (
                "Delete permanently"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// ── Detail ───────────────────────────────────────────────────────────
const SessionDetail = ({
  session, thread, onOpenSession, onFollowUp,
  canReview, isReviewer, onPatch, onStatus, onPdf, onDelete,
}: {
  session: ScriptureSession;
  thread?: { index: number; total: number; siblings: ScriptureSession[] };
  onOpenSession: (id: string) => void;
  onFollowUp: () => void;
  canReview: boolean;
  isReviewer: boolean;
  onPatch: (p: Partial<ScriptureSession>) => void;
  onStatus: (s: ReviewStatus) => void;
  onPdf: () => void;
  onDelete: () => void;
}) => {
  const locked = session.review_status === "reviewed";
  // Once signed off, the record is frozen for everyone but a reviewer — that
  // is what makes the sign-off mean something.
  const canEdit = !locked || isReviewer;
  const usedPassages = (session.passages || []).filter((p) => p.used);

  return (
    <>
      <DialogHeader className="text-left">
        <DialogTitle className="text-white text-lg flex items-center gap-2 flex-wrap">
          {session.youth_name}
          <ReviewBadge session={session} />
        </DialogTitle>
        <p className="text-xs text-neutral-500">
          {thread && thread.total > 1 && (
            <span className="text-sky-400 font-medium">
              Session {thread.index} of {thread.total} ·{" "}
            </span>
          )}
          {format(parseISO(session.session_date), "EEEE, MMMM d, yyyy")}
          {session.coach_name ? ` · Session by ${session.coach_name}` : ""}
        </p>
      </DialogHeader>

      <div className="mt-4 space-y-5">
        {locked && (
          <div className="flex items-start gap-2.5 rounded-lg border border-green-500/30 bg-green-500/[0.07] p-3">
            <ShieldCheck className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="text-green-300 font-medium">
                Reviewed by {session.reviewed_by_name || "a reviewer"}
                {session.reviewed_at &&
                  ` on ${format(parseISO(session.reviewed_at), "MMMM d, yyyy")}`}
              </p>
              <p className="text-green-100/60 text-xs mt-0.5">
                This record is locked. Only a reviewer can reopen it.
              </p>
            </div>
          </div>
        )}

        {session.review_status === "changes_requested" && (
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/[0.07] p-3">
            <RotateCcw className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-200">
              A reviewer sent this back. See the review comments below.
            </p>
          </div>
        )}

        <Field label="What they brought up">
          <p className="text-[15px] text-white leading-relaxed">{session.topic}</p>
        </Field>

        {/* The rest of this youth's thread. Each conversation is its own
            record — this is what stitches them back into one story. */}
        {thread && thread.total > 1 && (
          <Field label={`All conversations with ${session.youth_name}`}>
            <div className="rounded-lg border border-neutral-800 divide-y divide-neutral-800 overflow-hidden">
              {thread.siblings.map((sib, i) => {
                const current = sib.id === session.id;
                return (
                  <button
                    key={sib.id}
                    type="button"
                    disabled={current}
                    onClick={() => onOpenSession(sib.id)}
                    className={`w-full flex items-start gap-3 p-2.5 text-left transition-colors ${
                      current
                        ? "bg-sky-500/10 cursor-default"
                        : "bg-neutral-900 hover:bg-neutral-800"
                    }`}
                  >
                    <span
                      className={`font-mono text-[11px] mt-0.5 shrink-0 ${
                        current ? "text-sky-300" : "text-neutral-600"
                      }`}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13px] text-neutral-200 line-clamp-1">
                        {sib.topic}
                      </span>
                      <span className="block text-[11px] text-neutral-500 mt-0.5">
                        {format(parseISO(sib.session_date), "MMM d, yyyy")}
                        {current && " · you're reading this one"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Field>
        )}

        {usedPassages.length > 0 && (
          <Field label="Scripture walked through">
            <div className="space-y-3">
              {usedPassages.map((p) => (
                <div key={p.ref} className="rounded-lg bg-neutral-900 border border-neutral-800 p-3">
                  <p className="text-white font-bold text-sm">{p.ref}</p>
                  <blockquote
                    className="mt-2 pl-3 border-l-2 font-serif text-[15px] leading-[1.7] text-neutral-100"
                    style={{ borderColor: `${NLA_RED}66` }}
                  >
                    {p.esv_text.replace(/\s+/g, " ").trim()}
                  </blockquote>
                  {p.context && (
                    <p className="mt-2 text-xs text-neutral-500 leading-relaxed">{p.context}</p>
                  )}
                </div>
              ))}
            </div>
          </Field>
        )}

        {session.prayer_points?.length > 0 && (
          <Field label="Prayed for">
            <ul className="space-y-1.5">
              {session.prayer_points.map((p, i) => (
                <li key={i} className="flex gap-2 text-sm text-neutral-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-neutral-600 mt-1.5 shrink-0" />
                  {sentenceCase(p)}
                </li>
              ))}
            </ul>
          </Field>
        )}

        <Field label={`Journal notes — by ${session.coach_name || "the mentor"}`}>
          <Textarea
            key={`notes-${session.id}-${session.updated_at}`}
            defaultValue={session.notes || ""}
            disabled={!canEdit}
            onBlur={(e) => {
              const v = e.target.value.trim() || null;
              if (v !== (session.notes || null)) onPatch({ notes: v });
            }}
            placeholder="No notes were written."
            className="min-h-[110px] bg-neutral-900 border-neutral-800 text-white disabled:opacity-60"
          />
          {locked && !isReviewer && (
            <p className="flex items-center gap-1.5 text-[11px] text-neutral-500 mt-1.5">
              <Lock className="w-3 h-3" /> Locked after review.
            </p>
          )}
        </Field>

        {/* Reviewer's field, and visibly so — a different colour, its own
            label, and read-only for everyone else. */}
        <div className="rounded-xl border border-violet-500/30 bg-violet-500/[0.05] p-4">
          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
            <p className="text-[10px] uppercase tracking-[0.15em] text-violet-300 font-semibold">
              Review comments
            </p>
            <Badge className="bg-violet-500/15 text-violet-300 border-violet-500/30 text-[10px]">
              Reviewer only
            </Badge>
          </div>
          <Textarea
            key={`review-${session.id}-${session.updated_at}`}
            defaultValue={session.review_comments || ""}
            disabled={!canReview}
            onBlur={(e) => {
              const v = e.target.value.trim() || null;
              if (v !== (session.review_comments || null)) onPatch({ review_comments: v });
            }}
            placeholder={
              canReview
                ? "Your comments as reviewer…"
                : "Only a reviewer can write here."
            }
            className="min-h-[90px] bg-neutral-950 border-violet-500/20 text-white disabled:opacity-70"
          />
          {!canReview && !isReviewer && (
            <p className="text-[11px] text-violet-300/60 mt-1.5">
              Written by the reviewer, not by the mentor who ran the session.
            </p>
          )}
          {isReviewer && !canReview && (
            <p className="text-[11px] text-violet-300/60 mt-1.5">
              You ran this session — it has to be reviewed by someone else.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-neutral-800 bg-neutral-900 divide-y divide-neutral-800">
          <YesNoRow
            question="Was the parent / guardian notified?"
            value={session.parents_notified}
            disabled={!canEdit}
            onChange={(v) => onPatch({ parents_notified: v })}
          />
          <YesNoRow
            question="Is further discussion needed?"
            value={session.follow_up_needed}
            disabled={!canEdit}
            onChange={(v) => onPatch({ follow_up_needed: v })}
          />
          {/* Standing instruction, then the one question that follows from it.
              A mentor deciding a child needs more than they can give doesn't
              need a taxonomy — they need to call Nikki and record that they
              did. */}
          <div className="p-3 space-y-3">
            <div className="flex items-start gap-2 rounded-lg border border-red-500/25 bg-red-500/[0.06] p-2.5">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
              <p className="text-[12px] leading-relaxed text-red-200/90">
                If you believe this youth should see a professional, reach out to{" "}
                <span className="font-semibold text-red-200">Nikki immediately</span>.
              </p>
            </div>
            <YesNoRow
              question="Was Nikki notified?"
              value={session.nikki_notified}
              disabled={!canEdit}
              onChange={(v) => onPatch({ nikki_notified: v })}
              bare
            />
            {session.nikki_notified === true && (
              <p className="text-[11px] leading-relaxed text-neutral-500 italic">
                The report will state that {COUNSELOR_LINE.charAt(0).toLowerCase()}
                {COUNSELOR_LINE.slice(1)}
              </p>
            )}
          </div>
        </div>

        {/* Review actions */}
        {canReview && !locked && (
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={() => onStatus("reviewed")}
              className="flex-1 bg-green-600 hover:bg-green-500 text-white font-semibold"
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" /> Mark reviewed
            </Button>
            <Button
              variant="outline"
              onClick={() => onStatus("changes_requested")}
              className="bg-transparent border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
            >
              <Undo2 className="w-4 h-4 mr-1.5" /> Request changes
            </Button>
          </div>
        )}

        {canReview && locked && (
          <Button
            variant="outline"
            onClick={() => onStatus("pending_review")}
            className="w-full bg-transparent border-neutral-700 text-neutral-300 hover:bg-white/5"
          >
            <Undo2 className="w-4 h-4 mr-1.5" /> Reopen for edits
          </Button>
        )}

        {!isReviewer && !locked && (
          <p className="text-center text-[12px] text-neutral-500">
            Waiting on a reviewer to sign this off.
          </p>
        )}

        {/* A new conversation is a new record, never an edit of this one —
            so continuing the thread starts a fresh session with this youth
            already picked. */}
        {session.registration_id && (
          <Button
            variant="outline"
            onClick={onFollowUp}
            className="w-full bg-transparent border-sky-500/30 text-sky-300 hover:bg-sky-500/10"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Start a follow-up session with {session.youth_name.split(" ")[0]}
          </Button>
        )}

        <div className="flex gap-2 pb-2">
          <Button onClick={onPdf} className="flex-1 text-white font-semibold"
            style={{ backgroundColor: NLA_RED }}>
            <FileDown className="w-4 h-4 mr-1.5" /> Download PDF
          </Button>
          <Button
            variant="outline"
            onClick={onDelete}
            disabled={locked && !isReviewer}
            className="bg-transparent border-neutral-700 text-neutral-300 hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/40"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </>
  );
};

const ReviewBadge = ({ session }: { session: ScriptureSession }) => {
  const map: Record<ReviewStatus, string> = {
    reviewed: "bg-green-500/15 text-green-400 border-green-500/30",
    changes_requested: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    pending_review: "bg-neutral-800 text-neutral-400 border-neutral-700",
  };
  return (
    <Badge className={`${map[session.review_status]} text-[10px]`}>
      {session.review_status === "reviewed" && <ShieldCheck className="w-3 h-3 mr-1" />}
      {REVIEW_LABELS[session.review_status]}
    </Badge>
  );
};

const StatTile = ({
  label, value, tone = "neutral", active, onClick,
}: {
  label: string;
  value: number;
  tone?: "neutral" | "amber" | "sky" | "red" | "violet";
  active: boolean;
  onClick: () => void;
}) => {
  const toneCls = {
    neutral: "text-white",
    amber: "text-amber-400",
    sky: "text-sky-400",
    red: "text-red-400",
    violet: "text-violet-400",
  }[tone];
  return (
    <button
      onClick={onClick}
      className={`p-4 rounded-xl border text-center transition-colors ${
        active
          ? "border-neutral-600 bg-neutral-800"
          : "border-neutral-800 bg-neutral-900 hover:border-neutral-700"
      }`}
    >
      <p className={`text-2xl font-bold ${toneCls}`}>{value}</p>
      <p className="text-[11px] text-neutral-400 mt-0.5 leading-tight">{label}</p>
    </button>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <p className="text-[10px] uppercase tracking-[0.15em] text-neutral-500 mb-2">{label}</p>
    {children}
  </div>
);

// A real question with a real answer. A toggle can't tell "we asked and the
// answer was no" apart from "nobody ever recorded this" — on a safeguarding
// record those are different facts, so unanswered stays visible until someone
// answers it.
const YesNoRow = ({
  question, value, disabled, onChange, bare,
}: {
  question: string;
  value: boolean | null;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  bare?: boolean;
}) => (
  <div className={`flex items-center justify-between gap-3 flex-wrap ${bare ? "" : "p-3"}`}>
    <div className="flex items-center gap-2">
      <span className={`text-sm ${disabled ? "text-neutral-500" : "text-neutral-200"}`}>
        {question}
      </span>
      {value === null && value !== undefined && (
        <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px]">
          Not answered
        </Badge>
      )}
    </div>
    <div className="flex items-center gap-1.5">
      {[true, false].map((opt) => {
        const on = value === opt;
        return (
          <button
            key={String(opt)}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              on
                ? opt
                  ? "bg-green-500/15 border-green-500/40 text-green-300"
                  : "bg-neutral-700/60 border-neutral-600 text-white"
                : "bg-transparent border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-white"
            }`}
          >
            {opt ? "Yes" : "No"}
          </button>
        );
      })}
    </div>
  </div>
);

export default AdminScriptureCoachIntelligence;
