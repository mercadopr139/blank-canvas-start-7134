import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Upload, Pencil, Trash2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

// ─── Types ────────────────────────────────────────────────────────────────────

type CsvRow = Record<string, string>;

const MAPPABLE_FIELDS = ["name", "story", "email", "phone", "address"] as const;
type MappableField = (typeof MAPPABLE_FIELDS)[number];

const FIELD_LABELS: Record<MappableField, string> = {
  name: "Name",
  story: "Notes",
  email: "Email",
  phone: "Phone",
  address: "Address",
};

const SUPPORTER_TYPES = ["Hall of Fame", "Donor", "Sponsor", "Partner", "Other"] as const;

interface SupporterRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  supporter_type: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return [];

  // Skip leading blank/empty rows to find the real header row
  // (Monday.com and some exports prepend blank rows before headers)
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    if (cols.some((c) => c !== "")) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return [];

  const allHeaders = lines[headerIdx].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const dataLines = lines.slice(headerIdx + 1).filter(Boolean);

  return dataLines
    .map((line) => {
      const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
      const row: CsvRow = {};
      allHeaders.forEach((h, i) => { if (h) row[h] = values[i] ?? ""; });
      return row;
    })
    .filter((row) => Object.values(row).some((v) => v !== "")); // skip fully-blank data rows
}

