import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = "select_board" | "select_column" | "syncing" | "done";

export default function MondayPhotoSyncModal({ open, onOpenChange }: Props) {
  const [step, setStep] = useState<Step>("select_board");
  const [boards, setBoards] = useState<{ id: string; name: string }[]>([]);
  const [columns, setColumns] = useState<{ id: string; title: string; type: string }[]>([]);
  const [boardSearch, setBoardSearch] = useState("");
  const [selectedBoard, setSelectedBoard] = useState("");
  const [selectedColumn, setSelectedColumn] = useState("");
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [stats, setStats] = useState({ uploaded: 0, skipped: 0, errors: 0, total: 0 });

  const callSync = async (action: string, extra: Record<string, unknown> = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-monday-photos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session?.access_token}`,
        "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ action, ...extra }),
    });
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    return res.json();
  };

  const loadBoards = async () => {
    setLoading(true);
    try {
      const pages = await Promise.all([1,2,3].map(page => callSync("list_boards", { page })));
      const all = pages.flatMap((d: { boards: { id: string; name: string }[] }) => d.boards || []);
      const seen = new Set<string>();
      const unique = all.filter(b => { if (seen.has(b.id)) return false; seen.add(b.id); return true; });
      setBoards(unique);
      setStep("select_board");
    } catch (err) {
      toast.error("Failed to load Monday boards. Check your API token.");
    } finally {
      setLoading(false);
    }
  };

  const loadColumns = async () => {
    if (!selectedBoard) return;
    setLoading(true);
    try {
      const data = await callSync("get_columns", { boardId: selectedBoard });
      const fileCols = (data.columns || []).filter((c: { type: string }) =>
        ["file", "doc"].includes(c.type)
      );
      setColumns(fileCols.length > 0 ? fileCols : data.columns || []);
      setStep("select_column");
    } catch {
      toast.error("Failed to load board columns.");
    } finally {
      setLoading(false);
    }
  };

  const runBatch = async (batchCursor: string | null = null) => {
    setLoading(true);
    setStep("syncing");
    try {
      const data = await callSync("sync_photos", {
        boardId: selectedBoard,
        photoColumnId: selectedColumn,
        batchSize: 20,
        cursor: batchCursor,
        forceReplace: false,
      });
      setStats(prev => ({
        uploaded: prev.uploaded + (data.uploaded || 0),
        skipped: prev.skipped + (data.skipped_already_has_photo || 0) + (data.skipped_no_match || 0),
        errors: prev.errors + (data.errors?.length || 0),
        total: prev.total + (data.total_monday_items || 0),
      }));
      if (data.has_more && data.next_cursor) {
        setCursor(data.next_cursor);
        setHasMore(true);
      } else {
        setCursor(null);
        setHasMore(false);
        setStep("done");
      }
    } catch {
      toast.error("Sync batch failed. Try again.");
      setStep("select_column");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep("select_board");
    setBoards([]);
    setColumns([]);
    setSelectedBoard("");
    setSelectedColumn("");
    setCursor(null);
    setHasMore(false);
    setStats({ uploaded: 0, skipped: 0, errors: 0, total: 0 });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-neutral-900 border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle>Sync Photos from Monday.com</DialogTitle>
          <DialogDescription className="text-white/50">
            Pulls headshots directly from your Monday.com board into your storage.
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Enter board ID */}
        {(step === "select_board") && (
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label className="text-white/70">Board ID</Label>
              <input
                type="text"
                placeholder="Paste your Monday board ID…"
                value={selectedBoard}
                onChange={e => setSelectedBoard(e.target.value.trim())}
                className="w-full rounded-md border border-white/10 bg-neutral-800 text-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white/20"
              />
              <p className="text-xs text-white/40">
                Find it in your Monday.com URL — e.g. monday.com/boards/<strong className="text-white/60">7346136009</strong>
              </p>
            </div>
            <Button onClick={loadColumns} disabled={!selectedBoard || loading} className="w-full">
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading…</> : "Next →"}
            </Button>
          </div>
        )}

        {/* Step 2: Select photo column */}
        {step === "select_column" && (
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label className="text-white/70">Select the headshot/photo column</Label>
              <select
                value={selectedColumn}
                onChange={e => setSelectedColumn(e.target.value)}
                className="w-full rounded-md border border-white/10 bg-neutral-800 text-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white/20"
              >
                <option value="" className="bg-neutral-800 text-white">Choose a column…</option>
                {columns.map(c => (
                  <option key={c.id} value={c.id} className="bg-neutral-800 text-white">{c.title}</option>
                ))}
              </select>
            </div>
            <p className="text-xs text-white/40">It will sync 20 photos at a time. You'll click "Next Batch" until all are done.</p>
            <Button onClick={() => runBatch(null)} disabled={!selectedColumn || loading} className="w-full">
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Starting…</> : "Start Sync"}
            </Button>
          </div>
        )}

        {/* Step 3: Syncing */}
        {step === "syncing" && (
          <div className="space-y-4 mt-2 text-center">
            {loading ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <Loader2 className="w-8 h-8 animate-spin text-white/50" />
                <p className="text-white/70 text-sm">Syncing batch…</p>
              </div>
            ) : (
              <>
                <div className="bg-white/5 rounded-lg p-4 text-left space-y-1 text-sm">
                  <p><span className="text-white/50">Uploaded so far:</span> <span className="text-green-400 font-semibold">{stats.uploaded}</span></p>
                  <p><span className="text-white/50">Skipped (already have photo):</span> {stats.skipped}</p>
                  <p><span className="text-white/50">Errors:</span> {stats.errors}</p>
                </div>
                {hasMore && (
                  <Button onClick={() => runBatch(cursor)} className="w-full">
                    <RefreshCw className="w-4 h-4 mr-2" /> Next Batch (20 more)
                  </Button>
                )}
              </>
            )}
          </div>
        )}

        {/* Step 4: Done */}
        {step === "done" && (
          <div className="space-y-4 mt-2 text-center">
            <div className="flex flex-col items-center gap-2 py-2">
              <CheckCircle2 className="w-10 h-10 text-green-400" />
              <p className="text-white font-semibold">Sync Complete!</p>
            </div>
            <div className="bg-white/5 rounded-lg p-4 text-left space-y-1 text-sm">
              <p><span className="text-white/50">Photos uploaded:</span> <span className="text-green-400 font-semibold">{stats.uploaded}</span></p>
              <p><span className="text-white/50">Already had photos:</span> {stats.skipped}</p>
              <p><span className="text-white/50">Errors:</span> {stats.errors}</p>
            </div>
            <Button onClick={handleClose} className="w-full">Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
