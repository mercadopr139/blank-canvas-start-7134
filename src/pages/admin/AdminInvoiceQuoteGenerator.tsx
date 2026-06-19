// Ad-hoc Quote + Invoice generator. Separate surface from the
// recurring monthly Invoices page (which is wired to clients +
// service_logs). Designed for one-off situations like a Hawk Squad
// daily-rate quote where there's no client row, just a recipient
// and a list of line items.
//
// Layout:
//   - Sticky header with back arrow + doc-type toggle (Quote / Invoice)
//   - "Generate" card: form (recipient, dates, line items, notes)
//     + inline live preview that mirrors the PDF layout closely
//     + actions (Save Draft, Download PDF)
//   - "History" card: searchable table of saved docs with reopen /
//     delete actions
//
// All persistence lands in public.ad_hoc_docs. Doc numbers (QT-XXXX,
// IN-XXXX) come from the next_ad_hoc_doc_number() RPC, which uses
// dedicated sequences so they never collide with the recurring INV
// namespace.

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2, Download, Search, FileText, RotateCcw, FilePlus2 } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  downloadAdHocDocPdf,
  getAdHocDocPdfBase64,
  type AdHocDocType,
  type AdHocLineItem,
} from "@/lib/generateAdHocDocPdf";

// ─── Form state ────────────────────────────────────────────────────

interface FormState {
  docType: AdHocDocType;
  recipientName: string;
  recipientEmail: string;
  recipientAddress: string;
  issueDate: string;   // yyyy-MM-dd
  expiryDate: string;  // yyyy-MM-dd
  lineItems: AdHocLineItem[];
  notes: string;
}

const todayIso = () => format(new Date(), "yyyy-MM-dd");
const thirtyDaysOutIso = () => {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return format(d, "yyyy-MM-dd");
};

const emptyForm = (): FormState => ({
  docType: "quote",
  recipientName: "",
  recipientEmail: "",
  recipientAddress: "",
  issueDate: todayIso(),
  expiryDate: thirtyDaysOutIso(),
  lineItems: [{ description: "", quantity: 1, rate: 0, amount: 0 }],
  notes: "",
});

const recomputeLineAmount = (item: AdHocLineItem): AdHocLineItem => ({
  ...item,
  amount: Number((item.quantity * item.rate).toFixed(2)),
});

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

// ─── Saved doc row type ────────────────────────────────────────────

interface SavedDoc {
  id: string;
  doc_type: AdHocDocType;
  doc_number: string;
  recipient_name: string;
  recipient_email: string | null;
  recipient_address: string | null;
  issue_date: string;
  expiry_date: string | null;
  line_items: AdHocLineItem[];
  subtotal: number;
  total: number;
  notes: string | null;
  status: string;
  pdf_base64: string | null;
  created_at: string;
}

// ─── Component ─────────────────────────────────────────────────────

