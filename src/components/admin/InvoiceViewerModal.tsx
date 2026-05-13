import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Download, Mail, AlertCircle, Send } from "lucide-react";

interface InvoiceSendRow {
  id: string;
  invoice_id: string;
  sent_to: string;
  subject: string;
  message: string | null;
  sent_at: string;
  type: string;
  status: string;
  error: string | null;
  email_html: string | null;
  pdf_base64: string | null;
  pdf_filename: string | null;
  is_regenerated: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  /** When true and no audit rows exist on open, the modal auto-invokes
   *  the backfill function for this single invoice and refetches. The
   *  caller should set this when the invoice is known to have been sent
   *  on a pre-audit-logging code path. */
  autoRegenerateIfEmpty?: boolean;
}

// Pulls the full send history for one invoice, latest first. Mirrors
// ReceiptViewerModal so the team has one mental model for viewing what
// went out, regardless of whether it's a receipt or an invoice.
const InvoiceViewerModal = ({
  open,
  onOpenChange,
  invoiceId,
  invoiceNumber,
  clientName,
  autoRegenerateIfEmpty,
}: Props) => {
  const [sends, setSends] = useState<InvoiceSendRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !invoiceId) return;
    let cancelled = false;
    setLoading(true);
    setRegenerating(false);
    setSelectedId(null);

    const fetchSends = async (): Promise<InvoiceSendRow[]> => {
      // invoice_sends is in the auto-generated types but the new columns
      // (email_html, pdf_base64, pdf_filename, is_regenerated) may not be
      // until types.ts regenerates; cast to any to bypass.
      const { data } = await (supabase as any)
        .from("invoice_sends")
        .select("id, invoice_id, sent_to, subject, message, sent_at, type, status, error, email_html, pdf_base64, pdf_filename, is_regenerated")
        .eq("invoice_id", invoiceId)
        .order("sent_at", { ascending: false });
      return ((data || []) as InvoiceSendRow[]);
    };

    (async () => {
      let rows = await fetchSends();
      if (cancelled) return;

      // If no audit rows exist but the caller knows the invoice was sent
      // (pre-audit), regenerate inline so the operator sees something
      // without leaving the modal.
      if (rows.length === 0 && autoRegenerateIfEmpty) {
        setRegenerating(true);
        try {
          await supabase.functions.invoke("backfill-invoice-sends", {
            body: { invoice_id: invoiceId },
          });
          if (cancelled) return;
          rows = await fetchSends();
          if (cancelled) return;
        } catch (e) {
          console.error("Invoice regenerate failed:", e);
        }
        setRegenerating(false);
      }

      setSends(rows);
      setSelectedId(rows[0]?.id ?? null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, invoiceId, autoRegenerateIfEmpty]);

  const selected = sends.find((s) => s.id === selectedId) || null;

  const downloadPdf = () => {
    if (!selected?.pdf_base64) return;
    const byteChars = atob(selected.pdf_base64);
    const byteNumbers = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
    const blob = new Blob([new Uint8Array(byteNumbers)], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = selected.pdf_filename || `NLA_Invoice_${invoiceNumber}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-white/10 text-white max-w-5xl w-[95vw] max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-white/10 shrink-0">
          <DialogTitle className="text-white flex items-center gap-2 text-base">
            <Mail className="w-4 h-4 text-sky-400" />
            Sent history — Invoice {invoiceNumber} · {clientName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-16 text-white/40 text-sm">
            {regenerating ? "Regenerating preview from current data…" : "Loading…"}
          </div>
        ) : sends.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-16 text-white/40 text-sm">
            No sends recorded for this invoice yet.
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row flex-1 min-h-0">
            {/* Send list (left rail) */}
            <div className="sm:w-56 sm:border-r border-white/10 shrink-0 overflow-y-auto max-h-40 sm:max-h-none">
              {sends.map((s) => {
                const date = new Date(s.sent_at);
                const isSelected = s.id === selectedId;
                const typeLabel = s.type === "resend" ? "Resend" : "Initial";
                const TypeIcon = s.type === "resend" ? Send : Mail;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedId(s.id)}
                    className={`w-full text-left px-4 py-3 border-b border-white/5 transition-colors ${
                      isSelected ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-sm font-medium text-white flex items-center gap-1.5">
                        <TypeIcon className="w-3 h-3 text-white/50" />
                        {typeLabel}
                      </span>
                      <span
                        className={`text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded ${
                          s.status === "success"
                            ? "bg-green-600/20 text-green-400"
                            : "bg-red-600/20 text-red-400"
                        }`}
                      >
                        {s.status === "success" ? "Sent" : "Failed"}
                      </span>
                    </div>
                    <p className="text-[11px] text-white/40">
                      {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Detail panel */}
            <div className="flex-1 overflow-y-auto">
              {selected && (
                <>
                  {/* Metadata header */}
                  <div className="px-6 py-4 border-b border-white/10 bg-zinc-900/50">
                    <div className="grid grid-cols-[80px_1fr] gap-x-3 gap-y-1.5 text-xs">
                      <span className="text-white/40">Subject</span>
                      <span className="text-white/85">{selected.subject || "—"}</span>
                      <span className="text-white/40">To</span>
                      <span className="text-white/85">{selected.sent_to || "—"}</span>
                      <span className="text-white/40">Sent</span>
                      <span className="text-white/85">{new Date(selected.sent_at).toLocaleString()}</span>
                      {selected.message && (
                        <>
                          <span className="text-white/40">Note</span>
                          <span className="text-white/85 whitespace-pre-wrap italic">{selected.message}</span>
                        </>
                      )}
                    </div>

                    {selected.status === "failed" && selected.error && (
                      <div className="mt-3 flex items-start gap-2 bg-red-600/10 border border-red-600/20 rounded px-3 py-2">
                        <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-red-300 leading-relaxed font-mono">
                          {selected.error}
                        </p>
                      </div>
                    )}

                    {selected.is_regenerated && (
                      <div className="mt-3 flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded px-3 py-2">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-amber-200/80 leading-relaxed">
                          Regenerated from current data — the original send predates audit logging.
                          The personal note attached to the original send isn't recoverable,
                          and the email body reflects today's template. The attached PDF is the
                          one stored on the invoice record.
                        </p>
                      </div>
                    )}

                    {selected.pdf_base64 && (
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={downloadPdf}
                          className="inline-flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 hover:underline transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download PDF ({selected.pdf_filename || `NLA_Invoice_${invoiceNumber}.pdf`})
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Rendered email body. Email template is a fixed 600px-
                      wide table (standard for email HTML); outer container
                      allows horizontal scroll on narrow windows. */}
                  {selected.email_html ? (
                    <div className="p-4 bg-white/[0.02]">
                      <p className="text-[10px] uppercase tracking-[0.15em] text-white/30 mb-2">
                        Email body (as delivered)
                      </p>
                      <div className="bg-white rounded-md border border-white/5 overflow-auto">
                        <div dangerouslySetInnerHTML={{ __html: selected.email_html }} />
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 text-sm text-white/40 italic">
                      No email body captured for this send.
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default InvoiceViewerModal;
