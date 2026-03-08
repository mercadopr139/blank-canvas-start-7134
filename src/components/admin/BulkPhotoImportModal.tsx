import { useState, useMemo, useRef } from "react";
import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, CheckCircle2, XCircle, Loader2, ImageIcon, AlertTriangle, Search } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

const IMAGE_EXTS = ["jpg", "jpeg", "png", "webp"];

type MatchStatus = "auto" | "manual" | "unmatched" | "skipped";

interface PhotoMatch {
  fileName: string;
  blob: Blob;
  previewUrl: string;
  registrationId: string | null;
  matchedName: string | null;
  confidence: "High" | "Medium" | "Low" | "Manual" | "None";
  status: MatchStatus;
  approved: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingRegistrations: Array<{
    id: string;
    child_first_name: string;
    child_last_name: string;
    child_headshot_url: string | null;
  }>;
  onImportComplete: () => void;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z]/g, "");
}

function matchFilenameToYouth(
  fileName: string,
  registrations: Props["existingRegistrations"]
): { registrationId: string; matchedName: string; confidence: "High" | "Medium" | "Low" } | null {
  // Strip extension and path
  const baseName = fileName.replace(/\.[^.]+$/, "").split("/").pop() || "";
  const parts = baseName
    .replace(/[_\-\.]/g, " ")
    .split(/\s+/)
    .map((p) => normalize(p))
    .filter(Boolean);

  if (parts.length === 0) return null;

  let bestMatch: { reg: (typeof registrations)[0]; confidence: "High" | "Medium" | "Low" } | null = null;

  for (const reg of registrations) {
    const first = normalize(reg.child_first_name);
    const last = normalize(reg.child_last_name);

    // Exact first+last in any order
    if (parts.includes(first) && parts.includes(last)) {
      bestMatch = { reg, confidence: "High" };
      break;
    }

    // Concatenated match: "johnsmith" or "smithjohn"
    const joined = parts.join("");
    if (joined === first + last || joined === last + first) {
      bestMatch = { reg, confidence: "High" };
      break;
    }

    // Partial: last name only (lower confidence)
    if (parts.includes(last) && last.length >= 3) {
      if (!bestMatch || bestMatch.confidence === "Low") {
        bestMatch = { reg, confidence: "Medium" };
      }
    }

    // Partial: first name only (even lower)
    if (parts.includes(first) && first.length >= 3) {
      if (!bestMatch) {
        bestMatch = { reg, confidence: "Low" };
      }
    }
  }

  if (!bestMatch) return null;
  return {
    registrationId: bestMatch.reg.id,
    matchedName: `${bestMatch.reg.child_first_name} ${bestMatch.reg.child_last_name}`,
    confidence: bestMatch.confidence,
  };
}

type Step = "upload" | "review" | "processing" | "complete";