export default function AdminInvoiceQuoteGenerator() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savedDocNumber, setSavedDocNumber] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [search, setSearch] = useState("");
  const [historyFilter, setHistoryFilter] = useState<"all" | AdHocDocType>("all");
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const subtotal = useMemo(
    () => form.lineItems.reduce((s, i) => s + (i.amount || 0), 0),
    [form.lineItems],
  );
  const total = subtotal; // no tax/discount on v1

  // ─── History query ────────────────────────────────────────────────
  const { data: savedDocs = [] } = useQuery<SavedDoc[]>({
    queryKey: ["ad-hoc-docs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ad_hoc_docs" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data as any[]) || []) as SavedDoc[];
    },
  });

  const filteredDocs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return savedDocs.filter((d) => {
      if (historyFilter !== "all" && d.doc_type !== historyFilter) return false;
      if (!q) return true;
      return (
        d.recipient_name.toLowerCase().includes(q) ||
        d.doc_number.toLowerCase().includes(q) ||
        (d.notes ?? "").toLowerCase().includes(q)
      );
    });
  }, [savedDocs, search, historyFilter]);

  // ─── Form handlers ────────────────────────────────────────────────

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((p) => ({ ...p, [key]: value }));

  const updateLine = (idx: number, patch: Partial<AdHocLineItem>) =>
    setForm((p) => ({
      ...p,
      lineItems: p.lineItems.map((it, i) =>
        i === idx ? recomputeLineAmount({ ...it, ...patch }) : it,
      ),
    }));

  const addLine = () =>
    setForm((p) => ({
      ...p,
      lineItems: [...p.lineItems, { description: "", quantity: 1, rate: 0, amount: 0 }],
    }));

  const removeLine = (idx: number) =>
    setForm((p) => ({
      ...p,
      lineItems: p.lineItems.length === 1
        ? p.lineItems  // keep at least one line
        : p.lineItems.filter((_, i) => i !== idx),
    }));

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
    setSavedDocNumber(null);
  };

  const loadDocIntoForm = (d: SavedDoc) => {
    setForm({
      docType: d.doc_type,
      recipientName: d.recipient_name,
      recipientEmail: d.recipient_email ?? "",
      recipientAddress: d.recipient_address ?? "",
      issueDate: d.issue_date,
      expiryDate: d.expiry_date ?? thirtyDaysOutIso(),
      lineItems: d.line_items.length > 0 ? d.line_items : emptyForm().lineItems,
      notes: d.notes ?? "",
    });
    setEditingId(d.id);
    setSavedDocNumber(d.doc_number);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ─── Save / Update ────────────────────────────────────────────────

  const buildPdfData = (docNumber: string) => ({
    docType: form.docType,
    docNumber,
    recipientName: form.recipientName,
    recipientEmail: form.recipientEmail || null,
    recipientAddress: form.recipientAddress || null,
    issueDate: new Date(form.issueDate + "T00:00:00"),
    expiryDate: form.expiryDate ? new Date(form.expiryDate + "T00:00:00") : null,
    lineItems: form.lineItems.filter((i) => i.description.trim() || i.amount > 0),
    subtotal,
    total,
    notes: form.notes || null,
  });

  const validateForm = (): string | null => {
    if (!form.recipientName.trim()) return "Recipient name is required.";
    if (form.lineItems.every((i) => !i.description.trim() && i.amount === 0)) {
      return "Add at least one line item.";
    }
    return null;
  };

  const handleSave = async () => {
    const err = validateForm();
    if (err) {
      toast({ title: err, variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      let docNumber = savedDocNumber;
      if (!docNumber) {
        const { data: numData, error: numErr } = await supabase.rpc(
          "next_ad_hoc_doc_number" as any,
          { p_doc_type: form.docType } as any,
        );
        if (numErr) throw numErr;
        docNumber = numData as unknown as string;
      }

      const pdfBase64 = await getAdHocDocPdfBase64(buildPdfData(docNumber!));
      const payload = {
        doc_type: form.docType,
        doc_number: docNumber,
        recipient_name: form.recipientName.trim(),
        recipient_email: form.recipientEmail.trim() || null,
        recipient_address: form.recipientAddress.trim() || null,
        issue_date: form.issueDate,
        expiry_date: form.expiryDate || null,
        line_items: form.lineItems.filter(
          (i) => i.description.trim() || i.amount > 0,
        ),
        subtotal,
        total,
        notes: form.notes.trim() || null,
        pdf_base64: pdfBase64,
        pdf_generated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { error } = await supabase
          .from("ad_hoc_docs" as any)
          .update(payload as any)
          .eq("id", editingId);
        if (error) throw error;
        toast({ title: `${form.docType === "quote" ? "Quote" : "Invoice"} updated` });
      } else {
        const { data, error } = await supabase
          .from("ad_hoc_docs" as any)
          .insert({ ...payload, created_by: user?.id ?? null } as any)
          .select("id")
          .single();
        if (error) throw error;
        setEditingId((data as { id: string }).id);
        setSavedDocNumber(docNumber);
        toast({ title: `${form.docType === "quote" ? "Quote" : "Invoice"} saved`, description: `Doc # ${docNumber}` });
      }
      qc.invalidateQueries({ queryKey: ["ad-hoc-docs"] });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  // Duplicate the current form values into a brand-new doc with the next
  // doc number, leaving the original (editingId) untouched. Used when an
  // admin wants to edit an existing doc but keep both versions in history
  // — e.g. revising a quote without overwriting what was already sent.
  // Same doc type as the current edit (Quote stays Quote, Invoice stays
  // Invoice).
  const handleSaveAsNew = async () => {
    const err = validateForm();
    if (err) {
      toast({ title: err, variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const { data: numData, error: numErr } = await supabase.rpc(
        "next_ad_hoc_doc_number" as any,
        { p_doc_type: form.docType } as any,
      );
      if (numErr) throw numErr;
      const docNumber = numData as unknown as string;

      const pdfBase64 = await getAdHocDocPdfBase64(buildPdfData(docNumber));
      const payload = {
        doc_type: form.docType,
        doc_number: docNumber,
        recipient_name: form.recipientName.trim(),
        recipient_email: form.recipientEmail.trim() || null,
        recipient_address: form.recipientAddress.trim() || null,
        issue_date: form.issueDate,
        expiry_date: form.expiryDate || null,
        line_items: form.lineItems.filter(
          (i) => i.description.trim() || i.amount > 0,
        ),
        subtotal,
        total,
        notes: form.notes.trim() || null,
        pdf_base64: pdfBase64,
        pdf_generated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase
        .from("ad_hoc_docs" as any)
        .insert({ ...payload, created_by: user?.id ?? null } as any)
        .select("id")
        .single();
      if (error) throw error;
      // Switch the editor to point at the new doc — feels like the user
      // is now working on the new copy, original is preserved in History.
      setEditingId((data as { id: string }).id);
      setSavedDocNumber(docNumber);
      toast({
        title: `${form.docType === "quote" ? "Quote" : "Invoice"} saved as new`,
        description: `Doc # ${docNumber} — original kept intact in History.`,
      });
      qc.invalidateQueries({ queryKey: ["ad-hoc-docs"] });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = async () => {
    const err = validateForm();
    if (err) {
      toast({ title: err, variant: "destructive" });
      return;
    }
    setIsDownloading(true);
    try {
      // Reserve a number from the sequence even on a download-only run so
      // the doc on disk matches what the user would see if they save next.
      let docNumber = savedDocNumber;
      if (!docNumber) {
        const { data: numData, error: numErr } = await supabase.rpc(
          "next_ad_hoc_doc_number" as any,
          { p_doc_type: form.docType } as any,
        );
        if (numErr) throw numErr;
        docNumber = numData as unknown as string;
        setSavedDocNumber(docNumber);
      }
      await downloadAdHocDocPdf(buildPdfData(docNumber!));
    } catch (e: any) {
      toast({ title: "Download failed", description: e.message, variant: "destructive" });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadSaved = async (d: SavedDoc) => {
    if (!d.pdf_base64) {
      toast({ title: "No PDF stored", description: "Open this doc and click Download PDF to regenerate." });
      return;
    }
    const byteChars = atob(d.pdf_base64);
    const byteNumbers = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
    const blob = new Blob([new Uint8Array(byteNumbers)], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `NLA_${d.doc_type === "quote" ? "Quote" : "Invoice"}_${d.doc_number}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    try {
      const { error } = await supabase
        .from("ad_hoc_docs" as any)
        .delete()
        .eq("id", deleteTargetId);
      if (error) throw error;
      toast({ title: "Deleted" });
      if (editingId === deleteTargetId) resetForm();
      qc.invalidateQueries({ queryKey: ["ad-hoc-docs"] });
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    } finally {
      setDeleteTargetId(null);
    }
  };

  // ─── Reset expiry default when doc type changes ─────────────────
  useEffect(() => {
    // Only auto-adjust on type flip while creating a new doc — don't
    // overwrite an explicit date the user set, or one loaded from a
    // saved doc currently being edited.
    if (!editingId && !form.expiryDate) {
      setForm((p) => ({ ...p, expiryDate: thirtyDaysOutIso() }));
    }
  }, [form.docType, editingId, form.expiryDate]);

  const isQuote = form.docType === "quote";
  const expiryLabel = isQuote ? "Valid Until" : "Due Date";

  return (
    <div className="bg-black text-white min-h-screen">
      {/* Header */}
      <div className="border-b border-white/10 px-4 py-3 sticky top-0 bg-black z-20 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/admin/sales-marketing")}
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-base font-semibold text-white leading-none">
              Invoice / Quote Generator
            </h2>
            <p className="text-xs text-white/50 mt-0.5">
              One-off proposals & bills with the NLA template
            </p>
          </div>
        </div>

        {/* Doc-type toggle */}
        <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-md p-1">
          {(["quote", "invoice"] as AdHocDocType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => updateField("docType", t)}
              disabled={!!editingId}
              className={`px-3 py-1 text-xs font-semibold rounded transition-colors capitalize ${
                form.docType === t
                  ? "bg-white text-black"
                  : "text-white/60 hover:text-white"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              title={editingId ? "Can't change type after save" : `Switch to ${t}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6 max-w-5xl">
        {/* Generate card */}
        <div className="bg-white/[0.03] border border-white/10 rounded-lg p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-white">
                {editingId ? `Editing ${isQuote ? "Quote" : "Invoice"}` : `New ${isQuote ? "Quote" : "Invoice"}`}
              </h3>
              {savedDocNumber && (
                <p className="text-xs text-white/60 mt-0.5">
                  Doc # <span className="font-mono text-white">{savedDocNumber}</span>
                </p>
              )}
            </div>
            {editingId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetForm}
                className="text-white/60 hover:text-white hover:bg-white/10 gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Start new
              </Button>
            )}
          </div>

          {/* Recipient */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-white/50 font-semibold">
                Recipient name *
              </label>
              <Input
                value={form.recipientName}
                onChange={(e) => updateField("recipientName", e.target.value)}
                placeholder="e.g. Pittsgrove School District"
                className="bg-white/5 border-white/10 text-white mt-1"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-white/50 font-semibold">
                Recipient email
              </label>
              <Input
                type="email"
                value={form.recipientEmail}
                onChange={(e) => updateField("recipientEmail", e.target.value)}
                placeholder="contact@example.com"
                className="bg-white/5 border-white/10 text-white mt-1"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] uppercase tracking-wider text-white/50 font-semibold">
                Recipient address
              </label>
              <Textarea
                value={form.recipientAddress}
                onChange={(e) => updateField("recipientAddress", e.target.value)}
                placeholder={"Contact Name\n123 Main St\nCity, ST 12345"}
                className="bg-white/5 border-white/10 text-white mt-1 min-h-[72px] text-sm"
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-white/50 font-semibold">
                Issue date
              </label>
              <Input
                type="date"
                value={form.issueDate}
                onChange={(e) => updateField("issueDate", e.target.value)}
                className="bg-white/5 border-white/10 text-white mt-1"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-white/50 font-semibold">
                {expiryLabel}
              </label>
              <Input
                type="date"
                value={form.expiryDate}
                onChange={(e) => updateField("expiryDate", e.target.value)}
                className="bg-white/5 border-white/10 text-white mt-1"
              />
            </div>
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] uppercase tracking-wider text-white/50 font-semibold">
                Line items
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addLine}
                className="text-[#bf0f3e] hover:text-[#d11447] hover:bg-white/5 h-7 px-2 text-xs gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Add line
              </Button>
            </div>

            <div className="bg-white/[0.02] border border-white/10 rounded overflow-hidden">
              <div className="grid grid-cols-[1fr_70px_100px_110px_36px] gap-2 px-3 py-2 border-b border-white/10 text-[10px] uppercase tracking-wider text-white/40 font-semibold">
                <span>Description</span>
                <span className="text-center">Qty</span>
                <span className="text-right">Rate</span>
                <span className="text-right">Amount</span>
                <span aria-hidden />
              </div>
              {form.lineItems.map((item, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-[1fr_70px_100px_110px_36px] gap-2 px-3 py-2 border-b border-white/[0.06] last:border-b-0 items-center"
                >
                  <Input
                    value={item.description}
                    onChange={(e) => updateLine(idx, { description: e.target.value })}
                    placeholder="e.g. Hawk Squad Program — Daily Rate"
                    className="bg-white/5 border-white/10 text-white text-sm h-8"
                  />
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.quantity}
                    onChange={(e) =>
                      updateLine(idx, { quantity: Number(e.target.value) || 0 })
                    }
                    className="bg-white/5 border-white/10 text-white text-sm h-8 text-center"
                  />
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.rate}
                    onChange={(e) =>
                      updateLine(idx, { rate: Number(e.target.value) || 0 })
                    }
                    className="bg-white/5 border-white/10 text-white text-sm h-8 text-right"
                  />
                  <div className="text-right text-sm tabular-nums text-white px-2">
                    {formatCurrency(item.amount)}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeLine(idx)}
                    disabled={form.lineItems.length === 1}
                    className="h-7 w-7 text-white/40 hover:text-red-400 hover:bg-white/5 disabled:opacity-30"
                    title="Remove line"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex justify-end mt-3 text-sm">
              <div className="bg-white/5 border border-white/10 rounded px-4 py-2 min-w-[220px]">
                <div className="flex justify-between text-white/60">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{formatCurrency(subtotal)}</span>
                </div>
                <div className="border-t border-white/10 mt-1.5 pt-1.5 flex justify-between font-semibold text-white">
                  <span>{isQuote ? "Total" : "Total Due"}</span>
                  <span className="tabular-nums text-base">{formatCurrency(total)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-white/50 font-semibold">
              {isQuote ? "Terms / notes" : "Payment terms / notes"}
            </label>
            <Textarea
              value={form.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              placeholder={
                isQuote
                  ? "e.g. Quote valid through end of school year. Pricing assumes…"
                  : "e.g. Payable by check to No Limits Boxing Academy, Inc."
              }
              className="bg-white/5 border-white/10 text-white mt-1 min-h-[80px] text-sm"
            />
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 justify-end pt-2 border-t border-white/10">
            <Button
              variant="outline"
              onClick={handleDownload}
              disabled={isDownloading}
              className="bg-white text-neutral-900 border-neutral-300 hover:bg-neutral-100 hover:text-neutral-900 gap-1.5"
            >
              <Download className="w-4 h-4" />
              {isDownloading ? "Generating…" : "Download PDF"}
            </Button>
            {/* Only show "Save as New" when editing an existing doc — for a
                brand-new doc, the primary Save button already creates a new
                row, so a second button would be redundant. */}
            {editingId && (
              <Button
                variant="outline"
                onClick={handleSaveAsNew}
                disabled={isSaving}
                className="border-white/20 bg-transparent text-white hover:bg-white/10 gap-1.5"
                title={`Save your edits as a new ${isQuote ? "Quote" : "Invoice"} — the original stays untouched.`}
              >
                <FilePlus2 className="w-4 h-4" />
                {isSaving ? "Saving…" : "Save as New"}
              </Button>
            )}
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-[#bf0f3e] hover:bg-[#d11447] text-white font-semibold gap-1.5"
            >
              <FileText className="w-4 h-4" />
              {isSaving
                ? "Saving…"
                : editingId
                  ? "Update"
                  : `Save ${isQuote ? "Quote" : "Invoice"}`}
            </Button>
          </div>
        </div>

        {/* History */}
        <div className="bg-white/[0.03] border border-white/10 rounded-lg p-5">
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <h3 className="font-semibold text-white">History</h3>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded p-0.5">
                {(["all", "quote", "invoice"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setHistoryFilter(f)}
                    className={`px-2 py-1 text-xs font-semibold rounded capitalize transition-colors ${
                      historyFilter === f
                        ? "bg-white text-black"
                        : "text-white/60 hover:text-white"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search…"
                  className="bg-white/5 border-white/10 text-white pl-7 h-8 w-44 text-sm"
                />
              </div>
            </div>
          </div>

          {filteredDocs.length === 0 ? (
            <p className="text-sm text-white/40 italic text-center py-8">
              {savedDocs.length === 0
                ? "No quotes or invoices yet. Fill out the form above and save your first one."
                : "No matches."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">
                  <tr className="border-b border-white/10">
                    <th className="text-left px-2 py-2">Doc #</th>
                    <th className="text-left px-2 py-2">Type</th>
                    <th className="text-left px-2 py-2">Recipient</th>
                    <th className="text-right px-2 py-2">Total</th>
                    <th className="text-left px-2 py-2">Issued</th>
                    <th className="text-right px-2 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocs.map((d) => (
                    <tr
                      key={d.id}
                      className="border-b border-white/[0.06] hover:bg-white/[0.03] transition-colors"
                    >
                      <td className="px-2 py-2 font-mono text-white/80 text-xs">
                        {d.doc_number}
                      </td>
                      <td className="px-2 py-2">
                        <Badge
                          variant="outline"
                          className={`text-[10px] capitalize ${
                            d.doc_type === "quote"
                              ? "border-sky-500/40 text-sky-300 bg-sky-500/10"
                              : "border-amber-500/40 text-amber-300 bg-amber-500/10"
                          }`}
                        >
                          {d.doc_type}
                        </Badge>
                      </td>
                      <td className="px-2 py-2 text-white/90 truncate max-w-[200px]">
                        {d.recipient_name}
                      </td>
                      <td className="px-2 py-2 text-right text-white tabular-nums">
                        {formatCurrency(Number(d.total))}
                      </td>
                      <td className="px-2 py-2 text-white/60 text-xs">
                        {format(new Date(d.issue_date + "T00:00:00"), "MMM d, yyyy")}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <div className="inline-flex gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => loadDocIntoForm(d)}
                            className="h-7 px-2 text-xs text-white/70 hover:text-white hover:bg-white/10"
                          >
                            Open
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownloadSaved(d)}
                            className="h-7 px-2 text-xs text-white/70 hover:text-white hover:bg-white/10"
                            title="Download stored PDF"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTargetId(d.id)}
                            className="h-7 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirm */}
      <AlertDialog
        open={!!deleteTargetId}
        onOpenChange={(o) => { if (!o) setDeleteTargetId(null); }}
      >
        <AlertDialogContent className="bg-neutral-900 border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete this doc?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              This permanently removes the saved quote/invoice and its stored PDF.
              The doc number is not reused.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/[0.04] border-white/10 text-white hover:bg-white/10">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
