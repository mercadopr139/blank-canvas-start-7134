import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, CheckCircle2, XCircle, AlertTriangle, CloudDownload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Board { id: string; name: string; items_count?: number; }
interface Column { id: string; title: string; type: string; }
interface SyncResult {
  total_monday_items: number;
  matched: number;
  uploaded: number;
  skipped_no_photo: number;
  skipped_already_has_photo: number;
  skipped_no_match: number;
  errors: string[];
  details: Array<{ mondayName: string; status: string; matchedTo?: string }>;
}

type Step = "boards" | "columns" | "syncing" | "results";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSyncComplete: () => void;
}

export default function MondaySyncModal({ open, onOpenChange, onSyncComplete }: Props) {
  const [step, setStep] = useState<Step>("boards");
  const [loading, setLoading] = useState(false);
  const [boards, setBoards] = useState<Board[]>([]);
  const [boardPage, setBoardPage] = useState(1);
  const [hasMoreBoards, setHasMoreBoards] = useState(false);
  const [boardSearch, setBoardSearch] = useState("");
  const [columns, setColumns] = useState<Column[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<string>("");
  const [photoColumn, setPhotoColumn] = useState<string>("");
  const [firstNameColumn, setFirstNameColumn] = useState<string>("");
  const [lastNameColumn, setLastNameColumn] = useState<string>("");
  const [results, setResults] = useState<SyncResult | null>(null);
  const [progress, setProgress] = useState("");

  const reset = () => {
    setStep("boards");
    setLoading(false);
    setBoards([]);
    setBoardPage(1);
    setHasMoreBoards(false);
    setBoardSearch("");
    setColumns([]);
    setSelectedBoard("");
    setPhotoColumn("");
    setFirstNameColumn("");
    setLastNameColumn("");
    setResults(null);
    setProgress("");
  };

  const invoke = async (body: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");
    const { data, error } = await supabase.functions.invoke("sync-monday-photos", { body });
    if (error) throw error;
    return data;
  };

  const loadBoards = async (page = 1, search = "") => {
    setLoading(true);
    try {
      const normalizedSearch = search.trim();

      // If searching from page 1, walk pages until we find at least one match.
      if (normalizedSearch && page === 1) {
        let currentPage = 1;
        let hasMore = true;

        while (hasMore && currentPage <= 20) {
          const data = await invoke({ action: "list_boards", page: currentPage, search: normalizedSearch });
          const foundBoards: Board[] = data.boards || [];

          if (foundBoards.length > 0) {
            setBoards(foundBoards);
            setBoardPage(data.page || currentPage);
            setHasMoreBoards(Boolean(data.hasMore));
            if (selectedBoard && !foundBoards.some((b) => b.id === selectedBoard)) {
              setSelectedBoard("");
            }
            setLoading(false);
            return;
          }

          hasMore = Boolean(data.hasMore);
          currentPage += 1;
        }

        setBoards([]);
        setBoardPage(1);
        setHasMoreBoards(false);
        if (selectedBoard) setSelectedBoard("");
        setLoading(false);
        return;
      }

      const data = await invoke({ action: "list_boards", page, search: normalizedSearch });
      const pageBoards: Board[] = data.boards || [];
      setBoards(pageBoards);
      setBoardPage(data.page || page);
      setHasMoreBoards(Boolean(data.hasMore));
      if (selectedBoard && !pageBoards.some((b) => b.id === selectedBoard)) {
        setSelectedBoard("");
      }
    } catch {
      toast.error("Failed to load Monday.com boards");
    }
    setLoading(false);
  };

  const loadColumns = async () => {
    if (!selectedBoard) return;
    setLoading(true);
    try {
      const data = await invoke({ action: "get_columns", boardId: selectedBoard });
      setColumns(data.columns || []);
      setStep("columns");

      // Auto-detect common column names
      const cols: Column[] = data.columns || [];
      const photo = cols.find(c => c.type === "file" || c.title.toLowerCase().includes("photo") || c.title.toLowerCase().includes("picture") || c.title.toLowerCase().includes("upload"));
      if (photo) setPhotoColumn(photo.id);
      const fn = cols.find(c => c.title.toLowerCase().includes("first name") || c.title.toLowerCase() === "first");
      if (fn) setFirstNameColumn(fn.id);
      const ln = cols.find(c => c.title.toLowerCase().includes("last name") || c.title.toLowerCase() === "last");
      if (ln) setLastNameColumn(ln.id);
    } catch {
      toast.error("Failed to load board columns");
    }
    setLoading(false);
  };

  const startSync = async () => {
    if (!photoColumn) {
      toast.error("Please select the photo column");
      return;
    }
    setStep("syncing");
    setProgress("Fetching items from Monday.com and matching photos...");
    try {
      const data = await invoke({
        action: "sync_photos",
        boardId: selectedBoard,
        photoColumnId: photoColumn,
        firstNameColumnId: firstNameColumn || null,
        lastNameColumnId: lastNameColumn || null,
      });
      setResults(data);
      setStep("results");
      onSyncComplete();
      if (data.uploaded > 0) {
        toast.success(`Successfully imported ${data.uploaded} photos`);
      }
    } catch (err) {
      toast.error("Sync failed: " + String(err));
      setStep("columns");
    }
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  // Load boards once when modal opens
  useEffect(() => {
    if (open) {
      void loadBoards(1, "");
    }
  }, [open]);

  const fileColumns = columns.filter(c => c.type === "file" || c.title.toLowerCase().includes("photo") || c.title.toLowerCase().includes("picture") || c.title.toLowerCase().includes("image") || c.title.toLowerCase().includes("upload"));
  const textColumns = columns.filter(c => c.type === "text" || c.type === "name" || c.type === "short-text");

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CloudDownload className="w-5 h-5" />
            Sync Photos from Monday.com
          </DialogTitle>
        </DialogHeader>

        {step === "boards" && (
          <div className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" />
                Loading boards...
              </div>
            ) : boards.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No boards found for that search. Try a shorter term like “2025” or “Master”.</p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">Select the Monday.com board containing youth registrations:</p>
                <div className="flex gap-2">
                  <Input
                    value={boardSearch}
                    onChange={(e) => setBoardSearch(e.target.value)}
                    placeholder="Search boards by name..."
                  />
                  <Button variant="outline" onClick={() => loadBoards(1, boardSearch)} disabled={loading}>Search</Button>
                </div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {boards.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => setSelectedBoard(b.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        selectedBoard === b.id
                          ? "border-primary bg-primary/10"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <div className="font-medium text-sm">{b.name}</div>
                      <div className="text-xs text-muted-foreground">{typeof b.items_count === "number" ? `${b.items_count} items` : "Board"}</div>
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    onClick={() => loadBoards(Math.max(1, boardPage - 1), boardSearch)}
                    disabled={loading || boardPage <= 1}
                  >
                    Previous
                  </Button>
                  <p className="text-xs text-muted-foreground">Page {boardPage}</p>
                  <Button
                    variant="outline"
                    onClick={() => loadBoards(boardPage + 1, boardSearch)}
                    disabled={loading || !hasMoreBoards}
                  >
                    Next Page
                  </Button>
                </div>
                <Button onClick={loadColumns} disabled={!selectedBoard || loading} className="w-full">
                  Next: Map Columns
                </Button>
              </>
            )}
          </div>
        )}

        {step === "columns" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Map the Monday.com columns to match youth data:</p>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Photo Column *</label>
                <Select value={photoColumn} onValueChange={setPhotoColumn}>
                  <SelectTrigger><SelectValue placeholder="Select photo/file column" /></SelectTrigger>
                  <SelectContent>
                    {(fileColumns.length > 0 ? fileColumns : columns).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.title} ({c.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">First Name Column (optional)</label>
                <Select value={firstNameColumn} onValueChange={setFirstNameColumn}>
                  <SelectTrigger><SelectValue placeholder="Auto-detect from item name" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Use item name instead</SelectItem>
                    {textColumns.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Last Name Column (optional)</label>
                <Select value={lastNameColumn} onValueChange={setLastNameColumn}>
                  <SelectTrigger><SelectValue placeholder="Auto-detect from item name" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Use item name instead</SelectItem>
                    {textColumns.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("boards")} className="flex-1">Back</Button>
              <Button onClick={startSync} disabled={!photoColumn} className="flex-1">
                Start Photo Sync
              </Button>
            </div>
          </div>
        )}

        {step === "syncing" && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground text-center">{progress}</p>
            <p className="text-xs text-muted-foreground">This may take a minute...</p>
          </div>
        )}

        {step === "results" && results && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-muted/50 rounded-lg text-center">
                <div className="text-2xl font-bold">{results.total_monday_items}</div>
                <div className="text-xs text-muted-foreground">Monday Items</div>
              </div>
              <div className="p-3 bg-green-500/10 rounded-lg text-center">
                <div className="text-2xl font-bold text-green-500">{results.uploaded}</div>
                <div className="text-xs text-muted-foreground">Photos Imported</div>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg text-center">
                <div className="text-2xl font-bold">{results.matched}</div>
                <div className="text-xs text-muted-foreground">Matched</div>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg text-center">
                <div className="text-2xl font-bold">{results.skipped_no_match}</div>
                <div className="text-xs text-muted-foreground">No Match</div>
              </div>
            </div>

            {results.skipped_already_has_photo > 0 && (
              <p className="text-sm text-muted-foreground">
                ⏭ {results.skipped_already_has_photo} skipped (already have photos)
              </p>
            )}
            {results.skipped_no_photo > 0 && (
              <p className="text-sm text-muted-foreground">
                📷 {results.skipped_no_photo} items had no photo on Monday.com
              </p>
            )}

            {results.errors.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-destructive flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" /> Errors:
                </p>
                {results.errors.slice(0, 5).map((e, i) => (
                  <p key={i} className="text-xs text-destructive/80">{e}</p>
                ))}
              </div>
            )}

            <ScrollArea className="max-h-[200px]">
              <div className="space-y-1">
                {results.details.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs py-1">
                    {d.status === "uploaded" ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                    ) : d.status === "no_match" ? (
                      <XCircle className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
                    ) : (
                      <span className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span className="text-foreground">{d.mondayName}</span>
                    <span className="text-muted-foreground">→ {d.status}</span>
                    {d.matchedTo && <span className="text-muted-foreground">({d.matchedTo})</span>}
                  </div>
                ))}
              </div>
            </ScrollArea>

            <Button onClick={() => handleOpenChange(false)} className="w-full">Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