export default function BulkPhotoImportModal({ open, onOpenChange, existingRegistrations, onImportComplete }: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [matches, setMatches] = useState<PhotoMatch[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [processProgress, setProcessProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState({ matched: 0, manual: 0, skipped: 0, total: 0 });
  const [manualSearch, setManualSearch] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep("upload");
    setMatches([]);
    setExtracting(false);
    setProcessProgress({ current: 0, total: 0 });
    setResults({ matched: 0, manual: 0, skipped: 0, total: 0 });
    setManualSearch({});
    // Clean up preview URLs
    matches.forEach((m) => URL.revokeObjectURL(m.previewUrl));
  };

  const handleClose = (val: boolean) => {
    if (!val) reset();
    onOpenChange(val);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".zip")) {
      toast.error("Please upload a ZIP file");
      return;
    }

    setExtracting(true);
    try {
      const zip = await JSZip.loadAsync(file);
      const photoMatches: PhotoMatch[] = [];

      for (const [path, entry] of Object.entries(zip.files)) {
        if (entry.dir) continue;
        const ext = path.split(".").pop()?.toLowerCase() || "";
        if (!IMAGE_EXTS.includes(ext)) continue;

        const blob = await entry.async("blob");
        const previewUrl = URL.createObjectURL(blob);
        const fileName = path.split("/").pop() || path;

        const match = matchFilenameToYouth(fileName, existingRegistrations);

        photoMatches.push({
          fileName,
          blob,
          previewUrl,
          registrationId: match?.registrationId || null,
          matchedName: match?.matchedName || null,
          confidence: match?.confidence || "None",
          status: match ? "auto" : "unmatched",
          approved: match?.confidence === "High",
        });
      }

      if (photoMatches.length === 0) {
        toast.error("No image files found in ZIP");
        setExtracting(false);
        return;
      }

      setMatches(photoMatches);
      setStep("review");
    } catch (err) {
      toast.error("Failed to read ZIP file");
      console.error(err);
    }
    setExtracting(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const toggleApprove = (idx: number) => {
    setMatches((prev) => prev.map((m, i) => (i === idx ? { ...m, approved: !m.approved } : m)));
  };

  const assignManual = (idx: number, regId: string) => {
    const reg = existingRegistrations.find((r) => r.id === regId);
    if (!reg) return;
    setMatches((prev) =>
      prev.map((m, i) =>
        i === idx
          ? {
              ...m,
              registrationId: regId,
              matchedName: `${reg.child_first_name} ${reg.child_last_name}`,
              confidence: "Manual",
              status: "manual" as MatchStatus,
              approved: true,
            }
          : m
      )
    );
  };

  const handleProcess = async () => {
    const toProcess = matches.filter((m) => m.approved && m.registrationId);
    if (toProcess.length === 0) {
      toast.error("No approved matches to process");
      return;
    }

    setStep("processing");
    setProcessProgress({ current: 0, total: toProcess.length });

    let matched = 0;
    let manual = 0;
    let skipped = 0;

    for (let i = 0; i < toProcess.length; i++) {
      const m = toProcess[i];
      setProcessProgress({ current: i + 1, total: toProcess.length });

      try {
        const ext = m.fileName.split(".").pop()?.toLowerCase() || "jpg";
        const storagePath = `bulk_headshot_${m.registrationId}_${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("registration-signatures")
          .upload(storagePath, m.blob, {
            contentType: m.blob.type || `image/${ext === "jpg" ? "jpeg" : ext}`,
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const { error: updateError } = await supabase
          .from("youth_registrations")
          .update({ child_headshot_url: storagePath })
          .eq("id", m.registrationId!);

        if (updateError) throw updateError;

        if (m.status === "manual") manual++;
        else matched++;
      } catch (err) {
        console.error(`Failed to process ${m.fileName}:`, err);
        skipped++;
      }
    }

    const totalSkipped = skipped + matches.filter((m) => !m.approved || !m.registrationId).length;
    setResults({ matched, manual, skipped: totalSkipped, total: matched + manual });
    setStep("complete");
    onImportComplete();
  };

  const autoMatched = matches.filter((m) => m.status === "auto");
  const unmatched = matches.filter((m) => m.status === "unmatched");
  const manuallyMatched = matches.filter((m) => m.status === "manual");

  const filteredRegs = (idx: number) => {
    const q = normalize(manualSearch[idx] || "");
    if (!q) return existingRegistrations.slice(0, 20);
    return existingRegistrations.filter(
      (r) =>
        normalize(r.child_first_name).includes(q) ||
        normalize(r.child_last_name).includes(q) ||
        normalize(`${r.child_first_name} ${r.child_last_name}`).includes(q)
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] bg-black border-white/10 text-white overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-[#bf0f3e]" />
            Bulk Import Youth Photos
          </DialogTitle>
        </DialogHeader>

        {/* STEP: UPLOAD */}
        {step === "upload" && (
          <div className="flex flex-col items-center justify-center py-12 gap-6">
            <div className="w-24 h-24 rounded-full bg-white/5 border-2 border-dashed border-white/20 flex items-center justify-center">
              <Upload className="w-10 h-10 text-white/40" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-lg font-medium">Upload a ZIP file of youth photos</p>
              <p className="text-sm text-white/50">
                Accepted formats: JPG, JPEG, PNG, WEBP
              </p>
              <p className="text-xs text-white/40">
                Name files like: <span className="font-mono text-white/60">john_smith.jpg</span> or{" "}
                <span className="font-mono text-white/60">smith-john.png</span> for automatic matching
              </p>
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                className="hidden"
                onChange={handleFileSelect}
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={extracting}
                className="bg-[#bf0f3e] hover:bg-[#a00d35] text-white gap-2"
              >
                {extracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {extracting ? "Extracting..." : "Select ZIP File"}
              </Button>
            </div>
          </div>
        )}

        {/* STEP: REVIEW */}
        {step === "review" && (
          <div className="flex flex-col gap-4 flex-1 overflow-hidden">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge className="bg-green-600/20 text-green-400 border-green-600/30">
                {autoMatched.length + manuallyMatched.length} Matched
              </Badge>
              <Badge className="bg-yellow-600/20 text-yellow-400 border-yellow-600/30">
                {unmatched.length} Unmatched
              </Badge>
              <Badge className="bg-white/10 text-white/60 border-white/20">
                {matches.length} Total Photos
              </Badge>
            </div>

            <ScrollArea className="flex-1 max-h-[55vh]">
              {/* Auto-matched section */}
              {autoMatched.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-white/70 mb-2 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-400" /> Auto-Matched ({autoMatched.length})
                  </h3>
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10 hover:bg-transparent">
                        <TableHead className="text-white/70 w-16">Photo</TableHead>
                        <TableHead className="text-white/70">File Name</TableHead>
                        <TableHead className="text-white/70">Suggested Match</TableHead>
                        <TableHead className="text-white/70">Confidence</TableHead>
                        <TableHead className="text-white/70 text-right">Approve</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {autoMatched.map((m) => {
                        const idx = matches.indexOf(m);
                        return (
                          <TableRow key={idx} className="border-white/10 hover:bg-white/5">
                            <TableCell>
                              <img src={m.previewUrl} alt="" className="w-10 h-10 rounded-full object-cover border border-white/20" />
                            </TableCell>
                            <TableCell className="text-white/80 text-xs font-mono truncate max-w-[180px]">{m.fileName}</TableCell>
                            <TableCell className="text-white font-medium">{m.matchedName}</TableCell>
                            <TableCell>
                              <Badge
                                className={
                                  m.confidence === "High"
                                    ? "bg-green-600/20 text-green-400 border-green-600/30"
                                    : m.confidence === "Medium"
                                    ? "bg-yellow-600/20 text-yellow-400 border-yellow-600/30"
                                    : "bg-orange-600/20 text-orange-400 border-orange-600/30"
                                }
                              >
                                {m.confidence}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => toggleApprove(idx)}
                                className={m.approved ? "text-green-400 hover:text-green-300" : "text-white/40 hover:text-white/60"}
                              >
                                {m.approved ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Manually matched section */}
              {manuallyMatched.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-white/70 mb-2 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-400" /> Manually Matched ({manuallyMatched.length})
                  </h3>
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10 hover:bg-transparent">
                        <TableHead className="text-white/70 w-16">Photo</TableHead>
                        <TableHead className="text-white/70">File Name</TableHead>
                        <TableHead className="text-white/70">Assigned To</TableHead>
                        <TableHead className="text-white/70 text-right">Approve</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {manuallyMatched.map((m) => {
                        const idx = matches.indexOf(m);
                        return (
                          <TableRow key={idx} className="border-white/10 hover:bg-white/5">
                            <TableCell>
                              <img src={m.previewUrl} alt="" className="w-10 h-10 rounded-full object-cover border border-white/20" />
                            </TableCell>
                            <TableCell className="text-white/80 text-xs font-mono truncate max-w-[180px]">{m.fileName}</TableCell>
                            <TableCell className="text-white font-medium">{m.matchedName}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => toggleApprove(idx)}
                                className={m.approved ? "text-green-400 hover:text-green-300" : "text-white/40 hover:text-white/60"}
                              >
                                {m.approved ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Unmatched section */}
              {unmatched.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-white/70 mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-400" /> Unmatched Photos ({unmatched.length})
                  </h3>
                  <div className="space-y-3">
                    {unmatched.map((m) => {
                      const idx = matches.indexOf(m);
                      const regs = filteredRegs(idx);
                      return (
                        <div key={idx} className="flex items-center gap-3 bg-white/5 rounded-lg p-3 border border-white/10">
                          <img src={m.previewUrl} alt="" className="w-14 h-14 rounded-lg object-cover border border-white/20 shrink-0" />
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <p className="text-xs font-mono text-white/60 truncate">{m.fileName}</p>
                            <div className="flex items-center gap-2">
                              <div className="relative flex-1 max-w-[280px]">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30" />
                                <Input
                                  placeholder="Search youth..."
                                  value={manualSearch[idx] || ""}
                                  onChange={(e) => setManualSearch((prev) => ({ ...prev, [idx]: e.target.value }))}
                                  className="h-8 pl-7 text-xs bg-white/5 border-white/10 text-white"
                                />
                              </div>
                              <Select onValueChange={(val) => assignManual(idx, val)}>
                                <SelectTrigger className="h-8 w-[200px] bg-white/5 border-white/10 text-white text-xs">
                                  <SelectValue placeholder="Assign to youth…" />
                                </SelectTrigger>
                                <SelectContent className="bg-black border-white/10 max-h-48">
                                  {regs.map((r) => (
                                    <SelectItem key={r.id} value={r.id} className="text-white text-xs">
                                      {r.child_first_name} {r.child_last_name}
                                    </SelectItem>
                                  ))}
                                  {regs.length === 0 && (
                                    <div className="px-3 py-2 text-xs text-white/40">No matches</div>
                                  )}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </ScrollArea>

            <div className="flex items-center justify-between pt-3 border-t border-white/10">
              <p className="text-xs text-white/50">
                {matches.filter((m) => m.approved).length} of {matches.length} photos approved for import
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => handleClose(false)} className="border-white/20 text-white hover:bg-white/10">
                  Cancel
                </Button>
                <Button
                  onClick={handleProcess}
                  disabled={matches.filter((m) => m.approved && m.registrationId).length === 0}
                  className="bg-[#bf0f3e] hover:bg-[#a00d35] text-white gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Import {matches.filter((m) => m.approved && m.registrationId).length} Photos
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* STEP: PROCESSING */}
        {step === "processing" && (
          <div className="flex flex-col items-center justify-center py-16 gap-6">
            <Loader2 className="w-12 h-12 text-[#bf0f3e] animate-spin" />
            <div className="text-center space-y-2">
              <p className="text-lg font-medium">Importing Photos…</p>
              <p className="text-sm text-white/50">
                {processProgress.current} of {processProgress.total} processed
              </p>
            </div>
            <div className="w-64 h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#bf0f3e] rounded-full transition-all"
                style={{ width: `${processProgress.total ? (processProgress.current / processProgress.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* STEP: COMPLETE */}
        {step === "complete" && (
          <div className="flex flex-col items-center justify-center py-12 gap-6">
            <div className="w-20 h-20 rounded-full bg-green-600/20 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-green-400" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-xl font-bold">Import Complete</p>
              <p className="text-sm text-white/50">Here's a summary of the import results.</p>
            </div>
            <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
              <div className="bg-white/5 rounded-lg p-4 text-center border border-white/10">
                <p className="text-2xl font-bold text-green-400">{results.matched}</p>
                <p className="text-xs text-white/50">Auto Matched</p>
              </div>
              <div className="bg-white/5 rounded-lg p-4 text-center border border-white/10">
                <p className="text-2xl font-bold text-blue-400">{results.manual}</p>
                <p className="text-xs text-white/50">Manually Matched</p>
              </div>
              <div className="bg-white/5 rounded-lg p-4 text-center border border-white/10">
                <p className="text-2xl font-bold text-yellow-400">{results.skipped}</p>
                <p className="text-xs text-white/50">Skipped</p>
              </div>
              <div className="bg-white/5 rounded-lg p-4 text-center border border-white/10">
                <p className="text-2xl font-bold text-white">{results.total}</p>
                <p className="text-xs text-white/50">Profiles Updated</p>
              </div>
            </div>
            <Button onClick={() => handleClose(false)} className="bg-white/10 hover:bg-white/15 text-white border border-white/20">
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
