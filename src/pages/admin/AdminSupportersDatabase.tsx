import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Upload } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// ─── Types ────────────────────────────────────────────────────────────────────

type CsvRow = Record<string, string>;

const MAPPABLE_FIELDS = ["name", "story", "email", "phone", "address"] as const;
type MappableField = (typeof MAPPABLE_FIELDS)[number];

// ─── CSV helpers ──────────────────────────────────────────────────────────────

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

// ─── Component ────────────────────────────────────────────────────────────────

const AdminSupportersDatabase = () => {
  const fileRef = useRef<HTMLInputElement>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<CsvRow[]>([]);
  const [mapping, setMapping] = useState<Record<MappableField, string>>({
    name: "", story: "", email: "", phone: "", address: "",
  });
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState<{ created: number; updated: number } | null>(null);

  const resetImport = () => {
    setCsvHeaders([]);
    setCsvData([]);
    setMapping({ name: "", story: "", email: "", phone: "", address: "" });
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
      const autoMap: Record<MappableField, string> = { name: "", story: "", email: "", phone: "", address: "" };
      MAPPABLE_FIELDS.forEach((field) => {
        const match = Object.keys(parsed[0]).find(
          (h) => h.toLowerCase() === field.toLowerCase()
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

    for (const row of csvData) {
      const name = row[mapping.name]?.trim();
      if (!name) continue;

      const email = mapping.email && mapping.email !== "__skip__" ? row[mapping.email]?.trim() || null : null;
      const story = mapping.story && mapping.story !== "__skip__" ? row[mapping.story]?.trim() || null : null;
      const phone = mapping.phone && mapping.phone !== "__skip__" ? row[mapping.phone]?.trim() || null : null;
      const address = mapping.address && mapping.address !== "__skip__" ? row[mapping.address]?.trim() || null : null;

      let existingId: string | null = null;
      if (email) {
        const { data } = await supabase
          .from("supporters")
          .select("id")
          .eq("email", email)
          .maybeSingle();
        if (data) existingId = data.id;
      }
      if (!existingId) {
        const { data } = await supabase
          .from("supporters")
          .select("id")
          .ilike("name", name)
          .maybeSingle();
        if (data) existingId = data.id;
      }

      if (existingId) {
        const { data: existing } = await supabase
          .from("supporters")
          .select("email, story, phone, address")
          .eq("id", existingId)
          .single();

        const patch: Record<string, string | null> = {};
        if (!existing?.email && email) patch.email = email;
        if (!existing?.story && story) patch.story = story;
        if (!existing?.phone && phone) patch.phone = phone;
        if (!existing?.address && address) patch.address = address;

        if (Object.keys(patch).length) {
          await supabase.from("supporters").update(patch).eq("id", existingId);
        }
        updated++;
      } else {
        await supabase.from("supporters").insert({
          name,
          email,
          story,
          phone,
          address,
          supporter_type: "Hall of Fame",
        });
        created++;
      }
    }

    setImporting(false);
    setSummary({ created, updated });
  };

  return (
    <div className="bg-black text-white">
      {/* Page header */}
      <div className="border-b border-white/10 px-4 py-3">
        <h2 className="text-base font-semibold text-white">Supporters Database</h2>
        <p className="text-xs text-white/50">Import and manage supporter records</p>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-white/50">
            Import Hall of Fame supporters from a CSV export (e.g. Monday.com).
          </p>
          <Button
            size="sm"
            className="bg-sky-500 hover:bg-sky-400 text-white gap-1.5"
            onClick={() => { resetImport(); setImportOpen(true); }}
          >
            <Upload className="w-4 h-4" />
            Import Hall of Fame CSV
          </Button>
        </div>
      </div>

      {/* ── Import Modal ─────────────────────────────────────────────────────── */}
      <Dialog open={importOpen} onOpenChange={(o) => { if (!o) resetImport(); setImportOpen(o); }}>
        <DialogContent className="bg-zinc-900 border-white/10 text-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">Import Hall of Fame CSV</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-1">
            {/* Supporter Type — locked */}
            <div className="space-y-1.5">
              <Label className="text-white/70">Supporter Type</Label>
              <Input
                value="Hall of Fame"
                disabled
                className="bg-white/5 border-white/10 text-white/50 cursor-not-allowed"
              />
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
                    <span className="w-20 text-sm text-white/60 capitalize">{field}</span>
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

            {/* Summary */}
            {summary && (
              <div className="rounded-md bg-green-600/10 border border-green-600/30 px-4 py-3 text-sm text-green-300">
                Import complete — <strong>{summary.created}</strong> created, <strong>{summary.updated}</strong> updated.
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
