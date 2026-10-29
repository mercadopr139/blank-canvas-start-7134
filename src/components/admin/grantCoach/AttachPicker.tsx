// Grant Coach — pick the file an "Upload" row asks for (Josh, 2026-10-29).
// Three sources, one dialog: the Vault's standing documents, a file already
// in this folder, or a new upload. Whatever is picked becomes a document in
// this folder (ours) and the row points at it.
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Upload, Vault, FolderOpen, FileText, Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ORG_DOCUMENTS } from "@/lib/grantCoach/orgDocuments";
import { GC_BLUE } from "@/components/admin/grantCoach/GcCard";
import { uploadToFolder, copyVaultDocToFolder, type FolderDoc, type VaultDoc } from "@/lib/grantCoach/attachments";

const kb = (n: number | null) => (n == null ? "" : n > 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`);

export default function AttachPicker({ open, onOpenChange, folderId, label, docs, userId, onPicked }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  folderId: string;
  /** The row's label — the heading of the dialog. */
  label: string;
  /** This folder's documents, both sides. */
  docs: FolderDoc[];
  userId: string | null;
  onPicked: (doc: FolderDoc) => Promise<void> | void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const { data: vault = [] } = useQuery({
    queryKey: ["grant-org-docs-full"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from("grant_org_documents" as never).select("key, storage_path, file_name, mime_type, size_bytes, link_url");
      if (error) throw error;
      return (data ?? []) as unknown as VaultDoc[];
    },
  });
  const onFile = new Map(vault.filter((v) => v.storage_path || v.link_url).map((v) => [v.key, v]));
  const vaultRows = ORG_DOCUMENTS.filter((d) => onFile.has(d.key));

  const run = async (key: string, job: () => Promise<FolderDoc>) => {
    setBusy(key);
    try {
      const doc = await job();
      await onPicked(doc);
      onOpenChange(false);
    } catch (e) {
      toast.error(`Couldn't attach: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  const Row = ({ icon, title, sub, onPick, id }: { icon: React.ReactNode; title: string; sub: string; onPick: () => void; id: string }) => (
    <button type="button" disabled={!!busy} onClick={onPick} className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-white/[0.06] disabled:opacity-60">
      <span className="text-white/45">{busy === id ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-white truncate">{title}</span>
        <span className="block text-[11px] text-white/40 truncate">{sub}</span>
      </span>
      <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: GC_BLUE }}>Attach</span>
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent className="bg-neutral-950 border-white/10 text-white max-w-xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-white">Attach a file</DialogTitle>
          <p className="text-[12px] text-white/50">{label}</p>
        </DialogHeader>
        <div className="overflow-y-auto pr-1 space-y-5">
          <section>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/50 mb-1 flex items-center gap-1.5"><Vault className="w-3.5 h-3.5" /> From the Vault</p>
            {vaultRows.length === 0 ? (
              <p className="text-[12px] text-white/35 px-3 py-1">Nothing on file yet. Upload the standing documents in Grant Coach → Grant Vault → Documents.</p>
            ) : vaultRows.map((d) => {
              const v = onFile.get(d.key)!;
              return <Row key={d.key} id={`v:${d.key}`} icon={v.link_url && !v.storage_path ? <Link2 className="w-4 h-4" /> : <FileText className="w-4 h-4" />} title={d.title} sub={v.link_url && !v.storage_path ? v.link_url : `${v.file_name ?? ""}${v.size_bytes ? ` · ${kb(v.size_bytes)}` : ""} · a copy is filed in this folder`} onPick={() => void run(`v:${d.key}`, () => copyVaultDocToFolder(folderId, v, userId))} />;
            })}
          </section>

          <section>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/50 mb-1 flex items-center gap-1.5"><FolderOpen className="w-3.5 h-3.5" /> In this folder</p>
            {docs.length === 0 ? (
              <p className="text-[12px] text-white/35 px-3 py-1">No files in this folder yet.</p>
            ) : docs.map((d) => (
              <Row key={d.id} id={`f:${d.id}`} icon={d.link_url && !d.storage_path ? <Link2 className="w-4 h-4" /> : <FileText className="w-4 h-4" />} title={d.title} sub={`${d.side === "funder" ? "From the funder" : "Ours"} · ${d.link_url && !d.storage_path ? d.link_url : `${d.file_name ?? ""}${d.size_bytes ? ` · ${kb(d.size_bytes)}` : ""}`}`} onPick={() => void run(`f:${d.id}`, async () => d)} />
            ))}
          </section>

          <section>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/50 mb-2 flex items-center gap-1.5"><Upload className="w-3.5 h-3.5" /> Upload new</p>
            <input ref={fileInput} type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void run("new", () => uploadToFolder(folderId, f, userId)); }} />
            <Button size="sm" onClick={() => fileInput.current?.click()} disabled={!!busy} className="font-bold" style={{ backgroundColor: GC_BLUE, color: "#0a0a0a" }}>
              {busy === "new" ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1.5" />} Choose a file
            </Button>
            <p className="text-[11px] text-white/35 mt-1.5">It lands in this folder's documents under Ours.</p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
