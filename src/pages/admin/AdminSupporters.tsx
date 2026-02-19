import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Search, Upload } from "lucide-react";
import { formatUSD } from "@/lib/utils";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SupporterRow {
  id: string;
  name: string;
  email: string | null;
  receipt_2026_status: string;
  receipt_2026_sent_at: string | null;
  total_2026: number;
}

type CsvRow = Record<string, string>;

// CSV columns the user can map to
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

const AdminSupporters = () => {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<SupporterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Import modal state
  const [importOpen, setImportOpen] = useState(false);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<CsvRow[]>([]);
  const [mapping, setMapping] = useState<Record<MappableField, string>>({
    name: "", story: "", email: "", phone: "", address: "",
  });
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState<{ created: number; updated: number } | null>(null);

  // ── Fetch ────────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: supporters } = await supabase
      .from("supporters")
      .select("id, name, email, receipt_2026_status, receipt_2026_sent_at")
      .order("name");

    if (!supporters) { setLoading(false); return; }

    const { data: donations } = await supabase
      .from("donations")
      .select("supporter_id, amount, revenue_type, revenue_description, deposit_date")
      .gte("deposit_date", "2026-01-01")
      .lte("deposit_date", "2026-12-31");

    const totals: Record<string, number> = {};
    (donations || []).forEach((d: any) => {
      if (
        d.supporter_id && (
          d.revenue_type === "Donation" ||
          (d.revenue_type === "Fundraising" && d.revenue_description === "Sponsor")
        )
      ) {
        totals[d.supporter_id] = (totals[d.supporter_id] || 0) + Number(d.amount);
      }
    });

    setRows(supporters.map((s: any) => ({ ...s, total_2026: totals[s.id] || 0 })));
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const filtered = rows.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.email && r.email.toLowerCase().includes(search.toLowerCase()))
  );

  const statusBadge = (status: string) => {
    switch (status) {
      case "Sent":
        return <Badge className="bg-green-600/20 text-green-400 border-green-600/30">Sent</Badge>;
      case "Failed":
        return <Badge className="bg-yellow-600/20 text-yellow-400 border-yellow-600/30">Failed</Badge>;
      default:
        return <Badge className="bg-red-600/20 text-red-400 border-red-600/30">Not Sent</Badge>;
    }
  };

  // ── CSV file upload ──────────────────────────────────────────────────────────

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
      // Auto-map columns whose name matches field name (case-insensitive)
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

  const resetImport = () => {
    setCsvHeaders([]);
    setCsvData([]);
    setMapping({ name: "", story: "", email: "", phone: "", address: "" });
    setSummary(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  // ── Import submit ─────────────────────────────────────────────────────────────

  const handleImport = async () => {
    if (!csvData.length || !mapping.name) return;
    setImporting(true);

    let created = 0;
    let updated = 0;

    for (const row of csvData) {
      const name = row[mapping.name]?.trim();
      if (!name) continue;

      const email = mapping.email ? row[mapping.email]?.trim() || null : null;
      const story = mapping.story ? row[mapping.story]?.trim() || null : null;
      const phone = mapping.phone ? row[mapping.phone]?.trim() || null : null;
      const address = mapping.address ? row[mapping.address]?.trim() || null : null;

      // Try to find existing record by email first, then name
      let existingId: string | null = null;
      if (email) {
        const { data } = await supabase
          .from("supporters")
          .select("id, name, email, story, phone, address")
          .eq("email", email)
          .maybeSingle();
        if (data) existingId = data.id;
      }
      if (!existingId) {
        const { data } = await supabase
          .from("supporters")
          .select("id, name, email, story, phone, address")
          .ilike("name", name)
          .maybeSingle();
        if (data) existingId = data.id;
      }

      if (existingId) {
        // Fetch current values to only fill missing fields
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
    await fetchData();
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="bg-black text-white">
      {/* Page header */}
      <div className="border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">Donor/Sponsor History</h2>
          <p className="text-xs text-white/50">View supporters and 2026 receipt status</p>
        </div>
        <Button
          size="sm"
          className="bg-sky-500 hover:bg-sky-400 text-white gap-1.5"
          onClick={() => { resetImport(); setImportOpen(true); }}
        >
          <Upload className="w-4 h-4" />
          Import Hall of Fame CSV
        </Button>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <Input
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white/5 border-white/20 text-white placeholder:text-white/30"
            />
          </div>
        </div>

        <div className="rounded-lg border border-white/10 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-white/70">Supporter Name</TableHead>
                <TableHead className="text-white/70">Email</TableHead>
                <TableHead className="text-white/70">2026 Total</TableHead>
                <TableHead className="text-white/70">Receipt Status</TableHead>
                <TableHead className="text-white/70">Last Sent</TableHead>
                <TableHead className="text-white/70"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableCell colSpan={6} className="text-center py-12 text-white/50">Loading…</TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableCell colSpan={6} className="text-center py-12 text-white/50">No supporters found.</TableCell>
                </TableRow>
              ) : (
                filtered.map((s) => (
                  <TableRow key={s.id} className="border-white/10 hover:bg-white/5">
                    <TableCell className="text-white font-medium">{s.name}</TableCell>
                    <TableCell className="text-white/70">{s.email || "—"}</TableCell>
                    <TableCell className="text-white">{formatUSD(s.total_2026)}</TableCell>
                    <TableCell>{statusBadge(s.receipt_2026_status)}</TableCell>
                    <TableCell className="text-white/70">
                      {s.receipt_2026_sent_at
                        ? new Date(s.receipt_2026_sent_at).toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-sky-300 hover:text-sky-200 hover:bg-white/10"
                        onClick={() => navigate(`/admin/finance/supporters/${s.id}`)}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
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

            {/* Column mapping — only shown after file is loaded */}
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

            {/* Summary after import */}
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

export default AdminSupporters;
