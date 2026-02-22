import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Upload, Pencil, Trash2, Star, Search, Plus } from "lucide-react";
import SupporterRevenueSection from "@/components/admin/SupporterRevenueSection";
import SupporterEngagementSection from "@/components/admin/SupporterEngagementSection";
import SupporterTasksSection from "@/components/admin/SupporterTasksSection";
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

// ─── Types ────────────────────────────────────────────────────────────────────

type CsvRow = Record<string, string>;

const MAPPABLE_FIELDS = ["name", "story", "email", "phone", "address"] as const;
type MappableField = (typeof MAPPABLE_FIELDS)[number];

const FIELD_LABELS: Record<MappableField, string> = {
  name: "Supporter Name",
  story: "Internal Strategic Notes",
  email: "Primary Contact Email",
  phone: "Primary Contact Phone",
  address: "Address",
};


const PRIMARY_REVENUE_STREAMS = ["Donation", "Sponsorship", "Fee for Service", "Re-Grant"] as const;
const SUPPORTER_STATUSES = ["Donor", "Sponsor", "Meal Train", "Partner", "Advocate", "Volunteer", "Coach"] as const;
const SUPPORTER_CATEGORIES = ["Individual", "Organization"] as const;

interface SupporterRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  story: string | null;
  is_hall_of_fame: boolean;
  primary_revenue_stream: string | null;
  status: string | null;
  relationship_owner: string | null;
  supporter_category: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Parse a single CSV line, correctly handling quoted fields that contain commas or newlines */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // escaped quote inside quoted field
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return [];

  // Skip leading blank/empty rows to find the real header row
  // (Monday.com and some exports prepend blank rows before headers)
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.some((c) => c !== "")) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return [];

  const allHeaders = parseCsvLine(lines[headerIdx]);
  const dataLines = lines.slice(headerIdx + 1).filter(Boolean);

  return dataLines
    .map((line) => {
      const values = parseCsvLine(line);
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
      .select("id, name, email, phone, address, story, is_hall_of_fame, primary_revenue_stream, status, relationship_owner, supporter_category")
      .order("name");
    setRows((data ?? []) as SupporterRow[]);
    setLoadingRows(false);
  }, []);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  // ── Search ──────────────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");

  // Sort: Hall of Fame first (alphabetically within group), then everyone else (alphabetically)
  const sortedRows = [...rows]
    .filter((s) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return [s.name, s.email, s.phone, s.address, s.story, s.supporter_category, s.primary_revenue_stream, s.status, s.relationship_owner]
        .some((field) => field?.toLowerCase().includes(q));
    })
    .sort((a, b) => {
      const aHof = a.is_hall_of_fame ? 0 : 1;
      const bHof = b.is_hall_of_fame ? 0 : 1;
      if (aHof !== bHof) return aHof - bHof;
      return a.name.localeCompare(b.name);
    });

  // ── Edit state ────────────────────────────────────────────────────────────
  const [editRow, setEditRow] = useState<SupporterRow | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [inlineEdit, setInlineEdit] = useState<{ id: string; field: keyof SupporterRow } | null>(null);
  const inlineInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>(null);



  const saveInlineEdit = async (id: string, field: keyof SupporterRow, value: string) => {
    const dbValue = value.trim() || null;
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, [field]: dbValue } : r));
    setInlineEdit(null);
    await supabase.from("supporters").update({ [field]: dbValue }).eq("id", id);
  };

  const handleInlineKeyDown = (e: React.KeyboardEvent, id: string, field: keyof SupporterRow) => {
    if (e.key === "Escape") { setInlineEdit(null); return; }
    if (e.key === "Enter" && field !== "story") {
      saveInlineEdit(id, field, (e.target as HTMLInputElement).value);
    }
  };

  useEffect(() => {
    if (inlineEdit && inlineInputRef.current) {
      inlineInputRef.current.focus();
      if ('select' in inlineInputRef.current && inlineInputRef.current.tagName !== 'SELECT') {
        (inlineInputRef.current as HTMLInputElement).select();
      }
    }
  }, [inlineEdit]);

  const handleEditSave = async () => {
    if (!editRow) return;
    setEditSaving(true);
    await supabase.from("supporters").update({
      name: editRow.name,
      email: editRow.email || null,
      phone: editRow.phone || null,
      address: editRow.address || null,
      story: editRow.story || null,
      supporter_category: editRow.supporter_category || null,
      primary_revenue_stream: editRow.primary_revenue_stream || null,
      status: editRow.status || null,
      relationship_owner: editRow.relationship_owner || null,
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

  // ── Add new supporter state ───────────────────────────────────────────
  const [addOpen, setAddOpen] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const emptyNew = (): Omit<SupporterRow, "id"> => ({
    name: "", email: null, phone: null, address: null, story: null,
    is_hall_of_fame: false, primary_revenue_stream: null, status: null,
    relationship_owner: null, supporter_category: null,
  });
  const [newSupporter, setNewSupporter] = useState<Omit<SupporterRow, "id">>(emptyNew());

  const handleAddSave = async () => {
    if (!newSupporter.name.trim()) return;
    setAddSaving(true);
    await supabase.from("supporters").insert({
      name: newSupporter.name.trim(),
      email: newSupporter.email?.trim() || null,
      phone: newSupporter.phone?.trim() || null,
      address: newSupporter.address?.trim() || null,
      story: newSupporter.story?.trim() || null,
      supporter_category: newSupporter.supporter_category || null,
      primary_revenue_stream: newSupporter.primary_revenue_stream || null,
      status: newSupporter.status || null,
      relationship_owner: newSupporter.relationship_owner?.trim() || null,
    });
    setAddSaving(false);
    setAddOpen(false);
    setNewSupporter(emptyNew());
    await fetchRows();
  };

  // ── Bulk selection state ───────────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const someSelected = selected.size > 0 && !allSelected;

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rows.map((r) => r.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (!selected.size) return;
    setBulkDeleting(true);
    await supabase.from("supporters").delete().in("id", [...selected]);
    setBulkDeleting(false);
    setBulkDeleteOpen(false);
    setSelected(new Set());
    await fetchRows();
  };

  // ── Import modal state ────────────────────────────────────────────────────
  const [importOpen, setImportOpen] = useState(false);
  const [importCategory, setImportCategory] = useState<string>("Individual");
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
    setImportCategory("Individual");
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
        await supabase.from("supporters").insert({ name, email: null, story, phone, address, supporter_category: importCategory });
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
        await supabase.from("supporters").insert({ name, email, story, phone, address, supporter_category: importCategory });
        created++;
      }
    }

    setImporting(false);
    setSummary({ created, updated, skipped });
    await fetchRows();
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="bg-black text-white flex flex-col" style={{ height: 'calc(100vh - 73px)' }}>
      {/* Page header */}
      <div className="border-b border-white/10 px-4 py-3 flex-shrink-0">
        <h2 className="text-base font-semibold text-green-400">Supporters</h2>
        <p className="text-xs text-white/50">Import and manage supporter records</p>
      </div>

      <div className="flex flex-col flex-1 min-h-0 px-4 py-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-4 flex-shrink-0 gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search supporters…"
              className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30 h-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="bg-green-500 hover:bg-green-400 text-black gap-1.5"
              onClick={() => { setNewSupporter(emptyNew()); setAddOpen(true); }}
            >
              <Plus className="w-4 h-4" />
              Add Supporter
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-green-500/40 text-green-400 hover:bg-green-500/10 gap-1.5"
              onClick={() => { resetImport(); setImportOpen(true); }}
            >
              <Upload className="w-4 h-4" />
              Import CSV
            </Button>
          </div>
        </div>

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div className="flex items-center gap-3 mb-3 px-3 py-2 rounded-md bg-red-950/40 border border-red-600/30 flex-shrink-0">
            <span className="text-sm text-white/70">
              <span className="font-semibold text-white">{selected.size}</span> row{selected.size !== 1 ? "s" : ""} selected
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="text-white/50 hover:text-white hover:bg-white/10 text-xs h-7"
              onClick={() => setSelected(new Set())}
            >
              Clear
            </Button>
            <Button
              size="sm"
              className="bg-red-600 hover:bg-red-500 text-white text-xs h-7 gap-1.5 ml-auto"
              onClick={() => setBulkDeleteOpen(true)}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete {selected.size} Selected
            </Button>
          </div>
        )}

        {/* Supporters table — fills remaining height, scrolls both axes */}
        <div className="flex-1 min-h-0 rounded-lg border border-white/10 overflow-auto">
          <table className="w-full caption-bottom text-sm min-w-[1200px]">
            <thead className="sticky top-0 z-10 bg-green-600 shadow-[0_1px_0_rgba(255,255,255,0.12)] [&_tr]:border-b">
              <tr className="border-b border-white/10">
                <th className="h-12 px-3 w-10 text-left align-middle font-medium text-white bg-green-600">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected; }}
                    onChange={toggleAll}
                    className="accent-green-500 w-4 h-4 cursor-pointer"
                    title="Select all"
                  />
                </th>
                <th className="h-12 px-4 w-8 text-center align-middle font-medium text-white text-xs bg-green-600">HOF</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-white bg-green-600">Supporter Name</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-white bg-green-600">Supporter Category</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-white bg-green-600">Primary Revenue Stream</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-white bg-green-600">Status</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-white bg-green-600">Relationship Owner</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-white bg-green-600">Primary Contact Email</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-white bg-green-600">Primary Contact Phone</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-white bg-green-600">Address</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-white bg-green-600 min-w-[280px]">Internal Strategic Notes</th>
                <th className="h-12 px-4 w-20 text-right align-middle font-medium text-white bg-green-600">Actions</th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {loadingRows ? (
                <tr className="border-b border-white/10">
                   <td colSpan={12} className="p-4 text-center py-12 text-white/50 align-middle">Loading…</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr className="border-b border-white/10">
                   <td colSpan={12} className="p-4 text-center py-12 text-white/50 align-middle">No supporters yet. Import a CSV to get started.</td>
                </tr>
              ) : (
                sortedRows.map((s) => (
                  <tr
                    key={s.id}
                    className={`border-b border-white/10 transition-colors hover:bg-white/5 ${selected.has(s.id) ? "bg-red-950/20" : ""}`}
                  >
                    <td className="p-4 px-3 align-middle">
                      <input
                        type="checkbox"
                        checked={selected.has(s.id)}
                        onChange={() => toggleOne(s.id)}
                        className="accent-green-500 w-4 h-4 cursor-pointer"
                      />
                    </td>
                    {/* ★ HOF star toggle */}
                    <td className="p-4 px-2 text-center align-middle">
                      <button
                        title={s.is_hall_of_fame ? "Remove from Hall of Fame" : "Add to Hall of Fame"}
                        onClick={async () => {
                          const newHof = !s.is_hall_of_fame;
                          await supabase.from("supporters").update({ is_hall_of_fame: newHof } as any).eq("id", s.id);
                          setRows((prev) => prev.map((r) => r.id === s.id ? { ...r, is_hall_of_fame: newHof } : r));
                        }}
                        className="p-0.5 rounded hover:bg-white/10 transition-colors"
                      >
                        <Star
                          className={`w-4 h-4 ${s.is_hall_of_fame ? "text-yellow-400 fill-yellow-400" : "text-white/30"}`}
                          strokeWidth={1.5}
                        />
                      </button>
                    </td>
                    {/* Name — double-click to edit */}
                    <td
                      className="p-4 align-middle text-white font-medium cursor-pointer select-none"
                      onDoubleClick={() => setInlineEdit({ id: s.id, field: "name" })}
                      title="Double-click to edit"
                    >
                      {inlineEdit?.id === s.id && inlineEdit.field === "name" ? (
                        <input
                          ref={(el) => { inlineInputRef.current = el; }}
                          defaultValue={s.name}
                          onBlur={(e) => saveInlineEdit(s.id, "name", e.target.value)}
                          onKeyDown={(e) => handleInlineKeyDown(e, s.id, "name")}
                          className="bg-white text-black text-sm rounded px-1.5 py-1 border border-white/20 w-full"
                        />
                      ) : s.name}
                    </td>
                    {/* Category — double-click to edit inline */}
                    <td
                      className="p-4 align-middle text-white/60 text-sm cursor-pointer select-none"
                      onDoubleClick={() => setInlineEdit({ id: s.id, field: "supporter_category" })}
                      title="Double-click to edit"
                    >
                      {inlineEdit?.id === s.id && inlineEdit.field === "supporter_category" ? (
                        <select
                          ref={(el) => { inlineInputRef.current = el; }}
                          autoFocus
                          defaultValue={s.supporter_category ?? ""}
                          onChange={async (e) => {
                            await saveInlineEdit(s.id, "supporter_category", e.target.value);
                          }}
                          onKeyDown={(e) => { if (e.key === "Escape") setInlineEdit(null); }}
                          className="bg-white text-black text-xs rounded px-1.5 py-1 border border-white/20 cursor-pointer"
                        >
                          {SUPPORTER_CATEGORIES.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      ) : (
                        s.supporter_category || "—"
                      )}
                    </td>
                    {/* Primary Revenue Stream — double-click to edit */}
                    <td
                      className="p-4 align-middle text-white/70 text-sm cursor-pointer select-none"
                      onDoubleClick={() => setInlineEdit({ id: s.id, field: "primary_revenue_stream" })}
                      title="Double-click to edit"
                    >
                      {inlineEdit?.id === s.id && inlineEdit.field === "primary_revenue_stream" ? (
                        <select
                          ref={(el) => { inlineInputRef.current = el; }}
                          autoFocus
                          defaultValue={s.primary_revenue_stream ?? ""}
                          onChange={(e) => saveInlineEdit(s.id, "primary_revenue_stream", e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Escape") setInlineEdit(null); }}
                          className="bg-white text-black text-xs rounded px-1.5 py-1 border border-white/20 cursor-pointer"
                        >
                          <option value="">—</option>
                          {PRIMARY_REVENUE_STREAMS.map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      ) : s.primary_revenue_stream || "—"}
                    </td>
                    {/* Status — double-click to edit */}
                    <td
                      className="p-4 align-middle text-white/70 text-sm cursor-pointer select-none"
                      onDoubleClick={() => setInlineEdit({ id: s.id, field: "status" })}
                      title="Double-click to edit"
                    >
                      {inlineEdit?.id === s.id && inlineEdit.field === "status" ? (
                        <select
                          ref={(el) => { inlineInputRef.current = el; }}
                          autoFocus
                          defaultValue={s.status ?? ""}
                          onChange={(e) => saveInlineEdit(s.id, "status", e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Escape") setInlineEdit(null); }}
                          className="bg-white text-black text-xs rounded px-1.5 py-1 border border-white/20 cursor-pointer"
                        >
                          <option value="">—</option>
                          {SUPPORTER_STATUSES.map((st) => (
                            <option key={st} value={st}>{st}</option>
                          ))}
                        </select>
                      ) : s.status || "—"}
                    </td>
                    {/* Relationship Owner — double-click to edit */}
                    <td
                      className="p-4 align-middle text-white/70 text-sm cursor-pointer select-none"
                      onDoubleClick={() => setInlineEdit({ id: s.id, field: "relationship_owner" })}
                      title="Double-click to edit"
                    >
                      {inlineEdit?.id === s.id && inlineEdit.field === "relationship_owner" ? (
                        <input
                          ref={(el) => { inlineInputRef.current = el; }}
                          defaultValue={s.relationship_owner ?? ""}
                          onBlur={(e) => saveInlineEdit(s.id, "relationship_owner", e.target.value)}
                          onKeyDown={(e) => handleInlineKeyDown(e, s.id, "relationship_owner")}
                          className="bg-white text-black text-sm rounded px-1.5 py-1 border border-white/20 w-full"
                        />
                      ) : s.relationship_owner || "—"}
                    </td>
                    {/* Email — double-click to edit */}
                    <td
                      className="p-4 align-middle text-white/70 text-sm cursor-pointer select-none"
                      onDoubleClick={() => setInlineEdit({ id: s.id, field: "email" })}
                      title="Double-click to edit"
                    >
                      {inlineEdit?.id === s.id && inlineEdit.field === "email" ? (
                        <input
                          ref={(el) => { inlineInputRef.current = el; }}
                          defaultValue={s.email ?? ""}
                          onBlur={(e) => saveInlineEdit(s.id, "email", e.target.value)}
                          onKeyDown={(e) => handleInlineKeyDown(e, s.id, "email")}
                          className="bg-white text-black text-sm rounded px-1.5 py-1 border border-white/20 w-full"
                          type="email"
                        />
                      ) : s.email ? (
                        <a href={`mailto:${s.email}`} className="text-green-400 hover:underline">{s.email}</a>
                      ) : "—"}
                    </td>
                    {/* Phone — double-click to edit */}
                    <td
                      className="p-4 align-middle text-white/70 text-sm cursor-pointer select-none"
                      onDoubleClick={() => setInlineEdit({ id: s.id, field: "phone" })}
                      title="Double-click to edit"
                    >
                      {inlineEdit?.id === s.id && inlineEdit.field === "phone" ? (
                        <input
                          ref={(el) => { inlineInputRef.current = el; }}
                          defaultValue={s.phone ?? ""}
                          onBlur={(e) => saveInlineEdit(s.id, "phone", e.target.value)}
                          onKeyDown={(e) => handleInlineKeyDown(e, s.id, "phone")}
                          className="bg-white text-black text-sm rounded px-1.5 py-1 border border-white/20 w-full"
                          type="tel"
                        />
                      ) : s.phone ? (
                        <a href={`tel:${s.phone}`} className="text-green-400 hover:underline">{s.phone}</a>
                      ) : "—"}
                    </td>
                    {/* Address — double-click to edit */}
                    <td
                      className="p-4 align-middle text-white/70 text-sm cursor-pointer select-none"
                      onDoubleClick={() => setInlineEdit({ id: s.id, field: "address" })}
                      title="Double-click to edit"
                    >
                      {inlineEdit?.id === s.id && inlineEdit.field === "address" ? (
                        <input
                          ref={(el) => { inlineInputRef.current = el; }}
                          defaultValue={s.address ?? ""}
                          onBlur={(e) => saveInlineEdit(s.id, "address", e.target.value)}
                          onKeyDown={(e) => handleInlineKeyDown(e, s.id, "address")}
                          className="bg-white text-black text-sm rounded px-1.5 py-1 border border-white/20 w-full"
                        />
                      ) : s.address || "—"}
                    </td>
                    {/* Notes — double-click to edit */}
                    <td
                      className="p-4 align-middle text-white/50 text-xs min-w-[280px] whitespace-pre-wrap break-words align-top py-3 cursor-pointer select-none"
                      onDoubleClick={() => setInlineEdit({ id: s.id, field: "story" })}
                      title="Double-click to edit"
                    >
                      {inlineEdit?.id === s.id && inlineEdit.field === "story" ? (
                        <textarea
                          ref={(el) => { inlineInputRef.current = el; }}
                          defaultValue={s.story ?? ""}
                          onBlur={(e) => saveInlineEdit(s.id, "story", e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Escape") setInlineEdit(null); }}
                          rows={3}
                          className="bg-white text-black text-xs rounded px-1.5 py-1 border border-white/20 w-full resize-y"
                        />
                      ) : s.story || "—"}
                    </td>
                    <td className="p-4 align-middle text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setEditRow({ ...s })}
                          className="p-1.5 rounded text-white/40 hover:text-green-400 hover:bg-white/5 transition-colors"
                          title="Edit full record"
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
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* ── Edit Modal ────────────────────────────────────────────────────────── */}
      <Dialog open={!!editRow} onOpenChange={(o) => { if (!o) setEditRow(null); }}>
        <DialogContent className="bg-zinc-900 border-white/10 text-white sm:max-w-2xl flex flex-col max-h-[85vh] p-0 gap-0">
          <div className="px-6 pt-6 pb-2 shrink-0">
            <DialogHeader>
              <DialogTitle className="text-green-400">Edit Supporter</DialogTitle>
            </DialogHeader>
          </div>
          <div className="overflow-y-auto flex-1 px-6 pb-4 space-y-4 pt-2">
            {editRow && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-white/70">Supporter Name <span className="text-red-400">*</span></Label>
                  <Input
                    value={editRow.name}
                    onChange={(e) => setEditRow({ ...editRow, name: e.target.value })}
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-white/70">Supporter Category</Label>
                  <Select value={editRow.supporter_category ?? ""} onValueChange={(v) => setEditRow({ ...editRow, supporter_category: v || null })}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white">
                      <SelectValue placeholder="— not set —" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-white/10 text-white">
                      {SUPPORTER_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c} className="text-white focus:bg-white/10 focus:text-white">{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-white/70">Primary Contact Email</Label>
                  <Input
                    value={editRow.email ?? ""}
                    onChange={(e) => setEditRow({ ...editRow, email: e.target.value })}
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-white/70">Primary Contact Phone</Label>
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
                <div className="space-y-1.5">
                  <Label className="text-white/70">Primary Revenue Stream</Label>
                  <Select value={editRow.primary_revenue_stream ?? ""} onValueChange={(v) => setEditRow({ ...editRow, primary_revenue_stream: v || null })}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white">
                      <SelectValue placeholder="— not set —" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-white/10 text-white">
                      {PRIMARY_REVENUE_STREAMS.map((r) => (
                        <SelectItem key={r} value={r} className="text-white focus:bg-white/10 focus:text-white">{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-white/70">Status</Label>
                  <Select value={editRow.status ?? ""} onValueChange={(v) => setEditRow({ ...editRow, status: v || null })}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white">
                      <SelectValue placeholder="— not set —" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-white/10 text-white">
                      {SUPPORTER_STATUSES.map((s) => (
                        <SelectItem key={s} value={s} className="text-white focus:bg-white/10 focus:text-white">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-white/70">Relationship Owner</Label>
                  <Input
                    value={editRow.relationship_owner ?? ""}
                    onChange={(e) => setEditRow({ ...editRow, relationship_owner: e.target.value })}
                    className="bg-white/5 border-white/10 text-white"
                    placeholder="Person's name…"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-white/70">Internal Strategic Notes</Label>
                  <textarea
                    rows={3}
                    value={editRow.story ?? ""}
                    onChange={(e) => setEditRow({ ...editRow, story: e.target.value })}
                    className="w-full rounded-md bg-white/5 border border-white/10 text-white text-sm px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-green-500"
                  />
                </div>

                {/* ── Revenue History ─────────────────────────────── */}
                <div className="pt-2 border-t border-white/10">
                  <SupporterRevenueSection supporterId={editRow.id} supporterName={editRow.name} />
                </div>

                {/* ── Engagement History ──────────────────────────── */}
                <div className="pt-2 border-t border-white/10">
                  <SupporterEngagementSection supporterId={editRow.id} supporterName={editRow.name} />
                </div>

                {/* ── Tasks ──────────────────────────────────────── */}
                <div className="pt-2 border-t border-white/10">
                  <SupporterTasksSection supporterId={editRow.id} supporterName={editRow.name} />
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

      {/* ── Add Supporter Modal ──────────────────────────────────────────────── */}
      <Dialog open={addOpen} onOpenChange={(o) => { if (!o) setNewSupporter(emptyNew()); setAddOpen(o); }}>
        <DialogContent className="bg-zinc-900 border-white/10 text-white sm:max-w-lg flex flex-col max-h-[85vh] p-0 gap-0">
          <div className="px-6 pt-6 pb-2 shrink-0">
            <DialogHeader>
              <DialogTitle className="text-green-400">Add New Supporter</DialogTitle>
            </DialogHeader>
          </div>
          <div className="overflow-y-auto flex-1 px-6 pb-2 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-white/70">Supporter Name <span className="text-red-400">*</span></Label>
              <Input value={newSupporter.name} onChange={(e) => setNewSupporter({ ...newSupporter, name: e.target.value })} className="bg-white/5 border-white/10 text-white" placeholder="Full name…" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70">Email</Label>
              <Input type="email" value={newSupporter.email ?? ""} onChange={(e) => setNewSupporter({ ...newSupporter, email: e.target.value })} className="bg-white/5 border-white/10 text-white" placeholder="email@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70">Phone</Label>
              <Input type="tel" value={newSupporter.phone ?? ""} onChange={(e) => setNewSupporter({ ...newSupporter, phone: e.target.value })} className="bg-white/5 border-white/10 text-white" placeholder="+1 (555) 123-4567" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70">Address</Label>
              <Input value={newSupporter.address ?? ""} onChange={(e) => setNewSupporter({ ...newSupporter, address: e.target.value })} className="bg-white/5 border-white/10 text-white" placeholder="Street address…" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70">Supporter Category</Label>
              <Select value={newSupporter.supporter_category ?? ""} onValueChange={(v) => setNewSupporter({ ...newSupporter, supporter_category: v })}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent className="bg-zinc-900 border-white/10 text-white">
                  {SUPPORTER_CATEGORIES.map((c) => <SelectItem key={c} value={c} className="focus:bg-white/10">{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70">Primary Revenue Stream</Label>
              <Select value={newSupporter.primary_revenue_stream ?? ""} onValueChange={(v) => setNewSupporter({ ...newSupporter, primary_revenue_stream: v })}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue placeholder="Select stream" /></SelectTrigger>
                <SelectContent className="bg-zinc-900 border-white/10 text-white">
                  {PRIMARY_REVENUE_STREAMS.map((s) => <SelectItem key={s} value={s} className="focus:bg-white/10">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70">Supporter ID</Label>
              <Select value={newSupporter.status ?? ""} onValueChange={(v) => setNewSupporter({ ...newSupporter, status: v })}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue placeholder="Select status" /></SelectTrigger>
                <SelectContent className="bg-zinc-900 border-white/10 text-white">
                  {SUPPORTER_STATUSES.map((s) => <SelectItem key={s} value={s} className="focus:bg-white/10">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70">Relationship Owner</Label>
              <Input value={newSupporter.relationship_owner ?? ""} onChange={(e) => setNewSupporter({ ...newSupporter, relationship_owner: e.target.value })} className="bg-white/5 border-white/10 text-white" placeholder="Person's name…" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70">Internal Strategic Notes</Label>
              <textarea rows={3} value={newSupporter.story ?? ""} onChange={(e) => setNewSupporter({ ...newSupporter, story: e.target.value })} className="w-full rounded-md bg-white/5 border border-white/10 text-white text-sm px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-green-500" />
            </div>
          </div>
          <div className="px-6 py-4 border-t border-white/10 shrink-0 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setNewSupporter(emptyNew()); setAddOpen(false); }} className="text-white hover:bg-white/10">Cancel</Button>
            <Button onClick={handleAddSave} disabled={!newSupporter.name.trim() || addSaving} className="bg-green-500 hover:bg-green-400 text-black">
              {addSaving ? "Saving…" : "Add Supporter"}
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

      {/* ── Bulk Delete Confirmation ──────────────────────────────────────────── */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={(o) => { if (!o) setBulkDeleteOpen(false); }}>
        <AlertDialogContent className="bg-zinc-900 border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete {selected.size} supporter{selected.size !== 1 ? "s" : ""}?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/50">
              This will permanently remove all {selected.size} selected records. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-white/20 text-white hover:bg-white/10">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="bg-red-600 hover:bg-red-500 text-white"
            >
              {bulkDeleting ? "Deleting…" : `Delete ${selected.size}`}
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
