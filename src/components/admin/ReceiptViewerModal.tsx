import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Download, Mail, AlertCircle } from "lucide-react";

interface ReceiptSendRow {
  id: string;
  receipt_year: number;
  status: string;
  sent_at: string;
  sent_to: string | null;
  subject: string | null;
  email_html: string | null;
  pdf_base64: string | null;
  pdf_filename: string | null;
  personal_message: string | null;
  error: string | null;
  is_regenerated: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Supporter whose receipt history to view. */
  supporterId: string;
  supporterName: string;
}

// Pulls the full history for the supporter, latest first, so the operator
// can see what was actually delivered and step back through prior sends
// (resends, prior-year receipts, failed attempts) if needed.
const ReceiptViewerModal = ({ open, onOpenChange, supporterId, supporterName }: Props) => {
  const [sends, setSends] = useState<ReceiptSendRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !supporterId) return;
    let cancelled = false;
    setLoading(true);
    setSelectedId(null);
    (async () => {
      // receipt_sends isn't in the auto-generated types.ts yet (table is
      // new); cast supabase to any so the table-name check passes. The
      // returned shape is hand-validated via the ReceiptSendRow interface.
      const { data } = await (supabase as any)
        .from("receipt_sends")
        .select("id, receipt_year, status, sent_at, sent_to, subject, email_html, pdf_base64, pdf_filename, personal_message, error, is_regenerated")
        .eq("supporter_id", supporterId)
        .order("sent_at", { ascending: false });
      if (cancelled) return;
      const rows = (data || []) as ReceiptSendRow[];
      setSends(rows);
      setSelectedId(rows[0]?.id ?? null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, supporterId]);

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
    a.download = selected.pdf_filename || `receipt-${supporterName.replace(/\s+/g, "-")}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-white/10 text-white max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-white/10 shrink-0">
          <DialogTitle className="text-white flex items-center gap-2 text-base">
            <Mail className="w-4 h-4 text-green-400" />
            Receipt history — {supporterName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-16 text-white/40 text-sm">
            Loading…
          </div>
        ) : sends.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-16 text-white/40 text-sm">
            No receipt sends recorded for this supporter yet.
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row flex-1 min-h-0">
            {/* Send list (left rail) */}
            <div className="sm:w-56 sm:border-r border-white/10 shrink-0 overflow-y-auto max-h-40 sm:max-h-none">
              {sends.map((s) => {
                const date = new Date(s.sent_at);
                const isSelected = s.id === selectedId;
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
                      <span className="text-sm font-medium text-white">
                        {s.receipt_year} receipt
                      </span>
                      <span
                        className={`text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded ${
                          s.status === "Sent"
                            ? "bg-green-600/20 text-green-400"
                            : "bg-red-600/20 text-red-400"
                        }`}
                      >
                        {s.status}
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
                      {selected.personal_message && (
                        <>
                          <span className="text-white/40">Note</span>
                          <span className="text-white/85 whitespace-pre-wrap italic">{selected.personal_message}</span>
                        </>
                      )}
                    </div>

                    {selected.status === "Failed" && selected.error && (
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
                          The personal message that was attached to the original send is not recoverable,
                          and the PDF and email body reflect today's template and donation records.
                        </p>
                      </div>
                    )}

                    {selected.pdf_base64 && (
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={downloadPdf}
                          className="inline-flex items-center gap-1.5 text-xs text-green-400 hover:text-green-300 hover:underline transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download PDF ({selected.pdf_filename})
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Rendered email body */}
                  {selected.email_html ? (
                    <div className="p-4 bg-white/[0.02]">
                      <p className="text-[10px] uppercase tracking-[0.15em] text-white/30 mb-2">
                        Email body (as delivered)
                      </p>
                      <div
                        className="bg-white rounded-md overflow-hidden border border-white/5"
                        dangerouslySetInnerHTML={{ __html: selected.email_html }}
                      />
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

export default ReceiptViewerModal;
