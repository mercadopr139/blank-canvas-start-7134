// Hawk Squad — Registrations.
//
// The admin side of the public form at /hawk-squad/register: every student
// registered for a program year, who is waiting for approval, approve and
// archive, and the full record with photo and signatures. Own tables, so
// nothing here can touch or be touched by NLA.
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Search, Check, X, Archive, ArchiveRestore, Eye, ExternalLink, Loader2, FileSignature, Bus, Save,
} from "lucide-react";
import { getProgramYearForRegistration, shortProgramYear } from "@/lib/programYear";
import {
  HAWK_GRADES, HAWK_CTE_PROGRAMS, HAWK_SEX, HAWK_RACE, HAWK_DISMISSAL_WAIVER_KEY,
  type HawkRegistration, hawkPhotoUrl, hawkSignatureUrl, hawkPossibleDuplicates,
} from "@/lib/hawkSquad";
import { AlertTriangle, Trash2 } from "lucide-react";
import { e164ToDisplay } from "@/lib/validators";

const table = () => supabase.from("hawk_squad_registrations" as never) as never as {
  select: (s: string) => {
    order: (k: string, o: { ascending: boolean }) => Promise<{ data: unknown; error: unknown }>;
  };
  update: (v: Record<string, unknown>) => { eq: (k: string, v: string) => Promise<{ error: unknown }> };
  delete: () => { eq: (k: string, v: string) => Promise<{ error: unknown }> };
};

const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const ageOn = (dob: string | null, on = new Date()) => {
  if (!dob) return null;
  const b = new Date(`${dob}T12:00:00`);
  let a = on.getFullYear() - b.getFullYear();
  const m = on.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && on.getDate() < b.getDate())) a--;
  return a;
};

