import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search, Plus, ExternalLink, ArrowLeft, MoreVertical, Pencil, Trash2,
  ArrowUpDown, FolderOpen,
  Scale, ShieldCheck, Users, Landmark, FileText, Building2, Handshake, BadgeCheck,
  Settings, Folder, BookOpen, Heart, Star, Globe, Archive, Briefcase, Key, Clock,
} from "lucide-react";
import { format } from "date-fns";

/* ── Icon registry ── */
const ICON_MAP: Record<string, React.ComponentType<any>> = {
  Scale, ShieldCheck, Users, Landmark, FileText, Building2, Handshake, BadgeCheck,
  Settings, Folder, BookOpen, Heart, Star, Globe, Archive, Briefcase, Key, Clock,
  FolderOpen,
};
const ICON_OPTIONS = Object.keys(ICON_MAP);
const getIcon = (name: string) => ICON_MAP[name] || Folder;

/* ── Types ── */
interface VaultCategory {
  id: string; name: string; icon: string; sort_order: number;
  created_at: string; updated_at: string;
}
interface VaultDocument {
  id: string; category_id: string; name: string; description: string | null;
  drive_link: string; added_by: string | null;
  sort_order: number; created_at: string; updated_at: string;
}

/* ──────────────────────────────────────────── */
const AdminDocumentVault = () => {
  const qc = useQueryClient();
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [globalSearch, setGlobalSearch] = useState("");

  /* ── Category CRUD state ── */
  const [catModal, setCatModal] = useState(false);
  const [editingCat, setEditingCat] = useState<VaultCategory | null>(null);
  const [catName, setCatName] = useState("");
  const [catIcon, setCatIcon] = useState("Folder");

  /* ── Document CRUD state ── */
  const [docModal, setDocModal] = useState(false);
  const [editingDoc, setEditingDoc] = useState<VaultDocument | null>(null);
  const [docName, setDocName] = useState("");
  const [docDesc, setDocDesc] = useState("");
  const [docLink, setDocLink] = useState("");
  const [docMoveCatId, setDocMoveCatId] = useState("");

  /* ── Queries ── */
  const { data: categories = [] } = useQuery<VaultCategory[]>({
    queryKey: ["vault-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vault_categories").select("*").order("sort_order");
      if (error) throw error;
      return data as any;
    },
  });

  const { data: allDocs = [] } = useQuery<VaultDocument[]>({
    queryKey: ["vault-documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vault_documents").select("*").order("sort_order");
      if (error) throw error;
      return data as any;
    },
  });

  /* ── Category mutations ── */
  const upsertCat = useMutation({
    mutationFn: async () => {
      if (editingCat) {
        const { error } = await supabase.from("vault_categories")
          .update({ name: catName, icon: catIcon }).eq("id", editingCat.id);
        if (error) throw error;
      } else {
        const maxOrder = categories.length ? Math.max(...categories.map(c => c.sort_order)) + 1 : 0;
        const { error } = await supabase.from("vault_categories")
          .insert({ name: catName, icon: catIcon, sort_order: maxOrder });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vault-categories"] });
      toast.success(editingCat ? "Category updated" : "Category added");
      setCatModal(false);
    },
  });

  const deleteCat = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vault_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vault-categories"] });
      qc.invalidateQueries({ queryKey: ["vault-documents"] });
      toast.success("Category deleted");
      if (selectedCatId) setSelectedCatId(null);
    },
  });

  const moveCatOrder = useMutation({
    mutationFn: async ({ id, dir }: { id: string; dir: -1 | 1 }) => {
      const sorted = [...categories].sort((a, b) => a.sort_order - b.sort_order);
      const idx = sorted.findIndex(c => c.id === id);
      const swapIdx = idx + dir;
      if (swapIdx < 0 || swapIdx >= sorted.length) return;
      const a = sorted[idx], b = sorted[swapIdx];
      await supabase.from("vault_categories").update({ sort_order: b.sort_order }).eq("id", a.id);
      await supabase.from("vault_categories").update({ sort_order: a.sort_order }).eq("id", b.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vault-categories"] }),
  });

  /* ── Document mutations ── */
  const upsertDoc = useMutation({
    mutationFn: async () => {
      const catId = docMoveCatId || selectedCatId!;
      const payload: any = {
        name: docName, description: docDesc || null, drive_link: docLink,
        category_id: catId,
      };
      if (editingDoc) {
        const { error } = await supabase.from("vault_documents")
          .update(payload).eq("id", editingDoc.id);
        if (error) throw error;
      } else {
        const catDocs = allDocs.filter(d => d.category_id === catId);
        payload.sort_order = catDocs.length ? Math.max(...catDocs.map(d => d.sort_order)) + 1 : 0;
        const { error } = await supabase.from("vault_documents").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vault-documents"] });
      toast.success(editingDoc ? "Document updated" : "Document added");
      setDocModal(false);
    },
  });

  const deleteDoc = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vault_documents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vault-documents"] });
      toast.success("Document deleted");
    },
  });

  const moveDocOrder = useMutation({
    mutationFn: async ({ id, dir }: { id: string; dir: -1 | 1 }) => {
      const catDocs = filteredDocs.sort((a, b) => a.sort_order - b.sort_order);
      const idx = catDocs.findIndex(d => d.id === id);
      const swapIdx = idx + dir;
      if (swapIdx < 0 || swapIdx >= catDocs.length) return;
      const a = catDocs[idx], b = catDocs[swapIdx];
      await supabase.from("vault_documents").update({ sort_order: b.sort_order }).eq("id", a.id);
      await supabase.from("vault_documents").update({ sort_order: a.sort_order }).eq("id", b.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vault-documents"] }),
  });

  /* ── Helpers ── */
  const openCatModal = (cat?: VaultCategory) => {
    setEditingCat(cat || null);
    setCatName(cat?.name || "");
    setCatIcon(cat?.icon || "Folder");
    setCatModal(true);
  };

  const openDocModal = (doc?: VaultDocument) => {
    setEditingDoc(doc || null);
    setDocName(doc?.name || "");
    setDocDesc(doc?.description || "");
    setDocLink(doc?.drive_link || "");
    setDocMoveCatId(doc?.category_id || "");
    setDocModal(true);
  };

  const selectedCat = categories.find(c => c.id === selectedCatId);
  const filteredDocs = allDocs
    .filter(d => selectedCatId ? d.category_id === selectedCatId : false)
    .sort((a, b) => a.sort_order - b.sort_order);

  /* ── Global search ── */
  const searchResults = globalSearch.trim().length >= 2
    ? allDocs.filter(d =>
        d.name.toLowerCase().includes(globalSearch.toLowerCase()) ||
        (d.description || "").toLowerCase().includes(globalSearch.toLowerCase())
      )
    : null;

  const getCatName = (catId: string) => categories.find(c => c.id === catId)?.name || "—";

  /* ──────── RENDER ──────── */
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {selectedCatId && (
            <Button size="sm" variant="ghost" onClick={() => setSelectedCatId(null)}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
          )}
          <div>
            <h2 className="text-xl font-bold text-white">
              {selectedCat ? selectedCat.name : "Document Vault"}
            </h2>
            <p className="text-sm text-zinc-400">
              {selectedCat ? `${filteredDocs.length} document(s)` : "Centralized Google Drive document hub"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-zinc-500" />
            <Input
              placeholder="Search documents…"
              value={globalSearch}
              onChange={e => setGlobalSearch(e.target.value)}
              className="pl-9 bg-zinc-900 border-zinc-700 text-white w-full sm:w-64"
            />
          </div>
          {selectedCatId ? (
            <Button size="sm" onClick={() => openDocModal()} className="bg-sky-600 hover:bg-sky-700 text-white">
              <Plus className="w-4 h-4 mr-1" /> Add Document
            </Button>
          ) : (
            <Button size="sm" onClick={() => openCatModal()} className="bg-sky-600 hover:bg-sky-700 text-white">
              <Plus className="w-4 h-4 mr-1" /> Add Category
            </Button>
          )}
        </div>
      </div>

      {/* ── Global search results ── */}
      {searchResults && (
        <div className="space-y-2">
          <p className="text-sm text-zinc-400">{searchResults.length} result(s)</p>
          {searchResults.map(doc => {
            const Icon = getIcon(categories.find(c => c.id === doc.category_id)?.icon || "Folder");
            return (
              <Card key={doc.id} className="bg-zinc-900/60 border-zinc-700/50">
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className="w-5 h-5 text-sky-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-white font-medium truncate">{doc.name}</p>
                      <p className="text-xs text-zinc-500">{getCatName(doc.category_id)}</p>
                    </div>
                  </div>
                  <a href={doc.drive_link} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="border-sky-500/40 text-sky-400 hover:bg-sky-500/10">
                      <ExternalLink className="w-3.5 h-3.5 mr-1" /> Open
                    </Button>
                  </a>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Category grid (dashboard) ── */}
      {!selectedCatId && !searchResults && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map(cat => {
            const Icon = getIcon(cat.icon);
            const count = allDocs.filter(d => d.category_id === cat.id).length;
            return (
              <Card
                key={cat.id}
                className="bg-zinc-900/60 border-zinc-700/50 hover:border-sky-500/40 transition-colors cursor-pointer group relative"
                onClick={() => setSelectedCatId(cat.id)}
              >
                <CardContent className="p-5 flex items-start gap-4">
                  <div className="w-11 h-11 rounded-lg bg-sky-500/10 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-sky-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-semibold truncate">{cat.name}</p>
                    <p className="text-sm text-zinc-400">{count} document{count !== 1 ? "s" : ""}</p>
                  </div>
                  {/* Actions */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                      <Button size="icon" variant="ghost" className="opacity-0 group-hover:opacity-100 h-8 w-8">
                        <MoreVertical className="w-4 h-4 text-zinc-400" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
                      <DropdownMenuItem onClick={() => openCatModal(cat)}>
                        <Pencil className="w-3.5 h-3.5 mr-2" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => moveCatOrder.mutate({ id: cat.id, dir: -1 })}>
                        <ArrowUpDown className="w-3.5 h-3.5 mr-2" /> Move Up
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => moveCatOrder.mutate({ id: cat.id, dir: 1 })}>
                        <ArrowUpDown className="w-3.5 h-3.5 mr-2" /> Move Down
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-400 focus:text-red-400"
                        onClick={() => { if (confirm(`Delete "${cat.name}" and all its documents?`)) deleteCat.mutate(cat.id); }}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Document list ── */}
      {selectedCatId && !searchResults && (
        <div className="space-y-3">
          {filteredDocs.length === 0 && (
            <p className="text-zinc-500 text-sm text-center py-8">No documents yet. Click "Add Document" to get started.</p>
          )}
          {filteredDocs.map(doc => (
            <Card key={doc.id} className="bg-zinc-900/60 border-zinc-700/50">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-white font-medium">{doc.name}</p>
                    </div>
                    {doc.description && <p className="text-sm text-zinc-400">{doc.description}</p>}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                      <span>Added {format(new Date(doc.created_at), "MMM d, yyyy")}</span>
                      {doc.added_by && <span>by {doc.added_by}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <a href={doc.drive_link} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="border-sky-500/40 text-sky-400 hover:bg-sky-500/10">
                        <ExternalLink className="w-3.5 h-3.5 mr-1" /> Open
                      </Button>
                    </a>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8">
                          <MoreVertical className="w-4 h-4 text-zinc-400" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openDocModal(doc)}>
                          <Pencil className="w-3.5 h-3.5 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => moveDocOrder.mutate({ id: doc.id, dir: -1 })}>
                          <ArrowUpDown className="w-3.5 h-3.5 mr-2" /> Move Up
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => moveDocOrder.mutate({ id: doc.id, dir: 1 })}>
                          <ArrowUpDown className="w-3.5 h-3.5 mr-2" /> Move Down
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-400 focus:text-red-400"
                          onClick={() => { if (confirm(`Delete "${doc.name}"?`)) deleteDoc.mutate(doc.id); }}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Category Modal ── */}
      <Dialog open={catModal} onOpenChange={setCatModal}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white">
          <DialogHeader>
            <DialogTitle>{editingCat ? "Edit Category" : "New Category"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-zinc-400">Name</label>
              <Input value={catName} onChange={e => setCatName(e.target.value)} className="bg-zinc-800 border-zinc-700 text-white" />
            </div>
            <div>
              <label className="text-sm text-zinc-400">Icon</label>
              <Select value={catIcon} onValueChange={setCatIcon}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ICON_OPTIONS.map(name => {
                    const I = ICON_MAP[name];
                    return (
                      <SelectItem key={name} value={name}>
                        <span className="flex items-center gap-2"><I className="w-4 h-4" /> {name}</span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatModal(false)} className="border-zinc-600 text-zinc-300">Cancel</Button>
            <Button onClick={() => upsertCat.mutate()} disabled={!catName.trim()} className="bg-sky-600 hover:bg-sky-700 text-white">
              {editingCat ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Document Modal ── */}
      <Dialog open={docModal} onOpenChange={setDocModal}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingDoc ? "Edit Document" : "Add Document"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-zinc-400">Document Name *</label>
              <Input value={docName} onChange={e => setDocName(e.target.value)} className="bg-zinc-800 border-zinc-700 text-white" />
            </div>
            <div>
              <label className="text-sm text-zinc-400">Description</label>
              <Textarea value={docDesc} onChange={e => setDocDesc(e.target.value)} className="bg-zinc-800 border-zinc-700 text-white" rows={2} />
            </div>
            <div>
              <label className="text-sm text-zinc-400">Document Link *</label>
              <Input value={docLink} onChange={e => setDocLink(e.target.value)} placeholder="Paste any document link here..." className="bg-zinc-800 border-zinc-700 text-white" />
            </div>
            {editingDoc && (
              <div>
                <label className="text-sm text-zinc-400">Move to Category</label>
                <Select value={docMoveCatId} onValueChange={setDocMoveCatId}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDocModal(false)} className="border-zinc-600 text-zinc-300">Cancel</Button>
            <Button
              onClick={() => upsertDoc.mutate()}
              disabled={!docName.trim() || !docLink.trim()}
              className="bg-sky-600 hover:bg-sky-700 text-white"
            >
              {editingDoc ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDocumentVault;