/** Normalise to E.164. Assumes US (+1) if no country code. Returns null if empty. */
function normalizePhone(raw: string): string | null {
  const cleaned = raw.trim();
  if (!cleaned) return null;
  const digits = cleaned.replace(/\D/g, "");
  if (!digits) return cleaned; // non-digit-only string — store as-is
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

function normalizeEmail(raw: string): string | null {
  const v = raw.trim().toLowerCase();
  return v || null;
}

// ─── Component ────────────────────────────────────────────────────────────────

const AdminSupportersDatabase = () => {
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Table state ───────────────────────────────────────────────────────────
  const [rows, setRows] = useState<SupporterRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(true);

  const fetchRows = useCallback(async () => {
    setLoadingRows(true);
    const { data } = await supabase
      .from("supporters")
      .select("id, name, email, phone, address, supporter_type")
      .order("name");
    setRows(data ?? []);
    setLoadingRows(false);
  }, []);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  // ── Edit state ────────────────────────────────────────────────────────────
  const [editRow, setEditRow] = useState<SupporterRow | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const handleEditSave = async () => {
    if (!editRow) return;
    setEditSaving(true);
    await supabase.from("supporters").update({
      name: editRow.name,
      email: editRow.email || null,
      phone: editRow.phone || null,
      address: editRow.address || null,
      supporter_type: editRow.supporter_type,
    }).eq("id", editRow.id);
    setEditSaving(false);
    setEditRow(null);
    await fetchRows();
  };

  // ── Delete state ──────────────────────────────────────────────────────────
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    await supabase.from("supporters").delete().eq("id", deleteId);
    setDeleting(false);
    setDeleteId(null);
    await fetchRows();
  };

  // ── Import modal state ────────────────────────────────────────────────────
  const [importOpen, setImportOpen] = useState(false);
  const [supporterType, setSupporterType] = useState<string>("Hall of Fame");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<CsvRow[]>([]);
  const [mapping, setMapping] = useState<Record<MappableField, string>>({
    name: "__skip__", story: "__skip__", email: "__skip__", phone: "__skip__", address: "__skip__",
  });
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState<{ created: number; updated: number; skipped: number } | null>(null);

  const resetImport = () => {
    setCsvHeaders([]);
    setCsvData([]);
    setSupporterType("Hall of Fame");
    setMapping({ name: "__skip__", story: "__skip__", email: "__skip__", phone: "__skip__", address: "__skip__" });
    setSummary(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCsv(text);
      if (!parsed.length) return;
      const headers = Object.keys(parsed[0]);
      setCsvData(parsed);
      setCsvHeaders(headers);
      const autoMap: Record<MappableField, string> = { name: "__skip__", story: "__skip__", email: "__skip__", phone: "__skip__", address: "__skip__" };
      MAPPABLE_FIELDS.forEach((field) => {
        const aliases: Record<MappableField, string[]> = {
          name: ["name", "full name", "fullname", "contact name", "contact", "supporter", "donor", "person", "first name", "firstname"],
          story: ["story", "notes", "bio", "description", "note", "comments"],
          email: ["email", "e-mail", "email address", "emailaddress"],
          phone: ["phone", "phone number", "phonenumber", "tel", "telephone", "mobile", "cell"],
          address: ["address", "addr", "mailing address", "street address"],
        };
        const match = headers.find((h) =>
          aliases[field].includes(h.toLowerCase().trim())
        );
        if (match) autoMap[field] = match;
      });
      setMapping(autoMap);
      setSummary(null);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!csvData.length || mapping.name === "__skip__") return;
    setImporting(true);
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of csvData) {
      const name = row[mapping.name]?.trim();
      if (!name) { skipped++; continue; }

      const rawEmail = mapping.email && mapping.email !== "__skip__" ? row[mapping.email] ?? "" : "";
      const rawPhone = mapping.phone && mapping.phone !== "__skip__" ? row[mapping.phone] ?? "" : "";
      const rawStory = mapping.story && mapping.story !== "__skip__" ? row[mapping.story] ?? "" : "";
      const rawAddress = mapping.address && mapping.address !== "__skip__" ? row[mapping.address] ?? "" : "";

      const email = normalizeEmail(rawEmail);
      const phone = normalizePhone(rawPhone);
      const story = rawStory.trim() || null;
      const address = rawAddress.trim() || null;

      if (!email) {
        await supabase.from("supporters").insert({ name, email: null, story, phone, address, supporter_type: supporterType });
        created++;
        continue;
      }

      const { data: existing } = await supabase
        .from("supporters")
        .select("id, email, story, phone, address")
        .eq("email", email)
        .maybeSingle();

      if (existing) {
        const patch: Record<string, string | null> = {};
        if (!existing.story && story) patch.story = story;
        if (!existing.phone && phone) patch.phone = phone;
        if (!existing.address && address) patch.address = address;
        if (Object.keys(patch).length) {
          await supabase.from("supporters").update(patch).eq("id", existing.id);
        }
        updated++;
      } else {
        await supabase.from("supporters").insert({ name, email, story, phone, address, supporter_type: supporterType });
        created++;
      }
    }

    setImporting(false);
    setSummary({ created, updated, skipped });
    await fetchRows();
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="bg-black text-white">
      {/* Page header */}
      <div className="border-b border-white/10 px-4 py-3">
        <h2 className="text-base font-semibold text-green-400">Supporters Database</h2>
        <p className="text-xs text-white/50">Import and manage supporter records</p>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-white/50">
            Import supporters from a CSV export (e.g. Monday.com).
          </p>
          <Button
            size="sm"
            className="bg-green-500 hover:bg-green-400 text-black gap-1.5"
            onClick={() => { resetImport(); setImportOpen(true); }}
          >
            <Upload className="w-4 h-4" />
            Import Supporters CSV
          </Button>
        </div>

        {/* Supporters table */}
        <div className="rounded-lg border border-white/10 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-white/70">Name</TableHead>
                <TableHead className="text-white/70">Type</TableHead>
                <TableHead className="text-white/70">Email</TableHead>
                <TableHead className="text-white/70">Phone</TableHead>
                <TableHead className="text-white/70">Address</TableHead>
                <TableHead className="text-white/70 w-20 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingRows ? (
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableCell colSpan={6} className="text-center py-12 text-white/50">Loading…</TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableCell colSpan={6} className="text-center py-12 text-white/50">No supporters yet. Import a CSV to get started.</TableCell>
                </TableRow>
              ) : (
                rows.map((s) => (
                  <TableRow key={s.id} className="border-white/10 hover:bg-white/5">
                    <TableCell className="text-white font-medium">{s.name}</TableCell>
                    <TableCell className="text-white/60 text-sm">{s.supporter_type}</TableCell>
                    <TableCell className="text-white/70 text-sm">
                      {s.email
                        ? <a href={`mailto:${s.email}`} className="text-green-400 hover:underline">{s.email}</a>
                        : "—"}
                    </TableCell>
                    <TableCell className="text-white/70 text-sm">
                      {s.phone
                        ? <a href={`tel:${s.phone}`} className="text-green-400 hover:underline">{s.phone}</a>
                        : "—"}
                    </TableCell>
                    <TableCell className="text-white/70 text-sm">{s.address || "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setEditRow({ ...s })}
                          className="p-1.5 rounded text-white/40 hover:text-green-400 hover:bg-white/5 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteId(s.id)}
                          className="p-1.5 rounded text-white/40 hover:text-red-400 hover:bg-white/5 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ── Edit Modal ────────────────────────────────────────────────────────── */}
      <Dialog open={!!editRow} onOpenChange={(o) => { if (!o) setEditRow(null); }}>
        <DialogContent className="bg-zinc-900 border-white/10 text-white sm:max-w-md flex flex-col max-h-[85vh] p-0 gap-0">
          <div className="px-6 pt-6 pb-2 shrink-0">
            <DialogHeader>
              <DialogTitle className="text-green-400">Edit Supporter</DialogTitle>
            </DialogHeader>
          </div>
          <div className="overflow-y-auto flex-1 px-6 pb-4 space-y-4 pt-2">
            {editRow && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-white/70">Name <span className="text-red-400">*</span></Label>
                  <Input
                    value={editRow.name}
                    onChange={(e) => setEditRow({ ...editRow, name: e.target.value })}
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-white/70">Supporter Type</Label>
                  <Select value={editRow.supporter_type} onValueChange={(v) => setEditRow({ ...editRow, supporter_type: v })}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-white/10 text-white">
                      {SUPPORTER_TYPES.map((t) => (
                        <SelectItem key={t} value={t} className="focus:bg-white/10">{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-white/70">Email</Label>
                  <Input
                    value={editRow.email ?? ""}
                    onChange={(e) => setEditRow({ ...editRow, email: e.target.value })}
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-white/70">Phone</Label>
                  <Input
                    value={editRow.phone ?? ""}
                    onChange={(e) => setEditRow({ ...editRow, phone: e.target.value })}
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-white/70">Address</Label>
                  <Input
                    value={editRow.address ?? ""}
                    onChange={(e) => setEditRow({ ...editRow, address: e.target.value })}
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
              </>
            )}
          </div>
          <div className="px-6 py-4 border-t border-white/10 shrink-0 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditRow(null)} className="text-white hover:bg-white/10">
              Cancel
            </Button>
            <Button
              onClick={handleEditSave}
              disabled={!editRow?.name?.trim() || editSaving}
              className="bg-green-500 hover:bg-green-400 text-black"
            >
              {editSaving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ───────────────────────────────────────────────── */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent className="bg-zinc-900 border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete supporter?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/50">
              This will permanently remove the record. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-white/20 text-white hover:bg-white/10">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-500 text-white"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Import Modal ──────────────────────────────────────────────────────── */}
      <Dialog open={importOpen} onOpenChange={(o) => { if (!o) resetImport(); setImportOpen(o); }}>
        <DialogContent className="bg-zinc-900 border-white/10 text-white sm:max-w-lg flex flex-col max-h-[85vh] p-0 gap-0">
          <div className="px-6 pt-6 pb-2 shrink-0">
            <DialogHeader>
              <DialogTitle className="text-green-400">Import Supporters CSV</DialogTitle>
            </DialogHeader>
          </div>

          <div className="overflow-y-auto flex-1 px-6 pb-2 space-y-5">
            <div className="space-y-1.5">
              <Label className="text-white/70">Supporter Type <span className="text-red-400">*</span></Label>
              <Select value={supporterType} onValueChange={setSupporterType}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-white/10 text-white">
                  {SUPPORTER_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="focus:bg-white/10">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-white/70">CSV File <span className="text-red-400">*</span></Label>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="w-full text-sm text-white/70 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-white/10 file:text-white file:text-sm file:cursor-pointer cursor-pointer"
              />
            </div>

            {csvHeaders.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-white/80">Column Mapping</p>
                {MAPPABLE_FIELDS.map((field) => (
                  <div key={field} className="flex items-center gap-3">
                    <span className="w-20 text-sm text-white/60 shrink-0">
                      {FIELD_LABELS[field]}
                      {field === "name" && <span className="text-red-400 ml-0.5">*</span>}
                    </span>
                    <Select
                      value={mapping[field]}
                      onValueChange={(v) => setMapping((prev) => ({ ...prev, [field]: v }))}
                    >
                      <SelectTrigger className="flex-1 bg-white/5 border-white/10 text-white h-8 text-sm">
                        <SelectValue placeholder="— skip —" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-white/10 text-white">
                        <SelectItem value="__skip__" className="focus:bg-white/10">— skip —</SelectItem>
                        {csvHeaders.map((h) => (
                          <SelectItem key={h} value={h} className="focus:bg-white/10">{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
                <p className="text-xs text-white/40">
                  {csvData.length} row{csvData.length !== 1 ? "s" : ""} detected
                </p>
                {mapping.name === "__skip__" && (
                  <p className="text-xs text-amber-400">
                    ⚠ Map a column to <strong>Name*</strong> to enable import.
                  </p>
                )}
              </div>
            )}

            <p className="text-xs text-white/30 leading-relaxed">
              Emails are lowercased. Phone numbers are stored in E.164 format (+1 assumed for 10-digit US numbers). Blank emails are always inserted as new records.
            </p>

            {summary && (
              <div className="rounded-md bg-green-600/10 border border-green-600/30 px-4 py-3 text-sm text-green-300">
                Import complete — <strong>{summary.created}</strong> created,{" "}
                <strong>{summary.updated}</strong> updated,{" "}
                <strong>{summary.skipped}</strong> skipped.
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-white/10 shrink-0 flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => { resetImport(); setImportOpen(false); }}
              className="text-white hover:bg-white/10"
            >
              {summary ? "Close" : "Cancel"}
            </Button>
            {!summary && (
              <Button
                disabled={!csvData.length || mapping.name === "__skip__" || importing}
                onClick={handleImport}
                className="bg-green-500 hover:bg-green-400 text-black"
              >
                {importing ? "Importing…" : `Import ${csvData.length || ""} Rows`}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSupportersDatabase;