const AdminHawkSquadRegistrations = () => {
  const qc = useQueryClient();
  const [year, setYear] = useState<string>(() => getProgramYearForRegistration());
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: rows = [], isLoading, isError, error } = useQuery({
    queryKey: ["hawk-squad-registrations"],
    queryFn: async () => {
      const { data, error } = await table().select("*").order("created_at", { ascending: false });
      if (error) throw error as Error;
      return (data || []) as HawkRegistration[];
    },
  });

  const years = useMemo(() => {
    const set = new Set(rows.map((r) => r.program_year));
    set.add(getProgramYearForRegistration());
    return Array.from(set).sort().reverse();
  }, [rows]);

  const inYear = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => r.program_year === year)
      .filter((r) => (showArchived ? !!r.archived_at : !r.archived_at))
      .filter((r) => {
        if (!q) return true;
        const hay = [r.child_first_name, r.child_last_name, r.parent_first_name, r.parent_last_name, r.parent_email, r.cte_program]
          .filter(Boolean).join(" ").toLowerCase();
        return hay.includes(q);
      });
  }, [rows, year, search, showArchived]);

  const waiting = inYear.filter((r) => !r.approved_for_attendance);
  const approved = inYear.filter((r) => r.approved_for_attendance);
  const open = rows.find((r) => r.id === openId) ?? null;

  // Delete for good: the registration, its check-ins (the database cascades),
  // and its photo and signature files. Archive is the reversible option; this
  // is for a test entry or a registration that should never have existed.
  const remove = async (r: HawkRegistration) => {
    const name = `${r.child_first_name} ${r.child_last_name}`;
    if (!window.confirm(`Delete ${name}'s Hawk Squad registration for good?

This also deletes every check-in recorded for it and cannot be undone. Use Archive instead if you might need it back.`)) return;
    setBusyId(r.id);
    try {
      // Files first, best effort: a missing file must not block the delete.
      if (r.child_headshot_url) {
        await supabase.storage.from("youth-photos").remove([r.child_headshot_url.replace(/^youth-photos\//, "")]);
      }
      const sigs = Object.values(r.waivers_data ?? {}).map((w) => w?.signaturePath).filter((p): p is string => !!p);
      if (sigs.length) await supabase.storage.from("registration-signatures").remove(sigs);
      const { error } = await table().delete().eq("id", r.id);
      if (error) throw error as Error;
      setOpenId(null);
      await qc.invalidateQueries({ queryKey: ["hawk-squad-registrations"] });
      toast.success(`${name}'s registration was deleted.`);
    } catch (e) {
      toast.error((e as Error)?.message ?? "Couldn't delete that.");
    } finally {
      setBusyId(null);
    }
  };

  const patch = async (id: string, values: Record<string, unknown>, done: string) => {
    setBusyId(id);
    try {
      const { error } = await table().update({ ...values, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error as Error;
      await qc.invalidateQueries({ queryKey: ["hawk-squad-registrations"] });
      toast.success(done);
    } catch (e) {
      toast.error((e as Error)?.message ?? "Couldn't save that.");
    } finally {
      setBusyId(null);
    }
  };

  const Row = ({ r }: { r: HawkRegistration }) => {
    const photo = hawkPhotoUrl(r.child_headshot_url);
    const age = ageOn(r.child_date_of_birth);
    // Another live registration this year that looks like the same student.
    // Review before approving: approving this one moves that one back to
    // waiting (the database guard), so the student has one attendable record.
    const dups = hawkPossibleDuplicates(r, rows);
    return (
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] last:border-b-0">
        <div className="w-10 h-10 rounded-full overflow-hidden bg-white/10 shrink-0 ring-1 ring-white/15">
          {photo ? <img src={photo} alt="" className="w-full h-full object-cover" /> : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-white truncate">
            {r.child_last_name}, {r.child_first_name}
            {age != null && <span className="ml-2 text-xs text-white/40">{age}</span>}
            {r.grade_level && <span className="ml-2 text-xs text-white/40">{r.grade_level}</span>}
          </p>
          <p className="text-xs text-white/45 truncate">
            {r.cte_program || "No CTE program"} · {[r.parent_first_name, r.parent_last_name].filter(Boolean).join(" ") || "No parent name"}
            {r.parent_phone ? ` · ${e164ToDisplay(r.parent_phone)}` : ""}
          </p>
          {dups.length > 0 && (
            <p className="mt-1 text-[11px] text-amber-300 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              Possible duplicate of {dups.map((d) => `${d.child_first_name} ${d.child_last_name} (${d.approved_for_attendance ? "approved" : "waiting"}, submitted ${fmtDate(d.submission_date ?? d.created_at ?? "")})`).join("; ")} — review before approving.
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {r.dismissal_waiver_signed_at ? (
            <Badge className="bg-amber-500/15 text-amber-300 border-amber-400/30 text-[10px]" title="Dismissal waiver on file — may be dismissed directly from NLA instead of riding the bus">
              <Bus className="w-3 h-3 mr-1" /> Bus or dismiss from NLA
            </Badge>
          ) : (
            <Badge className="bg-white/5 text-white/50 border-white/10 text-[10px]" title="No dismissal waiver — bus only">
              <Bus className="w-3 h-3 mr-1" /> Bus only
            </Badge>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8 text-white/50 hover:text-white" onClick={() => setOpenId(r.id)} title="Open">
            <Eye className="w-4 h-4" />
          </Button>
          {!r.archived_at && (
            r.approved_for_attendance ? (
              <Button size="sm" variant="ghost" disabled={busyId === r.id}
                className="h-8 text-white/50 hover:text-white text-xs"
                onClick={() => patch(r.id, { approved_for_attendance: false }, `${r.child_first_name} moved back to waiting.`)}>
                <X className="w-3.5 h-3.5 mr-1" /> Unapprove
              </Button>
            ) : (
              <Button size="sm" disabled={busyId === r.id}
                className="h-8 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                onClick={() => patch(r.id, { approved_for_attendance: true },
                  dups.some((d) => d.approved_for_attendance)
                    ? `${r.child_first_name} approved. The other approved record for this student was moved back to waiting.`
                    : `${r.child_first_name} approved.`)}>
                {busyId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Check className="w-3.5 h-3.5 mr-1" /> Approve</>}
              </Button>
            )
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto text-white">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">Hawk Squad — Registrations</h2>
          <p className="text-neutral-400 text-sm mt-1">
            Every student registered for Hawk Squad. Approve them here and they appear on the Hawk Squad check-in.
          </p>
        </div>
        <Button variant="outline" onClick={() => window.open("/hawk-squad/register", "_blank")}
          className="bg-transparent border-neutral-700 text-neutral-300 hover:text-white">
          <ExternalLink className="w-4 h-4 mr-1.5" /> Open registration form
        </Button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-[190px] bg-neutral-900 border-neutral-700 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-neutral-900 border-neutral-700 text-white">
            {years.map((y) => (
              <SelectItem key={y} value={y}>
                {shortProgramYear(y)}{y === getProgramYearForRegistration() ? " (current)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by student, parent, email or CTE program…"
            className="pl-9 bg-neutral-900 border-neutral-700 text-white" />
        </div>
        <Button variant="ghost" size="sm" onClick={() => setShowArchived((v) => !v)}
          className={showArchived ? "text-amber-300 hover:text-amber-200" : "text-white/50 hover:text-white"}>
          <Archive className="w-4 h-4 mr-1.5" /> {showArchived ? "Showing archived" : "Show archived"}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-white/40 py-16 text-center">Loading…</p>
      ) : isError ? (
        <Card className="bg-rose-500/10 border-rose-400/30 text-white">
          <CardContent className="p-5 text-sm">Couldn't load Hawk Squad registrations: {(error as Error)?.message}</CardContent>
        </Card>
      ) : (
        <>
          {!showArchived && (
            <section>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white/60 mb-2 flex items-center gap-2">
                Waiting for approval
                {waiting.length > 0 && <Badge className="bg-[#bf0f3e] text-white border-0">{waiting.length}</Badge>}
              </h3>
              <Card className="bg-white/[0.03] border-white/10 text-white">
                <CardContent className="p-0">
                  {waiting.length === 0
                    ? <p className="px-4 py-6 text-sm text-white/35">Nobody waiting.</p>
                    : waiting.map((r) => <Row key={r.id} r={r} />)}
                </CardContent>
              </Card>
            </section>
          )}

          <section>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white/60 mb-2 flex items-center gap-2">
              {showArchived ? "Archived" : "Approved"}
              <Badge className="bg-white/10 text-white border-0">{(showArchived ? inYear : approved).length}</Badge>
            </h3>
            <Card className="bg-white/[0.03] border-white/10 text-white">
              <CardContent className="p-0">
                {(showArchived ? inYear : approved).length === 0
                  ? <p className="px-4 py-6 text-sm text-white/35">{showArchived ? "Nothing archived." : "Nobody approved yet."}</p>
                  : (showArchived ? inYear : approved).map((r) => <Row key={r.id} r={r} />)}
              </CardContent>
            </Card>
          </section>
        </>
      )}

      {open && (
        <RegistrationDialog
          r={open}
          busy={busyId === open.id}
          onClose={() => setOpenId(null)}
          onSave={(values, done) => patch(open.id, values, done)}
          onDelete={() => remove(open)}
        />
      )}
    </div>
  );
};

/* ───── The full record ───── */
const RegistrationDialog = ({
  r,
  onDelete, busy, onClose, onSave,
}: {
  r: HawkRegistration;
  busy: boolean;
  onClose: () => void;
  onSave: (values: Record<string, unknown>, done: string) => Promise<void>;
  onDelete: () => Promise<void>;
}) => {
  const [d, setD] = useState({
    child_first_name: r.child_first_name ?? "",
    child_last_name: r.child_last_name ?? "",
    child_sex: r.child_sex ?? "",
    child_date_of_birth: r.child_date_of_birth ?? "",
    child_race_ethnicity: r.child_race_ethnicity ?? "",
    grade_level: r.grade_level ?? "",
    cte_program: r.cte_program ?? "",
    child_primary_address: r.child_primary_address ?? "",
    parent_first_name: r.parent_first_name ?? "",
    parent_last_name: r.parent_last_name ?? "",
    parent_phone: r.parent_phone ?? "",
    parent_email: r.parent_email ?? "",
    free_or_reduced_lunch: r.free_or_reduced_lunch ?? "",
    allergies: r.allergies ?? "",
    asthma_inhaler_info: r.asthma_inhaler_info ?? "",
    important_child_notes: r.important_child_notes ?? "",
  });
  const set = (k: keyof typeof d, v: string) => setD((p) => ({ ...p, [k]: v }));
  const photo = hawkPhotoUrl(r.child_headshot_url);

  // The drop-down lists come from the same place the registration form's do:
  // the Hawk Squad form fields. Edit the CTE list in the Form Editor and this
  // dialog follows. The constants in hawkSquad.ts are only the fallback.
  const { data: formOptions = {} } = useQuery({
    queryKey: ["hawk-form-options"],
    queryFn: async (): Promise<Record<string, string[]>> => {
      const { data } = await (supabase.from("hawk_squad_form_fields" as never) as never as {
        select: (s: string) => { in: (k: string, v: string[]) => Promise<{ data: unknown }> };
      }).select("field_key, options").in("field_key", ["grade_level", "cte_program", "child_sex", "child_race_ethnicity", "free_or_reduced_lunch"]);
      const out: Record<string, string[]> = {};
      for (const row of (data as Array<{ field_key: string; options: unknown }>) ?? []) {
        let raw = row.options;
        if (typeof raw === "string") { try { raw = JSON.parse(raw); } catch { raw = null; } }
        if (Array.isArray(raw)) {
          out[row.field_key] = raw.map((o) => (typeof o === "string" ? o : String((o as { value?: string; label?: string })?.value ?? (o as { label?: string })?.label ?? ""))).filter(Boolean);
        }
      }
      return out;
    },
  });
  const optionsFor = (k: keyof typeof d, fallback: readonly string[]): string[] => {
    const fromForm = formOptions[k as string];
    const list = fromForm?.length ? fromForm : [...fallback];
    const cur = d[k];
    return cur && !list.includes(cur) ? [...list, cur] : list; // keep an old answer selectable
  };
  const waivers = Object.entries(r.waivers_data ?? {});

  const field = (label: string, k: keyof typeof d, type: "text" | "date" | "textarea" = "text") => (
    <div>
      <Label className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</Label>
      {type === "textarea" ? (
        <Textarea value={d[k]} onChange={(e) => set(k, e.target.value)} rows={2} className="mt-1 bg-neutral-800 border-neutral-700 text-white text-sm" />
      ) : (
        <Input type={type} value={d[k]} onChange={(e) => set(k, e.target.value)} className="mt-1 h-9 bg-neutral-800 border-neutral-700 text-white text-sm" />
      )}
    </div>
  );
  const pick = (label: string, k: keyof typeof d, options: readonly string[]) => (
    <div>
      <Label className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</Label>
      <Select value={d[k] || undefined} onValueChange={(v) => set(k, v)}>
        <SelectTrigger className="mt-1 h-9 bg-neutral-800 border-neutral-700 text-white text-sm"><SelectValue placeholder="—" /></SelectTrigger>
        <SelectContent className="bg-neutral-900 border-neutral-700 text-white">
          {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="bg-neutral-950 border-neutral-800 text-white max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl overflow-hidden bg-white/10 shrink-0 ring-1 ring-white/15">
              {photo ? <img src={photo} alt="" className="w-full h-full object-cover" /> : null}
            </div>
            <div className="min-w-0">
              <p className="text-xl font-bold">{r.child_first_name} {r.child_last_name}</p>
              <p className="text-xs text-white/40 font-normal">
                Registered {fmtDate(r.submission_date)} · {shortProgramYear(r.program_year)} ·{" "}
                {r.approved_for_attendance ? <span className="text-emerald-300">Approved</span> : <span className="text-amber-300">Waiting for approval</span>}
                {r.archived_at ? " · Archived" : ""}
              </p>
            </div>
          </DialogTitle>
          <DialogDescription className="sr-only">Hawk Squad registration</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <section className="grid gap-3 sm:grid-cols-2">
            {field("First name", "child_first_name")}
            {field("Last name", "child_last_name")}
            {pick("Grade", "grade_level", optionsFor("grade_level", HAWK_GRADES))}
            {pick("CTE program", "cte_program", optionsFor("cte_program", HAWK_CTE_PROGRAMS))}
            {pick("Sex", "child_sex", optionsFor("child_sex", HAWK_SEX))}
            {field("Date of birth", "child_date_of_birth", "date")}
            {pick("Race / ethnicity", "child_race_ethnicity", optionsFor("child_race_ethnicity", HAWK_RACE))}
            {pick("Free or reduced lunch", "free_or_reduced_lunch", optionsFor("free_or_reduced_lunch", ["Yes", "No"]))}
            <div className="sm:col-span-2">{field("Address", "child_primary_address")}</div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            {field("Parent first name", "parent_first_name")}
            {field("Parent last name", "parent_last_name")}
            {field("Parent cell", "parent_phone")}
            {field("Parent email", "parent_email")}
          </section>

          <section className="grid gap-3">
            <div>
              <Label className="text-[11px] uppercase tracking-wide text-neutral-500">
                Allergies · {r.has_allergies === true ? "Yes" : r.has_allergies === false ? "No" : "not answered"}
              </Label>
              {r.has_allergies !== false && (
                <Textarea value={d.allergies} onChange={(e) => set("allergies", e.target.value)} rows={2}
                  placeholder="Allergies and how severe" className="mt-1 bg-neutral-800 border-neutral-700 text-white text-sm" />
              )}
            </div>
            <div>
              <Label className="text-[11px] uppercase tracking-wide text-neutral-500">
                Asthma · {r.has_asthma === true ? "Yes" : r.has_asthma === false ? "No" : "not answered"}
              </Label>
              {r.has_asthma && (
                <Textarea value={d.asthma_inhaler_info} onChange={(e) => set("asthma_inhaler_info", e.target.value)} rows={2}
                  placeholder="Inhaler name and instructions" className="mt-1 bg-neutral-800 border-neutral-700 text-white text-sm" />
              )}
            </div>
            {field("Notes for coaches", "important_child_notes", "textarea")}
          </section>

          {/* Waivers: which were signed, by whom, with the signature image a click away. */}
          <section>
            <p className="text-[11px] uppercase tracking-wide text-neutral-500 mb-2 flex items-center gap-1.5">
              <FileSignature className="w-3.5 h-3.5" /> Waivers
            </p>
            <div className="rounded-lg border border-white/10 divide-y divide-white/[0.06]">
              {waivers.map(([key, w]) => (
                <div key={key} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="text-white/85">{w.title}</span>
                  <span className="text-white/45 text-xs flex items-center gap-2">
                    {w.name}
                    {w.signaturePath && (
                      <a href={hawkSignatureUrl(w.signaturePath) ?? "#"} target="_blank" rel="noreferrer" className="text-sky-300 hover:underline">signature</a>
                    )}
                  </span>
                </div>
              ))}
              {/* The optional one, stated either way, with a way to record it later. */}
              <div className="flex items-center justify-between gap-3 px-3 py-2 text-sm bg-white/[0.02]">
                <span className="text-white/85 flex items-center gap-2">
                  <Bus className="w-4 h-4 text-sky-300" /> Dismissal waiver
                </span>
                {r.dismissal_waiver_signed_at ? (
                  <span className="text-sky-300 text-xs">On file · {fmtDate(r.dismissal_waiver_signed_at)} — can be dismissed from NLA</span>
                ) : (
                  <span className="flex items-center gap-2">
                    <span className="text-white/45 text-xs">Not signed — bus only</span>
                    <Button size="sm" variant="outline" disabled={busy}
                      className="h-7 bg-transparent border-sky-400/40 text-sky-300 hover:bg-sky-500/10 text-xs"
                      title="A parent has signed the dismissal waiver on paper or by email"
                      onClick={() => onSave({ dismissal_waiver_signed_at: new Date().toISOString() }, "Dismissal waiver recorded.")}>
                      Record as signed
                    </Button>
                  </span>
                )}
              </div>
            </div>
            {r.final_signature_name && <p className="text-xs text-white/35 mt-1.5">Signed as: {r.final_signature_name}</p>}
            {!waivers.some(([k]) => k === HAWK_DISMISSAL_WAIVER_KEY) && r.dismissal_waiver_signed_at && (
              <p className="text-xs text-white/35 mt-1">Dismissal waiver was recorded by staff, not signed on the form.</p>
            )}
          </section>
        </div>

        <DialogFooter className="gap-2 flex-wrap">
          {r.archived_at ? (
            <Button variant="ghost" disabled={busy} className="text-white/60 hover:text-white mr-auto"
              onClick={() => onSave({ archived_at: null }, "Restored.")}>
              <ArchiveRestore className="w-4 h-4 mr-1.5" /> Restore
            </Button>
          ) : (
            <Button variant="ghost" disabled={busy} className="text-white/40 hover:text-amber-300 mr-auto"
              onClick={() => onSave({ archived_at: new Date().toISOString(), approved_for_attendance: false }, "Archived.")}>
              <Archive className="w-4 h-4 mr-1.5" /> Archive
            </Button>
          )}
          <Button variant="ghost" disabled={busy} className="text-white/40 hover:text-rose-300" title="Delete for good — cannot be undone" onClick={onDelete}>
            <Trash2 className="w-4 h-4 mr-1.5" /> Delete
          </Button>
          <Button variant="ghost" onClick={onClose} className="text-white/60 hover:text-white">Close</Button>
          <Button disabled={busy} className="font-bold text-white" style={{ backgroundColor: "#16a34a" }}
            onClick={() => onSave(
              {
                ...d,
                child_date_of_birth: d.child_date_of_birth || null,
                asthma_inhaler_info: r.has_asthma ? (d.asthma_inhaler_info || null) : null,
              },
              "Saved."
            )}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdminHawkSquadRegistrations;
