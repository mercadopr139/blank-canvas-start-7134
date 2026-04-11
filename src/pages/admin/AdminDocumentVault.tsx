import { useState, useMemo } from "react";
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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Search, Plus, ExternalLink, ArrowLeft, MoreVertical, Pencil, Trash2,
  ArrowUpDown, FolderOpen, FolderPlus, ChevronRight, MoveRight,
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
interface VaultFolder {
  id: string; category_id: string; parent_folder_id: string | null;
  name: string; created_by: string | null; sort_order: number;
  created_at: string; updated_at: string;
}
interface VaultDocument {
  id: string; category_id: string; folder_id: string | null;
  name: string; description: string | null;
  drive_link: string; added_by: string | null;
  sort_order: number; created_at: string; updated_at: string;
}

/* ── Breadcrumb item ── */
interface BreadcrumbItem {
  id: string | null; // null = category root
  label: string;
  type: "vault" | "category" | "folder";
}

/* ── Delete confirm state ── */
interface DeleteConfirm {
  type: "category" | "folder" | "document";
  id: string;
  name: string;
  hasChildren?: boolean;
}

/* ── Move modal state ── */
interface MoveTarget {
  type: "folder" | "document";
  id: string;
  name: string;
  currentCategoryId: string;
  currentFolderId: string | null;
}

/* ──────────────────────────────────────────── */
const AdminDocumentVault = () => {
  const qc = useQueryClient();

  // Navigation state
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<string[]>([]); // stack of folder IDs
  const currentFolderId = folderPath.length > 0 ? folderPath[folderPath.length - 1] : null;

  const [globalSearch, setGlobalSearch] = useState("");

  // Category CRUD
  const [catModal, setCatModal] = useState(false);
  const [editingCat, setEditingCat] = useState<VaultCategory | null>(null);
  const [catName, setCatName] = useState("");
  const [catIcon, setCatIcon] = useState("Folder");

  // Folder CRUD
  const [folderModal, setFolderModal] = useState(false);
  const [editingFolder, setEditingFolder] = useState<VaultFolder | null>(null);
  const [folderName, setFolderName] = useState("");

  // Document CRUD
  const [docModal, setDocModal] = useState(false);
  const [editingDoc, setEditingDoc] = useState<VaultDocument | null>(null);
  const [docName, setDocName] = useState("");
  const [docDesc, setDocDesc] = useState("");
  const [docLink, setDocLink] = useState("");

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm | null>(null);

  // Move modal
  const [moveTarget, setMoveTarget] = useState<MoveTarget | null>(null);
  const [moveDestCatId, setMoveDestCatId] = useState("");
  const [moveDestFolderId, setMoveDestFolderId] = useState("__root__");

  /* ── Queries ── */
  const { data: categories = [] } = useQuery<VaultCategory[]>({
    queryKey: ["vault-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vault_categories").select("*").order("sort_order");
      if (error) throw error;
      return data as any;
    },
  });

  const { data: allFolders = [] } = useQuery<VaultFolder[]>({
    queryKey: ["vault-folders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vault_folders").select("*").order("sort_order");
      if (error) throw error;
      return data as any;
    },
  });

  const { data: allDocs = [] } = useQuery<VaultDocument[]>({
    queryKey: ["vault-documents"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vault_documents").select("*").order("sort_order");
      if (error) throw error;
      return data as any;
    },
  });

  /* ── Derived data ── */
  const currentFolders = useMemo(() =>
    allFolders
      .filter(f => f.category_id === selectedCatId && f.parent_folder_id === currentFolderId)
      .sort((a, b) => a.sort_order - b.sort_order),
    [allFolders, selectedCatId, currentFolderId]
  );

  const currentDocs = useMemo(() =>
    allDocs
      .filter(d => d.category_id === selectedCatId && d.folder_id === currentFolderId)
      .sort((a, b) => a.sort_order - b.sort_order),
    [allDocs, selectedCatId, currentFolderId]
  );

  // Count all docs recursively under a folder
  const countDocsInFolder = (folderId: string): number => {
    const directDocs = allDocs.filter(d => d.folder_id === folderId).length;
    const childFolders = allFolders.filter(f => f.parent_folder_id === folderId);
    return directDocs + childFolders.reduce((sum, cf) => sum + countDocsInFolder(cf.id), 0);
  };

  // Count all docs in a category (root + all folders)
  const countDocsInCategory = (catId: string): number => {
    return allDocs.filter(d => d.category_id === catId).length;
  };

  // Count folders in category root
  const countFoldersInCategory = (catId: string): number => {
    return allFolders.filter(f => f.category_id === catId && !f.parent_folder_id).length;
  };

  /* ── Breadcrumbs ── */
  const breadcrumbs = useMemo((): BreadcrumbItem[] => {
    const items: BreadcrumbItem[] = [{ id: null, label: "Document Vault", type: "vault" }];
    if (!selectedCatId) return items;
    const cat = categories.find(c => c.id === selectedCatId);
    if (cat) items.push({ id: cat.id, label: cat.name, type: "category" });
    for (const fId of folderPath) {
      const folder = allFolders.find(f => f.id === fId);
      if (folder) items.push({ id: folder.id, label: folder.name, type: "folder" });
    }
    return items;
  }, [selectedCatId, folderPath, categories, allFolders]);

  /* ── Navigation helpers ── */
  const navigateToCategory = (catId: string) => {
    setSelectedCatId(catId);
    setFolderPath([]);
    setGlobalSearch("");
  };

  const navigateToFolder = (folderId: string) => {
    setFolderPath(prev => [...prev, folderId]);
  };

  const navigateBreadcrumb = (item: BreadcrumbItem) => {
    if (item.type === "vault") {
      setSelectedCatId(null);
      setFolderPath([]);
    } else if (item.type === "category") {
      setFolderPath([]);
    } else if (item.type === "folder" && item.id) {
      const idx = folderPath.indexOf(item.id);
      if (idx >= 0) setFolderPath(folderPath.slice(0, idx + 1));
    }
  };

  const navigateBack = () => {
    if (folderPath.length > 0) {
      setFolderPath(prev => prev.slice(0, -1));
    } else if (selectedCatId) {
      setSelectedCatId(null);
    }
  };

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
      qc.invalidateQueries({ queryKey: ["vault-folders"] });
      qc.invalidateQueries({ queryKey: ["vault-documents"] });
      toast.success("Category deleted");
      setSelectedCatId(null);
      setFolderPath([]);
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

  /* ── Folder mutations ── */
  const upsertFolder = useMutation({
    mutationFn: async () => {
      if (editingFolder) {
        const { error } = await supabase.from("vault_folders")
          .update({ name: folderName }).eq("id", editingFolder.id);
        if (error) throw error;
      } else {
        const siblings = allFolders.filter(f =>
          f.category_id === selectedCatId && f.parent_folder_id === currentFolderId
        );
        const maxOrder = siblings.length ? Math.max(...siblings.map(f => f.sort_order)) + 1 : 0;
        const { error } = await supabase.from("vault_folders").insert({
          name: folderName,
          category_id: selectedCatId!,
          parent_folder_id: currentFolderId,
          sort_order: maxOrder,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vault-folders"] });
      toast.success(editingFolder ? "Folder renamed" : "Folder created");
      setFolderModal(false);
    },
  });

  const deleteFolder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vault_folders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vault-folders"] });
      qc.invalidateQueries({ queryKey: ["vault-documents"] });
      toast.success("Folder deleted");
    },
  });

  /* ── Document mutations ── */
  const upsertDoc = useMutation({
    mutationFn: async () => {
      const payload: any = {
        name: docName,
        description: docDesc || null,
        drive_link: docLink,
        category_id: selectedCatId!,
        folder_id: currentFolderId,
      };
      if (editingDoc) {
        // Keep existing location if editing
        payload.category_id = editingDoc.category_id;
        payload.folder_id = editingDoc.folder_id;
        const { error } = await supabase.from("vault_documents")
          .update(payload).eq("id", editingDoc.id);
        if (error) throw error;
      } else {
        const siblings = allDocs.filter(d =>
          d.category_id === selectedCatId && d.folder_id === currentFolderId
        );
        payload.sort_order = siblings.length ? Math.max(...siblings.map(d => d.sort_order)) + 1 : 0;
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

  /* ── Move mutation ── */
  const executeMove = useMutation({
    mutationFn: async () => {
      if (!moveTarget) return;
      const destFolder = moveDestFolderId === "__root__" ? null : moveDestFolderId;
      if (moveTarget.type === "document") {
        const { error } = await supabase.from("vault_documents")
          .update({ category_id: moveDestCatId, folder_id: destFolder })
          .eq("id", moveTarget.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("vault_folders")
          .update({ category_id: moveDestCatId, parent_folder_id: destFolder })
          .eq("id", moveTarget.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vault-folders"] });
      qc.invalidateQueries({ queryKey: ["vault-documents"] });
      toast.success(`${moveTarget?.type === "document" ? "Document" : "Folder"} moved`);
      setMoveTarget(null);
    },
  });

  /* ── Modal openers ── */
  const openCatModal = (cat?: VaultCategory) => {
    setEditingCat(cat || null);
    setCatName(cat?.name || "");
    setCatIcon(cat?.icon || "Folder");
    setCatModal(true);
  };

  const openFolderModal = (folder?: VaultFolder) => {
    setEditingFolder(folder || null);
    setFolderName(folder?.name || "");
    setFolderModal(true);
  };

  const openDocModal = (doc?: VaultDocument) => {
    setEditingDoc(doc || null);
    setDocName(doc?.name || "");
    setDocDesc(doc?.description || "");
    setDocLink(doc?.drive_link || "");
    setDocModal(true);
  };

  const openMoveModal = (target: MoveTarget) => {
    setMoveTarget(target);
    setMoveDestCatId(target.currentCategoryId);
    setMoveDestFolderId(target.currentFolderId || "__root__");
  };

  // Folders available as move destinations for a given category
  const movableFolders = useMemo(() => {
    if (!moveTarget) return [];
    // Exclude the folder being moved (and its children) to prevent circular refs
    const excluded = new Set<string>();
    if (moveTarget.type === "folder") {
      const collectChildren = (id: string) => {
        excluded.add(id);
        allFolders.filter(f => f.parent_folder_id === id).forEach(f => collectChildren(f.id));
      };
      collectChildren(moveTarget.id);
    }
    return allFolders
      .filter(f => f.category_id === moveDestCatId && !excluded.has(f.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [moveTarget, moveDestCatId, allFolders]);

  /* ── Global search ── */
  const searchResults = useMemo(() => {
    if (globalSearch.trim().length < 2) return null;
    const q = globalSearch.toLowerCase();
    const docs = allDocs.filter(d =>
      d.name.toLowerCase().includes(q) ||
      (d.description || "").toLowerCase().includes(q)
    );
    const folders = allFolders.filter(f => f.name.toLowerCase().includes(q));
    return { docs, folders };
  }, [globalSearch, allDocs, allFolders]);

  const getCatName = (catId: string) => categories.find(c => c.id === catId)?.name || "—";

  const getFolderBreadcrumb = (folderId: string | null): string => {
    if (!folderId) return "";
    const parts: string[] = [];
    let current = folderId;
    while (current) {
      const f = allFolders.find(fo => fo.id === current);
      if (!f) break;
      parts.unshift(f.name);
      current = f.parent_folder_id as string;
    }
    return parts.join(" › ");
  };

  /* ── Has children check for delete warnings ── */
  const folderHasChildren = (folderId: string): boolean => {
    return allDocs.some(d => d.folder_id === folderId) ||
           allFolders.some(f => f.parent_folder_id === folderId);
  };

  const categoryHasChildren = (catId: string): boolean => {
    return allDocs.some(d => d.category_id === catId) ||
           allFolders.some(f => f.category_id === catId);
  };

  /* ──────── RENDER ──────── */
  const isInCategory = !!selectedCatId;
  const showSearch = !!searchResults;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
      {/* ── Breadcrumbs ── */}
      {isInCategory && (
        <div className="flex items-center gap-1 text-sm flex-wrap">
          {breadcrumbs.map((b, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />}
              <button
                onClick={() => navigateBreadcrumb(b)}
                className={`hover:underline ${
                  i === breadcrumbs.length - 1
                    ? "text-sky-400 font-medium"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {b.label}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {isInCategory && (
            <Button size="sm" variant="ghost" onClick={navigateBack} className="text-zinc-400 hover:text-white">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
          )}
          <div>
            <h2 className="text-xl font-bold text-white">
              {!isInCategory ? "Document Vault"
                : currentFolderId
                  ? allFolders.find(f => f.id === currentFolderId)?.name || "Folder"
                  : categories.find(c => c.id === selectedCatId)?.name || "Category"}
            </h2>
            <p className="text-sm text-zinc-400">
              {!isInCategory ? "Centralized document hub"
                : `${currentFolders.length} folder(s) · ${currentDocs.length} document(s)`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-zinc-500" />
            <Input
              placeholder="Search everything…"
              value={globalSearch}
              onChange={e => setGlobalSearch(e.target.value)}
              className="pl-9 bg-zinc-900 border-zinc-700 text-white w-full sm:w-64"
            />
          </div>
          {isInCategory ? (
            <>
              <Button size="sm" onClick={() => openFolderModal()} className="bg-zinc-700 hover:bg-zinc-600 text-white">
                <FolderPlus className="w-4 h-4 mr-1" /> Add Folder
              </Button>
              <Button size="sm" onClick={() => openDocModal()} className="bg-sky-600 hover:bg-sky-700 text-white">
                <Plus className="w-4 h-4 mr-1" /> Add Document
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => openCatModal()} className="bg-sky-600 hover:bg-sky-700 text-white">
              <Plus className="w-4 h-4 mr-1" /> Add Category
            </Button>
          )}
        </div>
      </div>

      {/* ── Global search results ── */}
      {showSearch && searchResults && (
        <div className="space-y-2">
          <p className="text-sm text-zinc-400">
            {searchResults.docs.length + searchResults.folders.length} result(s)
          </p>
          {searchResults.folders.map(folder => (
            <Card key={`f-${folder.id}`} className="bg-zinc-900/60 border-zinc-700/50 cursor-pointer hover:border-sky-500/40 transition-colors"
              onClick={() => {
                setGlobalSearch("");
                // Navigate to this folder: set cat, then build path
                setSelectedCatId(folder.category_id);
                const path: string[] = [];
                let cur: string | null = folder.id;
                while (cur) {
                  path.unshift(cur);
                  const f = allFolders.find(fo => fo.id === cur);
                  cur = f?.parent_folder_id || null;
                }
                setFolderPath(path);
              }}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <FolderOpen className="w-5 h-5 text-sky-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-white font-medium truncate">{folder.name}</p>
                  <p className="text-xs text-zinc-500">
                    {getCatName(folder.category_id)}
                    {folder.parent_folder_id && ` › ${getFolderBreadcrumb(folder.id)}`}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
          {searchResults.docs.map(doc => (
            <Card key={`d-${doc.id}`} className="bg-zinc-900/60 border-zinc-700/50">
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="w-5 h-5 text-sky-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-white font-medium truncate">{doc.name}</p>
                    <p className="text-xs text-zinc-500">
                      {getCatName(doc.category_id)}
                      {doc.folder_id && ` › ${getFolderBreadcrumb(doc.folder_id)}`}
                    </p>
                  </div>
                </div>
                <a href={doc.drive_link} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline" className="border-sky-500/40 text-sky-400 hover:bg-sky-500/10">
                    <ExternalLink className="w-3.5 h-3.5 mr-1" /> Open
                  </Button>
                </a>
              </CardContent>
            </Card>
          ))}
          {searchResults.docs.length === 0 && searchResults.folders.length === 0 && (
            <p className="text-zinc-500 text-sm text-center py-6">No results found.</p>
          )}
        </div>
      )}

      {/* ── Category grid (vault root) ── */}
      {!isInCategory && !showSearch && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.length === 0 && (
            <div className="col-span-full text-center py-12">
              <FolderOpen className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-400 mb-2">No categories yet</p>
              <Button size="sm" onClick={() => openCatModal()} className="bg-sky-600 hover:bg-sky-700 text-white">
                <Plus className="w-4 h-4 mr-1" /> Add Category
              </Button>
            </div>
          )}
          {categories.map(cat => {
            const Icon = getIcon(cat.icon);
            const docCount = countDocsInCategory(cat.id);
            const folderCount = countFoldersInCategory(cat.id);
            return (
              <Card
                key={cat.id}
                className="bg-zinc-900/60 border-zinc-700/50 hover:border-sky-500/40 transition-colors cursor-pointer group relative"
                onClick={() => navigateToCategory(cat.id)}
              >
                <CardContent className="p-5 flex items-start gap-4">
                  <div className="w-11 h-11 rounded-lg bg-sky-500/10 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-sky-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-semibold truncate">{cat.name}</p>
                    <p className="text-sm text-zinc-400">
                      {folderCount} folder{folderCount !== 1 ? "s" : ""} · {docCount} doc{docCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                      <Button size="icon" variant="ghost" className="opacity-0 group-hover:opacity-100 h-8 w-8">
                        <MoreVertical className="w-4 h-4 text-zinc-400" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
                      <DropdownMenuItem onClick={() => openCatModal(cat)}>
                        <Pencil className="w-3.5 h-3.5 mr-2" /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => moveCatOrder.mutate({ id: cat.id, dir: -1 })}>
                        <ArrowUpDown className="w-3.5 h-3.5 mr-2" /> Move Up
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => moveCatOrder.mutate({ id: cat.id, dir: 1 })}>
                        <ArrowUpDown className="w-3.5 h-3.5 mr-2" /> Move Down
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-400 focus:text-red-400"
                        onClick={() => setDeleteConfirm({
                          type: "category", id: cat.id, name: cat.name,
                          hasChildren: categoryHasChildren(cat.id),
                        })}
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

      {/* ── Folder + Document view inside a category ── */}
      {isInCategory && !showSearch && (
        <div className="space-y-3">
          {/* Folders */}
          {currentFolders.map(folder => {
            const docCount = countDocsInFolder(folder.id);
            return (
              <Card
                key={folder.id}
                className="bg-zinc-900/60 border-zinc-700/50 hover:border-sky-500/40 transition-colors cursor-pointer group"
                onClick={() => navigateToFolder(folder.id)}
              >
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center shrink-0">
                      <FolderOpen className="w-5 h-5 text-sky-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-medium truncate">{folder.name}</p>
                      <div className="flex gap-3 text-xs text-zinc-500">
                        <span>{docCount} doc{docCount !== 1 ? "s" : ""}</span>
                        <span>Created {format(new Date(folder.created_at), "MMM d, yyyy")}</span>
                      </div>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                      <Button size="icon" variant="ghost" className="opacity-0 group-hover:opacity-100 h-8 w-8">
                        <MoreVertical className="w-4 h-4 text-zinc-400" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
                      <DropdownMenuItem onClick={() => openFolderModal(folder)}>
                        <Pencil className="w-3.5 h-3.5 mr-2" /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openMoveModal({
                        type: "folder", id: folder.id, name: folder.name,
                        currentCategoryId: folder.category_id,
                        currentFolderId: folder.parent_folder_id,
                      })}>
                        <MoveRight className="w-3.5 h-3.5 mr-2" /> Move
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-400 focus:text-red-400"
                        onClick={() => setDeleteConfirm({
                          type: "folder", id: folder.id, name: folder.name,
                          hasChildren: folderHasChildren(folder.id),
                        })}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardContent>
              </Card>
            );
          })}

          {/* Documents */}
          {currentDocs.map(doc => (
            <Card key={doc.id} className="bg-zinc-900/60 border-zinc-700/50">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-white font-medium">{doc.name}</p>
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
                        <DropdownMenuItem onClick={() => openMoveModal({
                          type: "document", id: doc.id, name: doc.name,
                          currentCategoryId: doc.category_id,
                          currentFolderId: doc.folder_id,
                        })}>
                          <MoveRight className="w-3.5 h-3.5 mr-2" /> Move
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-400 focus:text-red-400"
                          onClick={() => setDeleteConfirm({ type: "document", id: doc.id, name: doc.name })}
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

          {/* Empty state */}
          {currentFolders.length === 0 && currentDocs.length === 0 && (
            <div className="text-center py-12">
              <FolderOpen className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-400 mb-1">
                {currentFolderId ? "No documents yet" : "No folders yet"}
              </p>
              <p className="text-zinc-500 text-sm mb-4">
                {currentFolderId
                  ? "Click \"Add Document\" or \"Add Folder\" to get started."
                  : "Click \"Add Folder\" to get started, or add documents directly."}
              </p>
              <div className="flex gap-2 justify-center">
                <Button size="sm" onClick={() => openFolderModal()} className="bg-zinc-700 hover:bg-zinc-600 text-white">
                  <FolderPlus className="w-4 h-4 mr-1" /> Add Folder
                </Button>
                <Button size="sm" onClick={() => openDocModal()} className="bg-sky-600 hover:bg-sky-700 text-white">
                  <Plus className="w-4 h-4 mr-1" /> Add Document
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════ MODALS ══════ */}

      {/* ── Delete Confirmation ── */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteConfirm?.name}"?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              {deleteConfirm?.hasChildren
                ? "This will permanently delete all folders and documents inside. This cannot be undone."
                : "Are you sure you want to delete this? This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-zinc-600 text-zinc-300 bg-transparent hover:bg-zinc-800">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                if (!deleteConfirm) return;
                if (deleteConfirm.type === "category") deleteCat.mutate(deleteConfirm.id);
                else if (deleteConfirm.type === "folder") deleteFolder.mutate(deleteConfirm.id);
                else deleteDoc.mutate(deleteConfirm.id);
                setDeleteConfirm(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      {/* ── Folder Modal ── */}
      <Dialog open={folderModal} onOpenChange={setFolderModal}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white">
          <DialogHeader>
            <DialogTitle>{editingFolder ? "Rename Folder" : "New Folder"}</DialogTitle>
          </DialogHeader>
          <div>
            <label className="text-sm text-zinc-400">Folder Name</label>
            <Input
              value={folderName}
              onChange={e => setFolderName(e.target.value)}
              placeholder="e.g. Bank Statements, 2026, January…"
              className="bg-zinc-800 border-zinc-700 text-white"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderModal(false)} className="border-zinc-600 text-zinc-300">Cancel</Button>
            <Button onClick={() => upsertFolder.mutate()} disabled={!folderName.trim()} className="bg-sky-600 hover:bg-sky-700 text-white">
              {editingFolder ? "Save" : "Create"}
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

      {/* ── Move Modal ── */}
      <Dialog open={!!moveTarget} onOpenChange={(open) => { if (!open) setMoveTarget(null); }}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white">
          <DialogHeader>
            <DialogTitle>Move "{moveTarget?.name}"</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-zinc-400">Destination Category</label>
              <Select value={moveDestCatId} onValueChange={(v) => { setMoveDestCatId(v); setMoveDestFolderId("__root__"); }}>
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
            <div>
              <label className="text-sm text-zinc-400">Destination Folder</label>
              <Select value={moveDestFolderId} onValueChange={setMoveDestFolderId}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__root__">— Category Root —</SelectItem>
                  {movableFolders.map(f => (
                    <SelectItem key={f.id} value={f.id}>
                      {getFolderBreadcrumb(f.id) || f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveTarget(null)} className="border-zinc-600 text-zinc-300">Cancel</Button>
            <Button onClick={() => executeMove.mutate()} className="bg-sky-600 hover:bg-sky-700 text-white">
              Move
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDocumentVault;
