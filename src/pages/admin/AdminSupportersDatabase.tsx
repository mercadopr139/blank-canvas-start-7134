import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import { Upload } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
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
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const row: CsvRow = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ""; });
    return row;
  });
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
      setCsvData(parsed);
      setCsvHeaders(Object.keys(parsed[0]));
      const autoMap: Record<MappableField, string> = { name: "__skip__", story: "__skip__", email: "__skip__", phone: "__skip__", address: "__skip__" };
      MAPPABLE_FIELDS.forEach((field) => {
        // auto-map: "notes" column → story field
        const aliases: Record<MappableField, string[]> = {
          name: ["name"],
          story: ["story", "notes", "bio", "description"],
          email: ["email", "e-mail"],
          phone: ["phone", "phone number", "tel"],
          address: ["address", "addr"],
        };
        const match = Object.keys(parsed[0]).find((h) =>
          aliases[field].includes(h.toLowerCase())
        );
        if (match) autoMap[field] = match;
      });
      setMapping(autoMap);
      setSummary(null);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!csvData.length || !mapping.name) return;
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

      // Blank email → always insert as new record
      if (!email) {
        await supabase.from("supporters").insert({
          name, email: null, story, phone, address,
          supporter_type: supporterType,
        });
        created++;
        continue;
      }

      // Email present → lookup by email first
      const { data: existing } = await supabase
        .from("supporters")
        .select("id, email, story, phone, address")
        .eq("email", email)
        .maybeSingle();

      if (existing) {
        // Fill only missing fields
        const patch: Record<string, string | null> = {};
        if (!existing.story && story) patch.story = story;
        if (!existing.phone && phone) patch.phone = phone;
        if (!existing.address && address) patch.address = address;
        if (Object.keys(patch).length) {
          await supabase.from("supporters").update(patch).eq("id", existing.id);
        }
        updated++;
      } else {
        await supabase.from("supporters").insert({
          name, email, story, phone, address,
          supporter_type: supporterType,
        });
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
        <h2 className="text-base font-semibold text-white">Supporters Database</h2>
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
            className="bg-sky-500 hover:bg-sky-400 text-white gap-1.5"
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingRows ? (
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableCell colSpan={5} className="text-center py-12 text-white/50">Loading…</TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableCell colSpan={5} className="text-center py-12 text-white/50">No supporters yet. Import a CSV to get started.</TableCell>
                </TableRow>
              ) : (
                rows.map((s) => (
                  <TableRow key={s.id} className="border-white/10 hover:bg-white/5">
                    <TableCell className="text-white font-medium">{s.name}</TableCell>
                    <TableCell className="text-white/60 text-sm">{s.supporter_type}</TableCell>
                    <TableCell className="text-white/70 text-sm">
                      {s.email
                        ? <a href={`mailto:${s.email}`} className="text-sky-400 hover:underline">{s.email}</a>
                        : "—"}
                    </TableCell>
                    <TableCell className="text-white/70 text-sm">
                      {s.phone
                        ? <a href={`tel:${s.phone}`} className="text-sky-400 hover:underline">{s.phone}</a>
                        : "—"}
                    </TableCell>
                    <TableCell className="text-white/70 text-sm">{s.address || "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ── Import Modal ──────────────────────────────────────────────────────── */}
      <Dialog open={importOpen} onOpenChange={(o) => { if (!o) resetImport(); setImportOpen(o); }}>
        <DialogContent className="bg-zinc-900 border-white/10 text-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">Import Supporters CSV</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-1">
            {/* Supporter Type dropdown */}
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

            {/* File upload */}
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

            {/* Column mapping */}
            {csvHeaders.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-white/80">Column Mapping</p>
                {MAPPABLE_FIELDS.map((field) => (
                  <div key={field} className="flex items-center gap-3">
                    <span className="w-20 text-sm text-white/60">{FIELD_LABELS[field]}</span>
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
              </div>
            )}

            {/* Notes about formatting */}
            <p className="text-xs text-white/30 leading-relaxed">
              Emails are lowercased. Phone numbers are stored in E.164 format (+1 assumed for 10-digit US numbers). Blank emails are always inserted as new records.
            </p>

            {/* Summary */}
            {summary && (
              <div className="rounded-md bg-green-600/10 border border-green-600/30 px-4 py-3 text-sm text-green-300">
                Import complete — <strong>{summary.created}</strong> created,{" "}
                <strong>{summary.updated}</strong> updated,{" "}
                <strong>{summary.skipped}</strong> skipped.
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => { resetImport(); setImportOpen(false); }}
              className="text-white hover:bg-white/10"
            >
              {summary ? "Close" : "Cancel"}
            </Button>
            {!summary && (
              <Button
                disabled={!csvData.length || !mapping.name || importing}
                onClick={handleImport}
                className="bg-sky-500 hover:bg-sky-400 text-white"
              >
                {importing ? "Importing…" : `Import ${csvData.length || ""} Rows`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSupportersDatabase;
