import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, FileText, AlertTriangle, CheckCircle2, ImageOff, Loader2, Camera } from "lucide-react";
import { toast } from "sonner";

/* ───── CSV Parser (RFC-compliant) ───── */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let i = 0;
  while (i < text.length) {
    const row: string[] = [];
    while (i < text.length) {
      let value = "";
      if (text[i] === '"') {
        i++;
        while (i < text.length) {
          if (text[i] === '"' && text[i + 1] === '"') {value += '"';i += 2;} else
          if (text[i] === '"') {i++;break;} else
          {value += text[i];i++;}
        }
        if (text[i] === ",") i++;else
        if (text[i] === "\r" || text[i] === "\n") {if (text[i] === "\r" && text[i + 1] === "\n") i++;i++;row.push(value);break;}
      } else {
        const nextComma = text.indexOf(",", i);
        const nextNewline = text.indexOf("\n", i);
        const nextCR = text.indexOf("\r", i);
        let end = text.length;
        let isEnd = true;
        if (nextComma >= 0 && nextComma < end) {end = nextComma;isEnd = false;}
        if (nextNewline >= 0 && nextNewline < end) {end = nextNewline;isEnd = true;}
        if (nextCR >= 0 && nextCR < end) {end = nextCR;isEnd = true;}
        value = text.substring(i, end).trim();
        i = end;
        if (!isEnd && text[i] === ",") i++;else
        {if (text[i] === "\r") i++;if (text[i] === "\n") i++;row.push(value);break;}
      }
      row.push(value);
    }
    if (row.length > 0 && row.some((c) => c.trim())) rows.push(row);
  }
  return rows;
}

/* ───── Column Mapping ───── */
const FIELD_MAP: Record<string, {dbField: string;aliases: string[];}> = {
  child_first_name: { dbField: "child_first_name", aliases: ["first name of child", "child first name", "first name", "child's first name"] },
  child_last_name: { dbField: "child_last_name", aliases: ["last name of child", "child last name", "last name", "child's last name"] },
  child_sex: { dbField: "child_sex", aliases: ["child's sex", "sex", "gender"] },
  child_date_of_birth: { dbField: "child_date_of_birth", aliases: ["child's date of birth", "date of birth", "dob", "birthday"] },
  child_race_ethnicity: { dbField: "child_race_ethnicity", aliases: ["child's race/ethnicity", "race/ethnicity", "race", "ethnicity"] },
  parent_first_name: { dbField: "parent_first_name", aliases: ["first name of parent/guardian", "parent first name", "guardian first name"] },
  parent_last_name: { dbField: "parent_last_name", aliases: ["last name of parent/guardian", "parent last name", "guardian last name"] },
  parent_phone: { dbField: "parent_phone", aliases: ["parent/guardian cell phone", "parent phone", "guardian phone", "phone"] },
  child_phone: { dbField: "child_phone", aliases: ["child's cell phone", "child phone"] },
  parent_email: { dbField: "parent_email", aliases: ["parent/guardian email", "parent email", "guardian email", "email"] },
  child_primary_address: { dbField: "child_primary_address", aliases: ["child's primary address", "address", "primary address", "home address"] },
  child_school_district: { dbField: "child_school_district", aliases: ["child's school district", "school district", "district", "school"] },
  child_grade_level: { dbField: "child_grade_level", aliases: ["child's grade level", "grade level", "grade"] },
  child_boxing_program: { dbField: "child_boxing_program", aliases: ["child's boxing program", "boxing program", "program"] },
  adults_in_household: { dbField: "adults_in_household", aliases: ["adult(s) in child's primary household", "adults in household", "adults"] },
  siblings_in_household: { dbField: "siblings_in_household", aliases: ["how many siblings", "siblings in household", "siblings"] },
  household_income_range: { dbField: "household_income_range", aliases: ["household income", "income", "total household income"] },
  free_or_reduced_lunch: { dbField: "free_or_reduced_lunch", aliases: ["free or reduced lunch", "lunch status", "reduced lunch"] },
  allergies: { dbField: "allergies", aliases: ["allergies", "what allergies"] },
  asthma_inhaler_info: { dbField: "asthma_inhaler_info", aliases: ["inhaler", "asthma", "inhaler info"] },
  important_child_notes: { dbField: "important_child_notes", aliases: ["important information", "coach notes", "notes about child"] },
  photo_url: { dbField: "_photo_url", aliases: ["headshot", "photo", "picture", "image", "file", "photo url", "image url", "profile photo", "child photo", "upload a picture"] }
};

function autoMapColumns(headers: string[]): Record<number, string> {
  const mapping: Record<number, string> = {};
  headers.forEach((h, idx) => {
    const lower = h.toLowerCase().trim();
    for (const [key, { aliases }] of Object.entries(FIELD_MAP)) {
      if (aliases.some((a) => lower.includes(a) || a.includes(lower))) {
        mapping[idx] = key;
        break;
      }
    }
  });
  return mapping;
}

const isUrl = (s: string) => /^https?:\/\//i.test(s.trim());

type DuplicateAction = "skip" | "update" | "update_with_photo";
type ImportStep = "upload" | "mapping" | "preview" | "importing" | "results";

interface ImportRow {
  rowIndex: number;
  data: Record<string, string>;
  photoUrl: string | null;
  isDuplicate: boolean;
  duplicateId: string | null;
  warnings: string[];
  valid: boolean;
}

interface ImportResult {
  imported: number;
  updated: number;
  photosImported: number;
  skipped: number;
  photoErrors: number;
  needsReview: ImportRow[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingRegistrations: any[];
  onImportComplete: () => void;
}

const REQUIRED_FIELDS = ["child_first_name", "child_last_name", "child_date_of_birth"];

/* ─── Normalize values for DB enums ─── */
function normalizeSex(val: string): string {
  const v = val.trim().toLowerCase();
  if (v.startsWith("m")) return "Male";
  if (v.startsWith("f")) return "Female";
  return val;
}

function normalizePhone(val: string): string {
  const digits = val.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits[0] === "1") return `+${digits}`;
  return val;
}

/* ───── Component ───── */
const YouthImportModal = ({ open, onOpenChange, existingRegistrations, onImportComplete }: Props) => {
  const [step, setStep] = useState<ImportStep>("upload");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<number, string>>({});
  const [duplicateAction, setDuplicateAction] = useState<DuplicateAction>("skip");
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [results, setResults] = useState<ImportResult | null>(null);
  const [_isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  const reset = () => {
    setStep("upload");
    setCsvHeaders([]);
    setCsvRows([]);
    setColumnMapping({});
    setImportRows([]);
    setResults(null);
    setIsImporting(false);
    setImportProgress(0);
  };

  /* ── Step 1: File Upload ── */
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.length < 2) {
        toast.error("CSV must have at least a header row and one data row");
        return;
      }
      // Skip leading blank rows
      let headerIdx = 0;
      while (headerIdx < parsed.length && parsed[headerIdx].every((c) => !c.trim())) headerIdx++;
      const headers = parsed[headerIdx];
      const rows = parsed.slice(headerIdx + 1).filter((r) => r.some((c) => c.trim()));
      setCsvHeaders(headers);
      setCsvRows(rows);
      setColumnMapping(autoMapColumns(headers));
      setStep("mapping");
    };
    reader.readAsText(file);
  };

  /* ── Step 2 → 3: Build preview ── */
  const buildPreview = () => {
    const rows: ImportRow[] = csvRows.map((row, rowIdx) => {
      const data: Record<string, string> = {};
      let photoUrl: string | null = null;
      const warnings: string[] = [];

      Object.entries(columnMapping).forEach(([colIdx, fieldKey]) => {
        const val = row[Number(colIdx)]?.trim() || "";
        if (fieldKey === "photo_url") {
          if (val && isUrl(val)) photoUrl = val;else
          if (val) warnings.push("Photo field is not a valid URL");
        } else {
          data[fieldKey] = val;
        }
      });

      // Validate required
      let valid = true;
      REQUIRED_FIELDS.forEach((f) => {
        if (!data[f]) {warnings.push(`Missing ${f.replace(/_/g, " ")}`);valid = false;}
      });

      // Check duplicates
      let isDuplicate = false;
      let duplicateId: string | null = null;
      if (data.child_first_name && data.child_last_name && data.child_date_of_birth) {
        const match = existingRegistrations.find(
          (r) =>
          r.child_first_name.toLowerCase() === data.child_first_name.toLowerCase() &&
          r.child_last_name.toLowerCase() === data.child_last_name.toLowerCase() &&
          r.child_date_of_birth === data.child_date_of_birth
        );
        if (match) {isDuplicate = true;duplicateId = match.id;}
      }

      return { rowIndex: rowIdx, data, photoUrl, isDuplicate, duplicateId, warnings, valid };
    });

    setImportRows(rows);
    setStep("preview");
  };

  /* ── Preview stats ── */
  const previewStats = useMemo(() => {
    const total = importRows.length;
    const valid = importRows.filter((r) => r.valid).length;
    const withPhotos = importRows.filter((r) => r.photoUrl).length;
    const missingPhotos = importRows.filter((r) => !r.photoUrl).length;
    const duplicates = importRows.filter((r) => r.isDuplicate).length;
    const withWarnings = importRows.filter((r) => r.warnings.length > 0).length;
    return { total, valid, withPhotos, missingPhotos, duplicates, withWarnings };
  }, [importRows]);

  /* ── Step 4: Import ── */
  const executeImport = async () => {
    setStep("importing");
    setIsImporting(true);
    let imported = 0,updated = 0,photosImported = 0,skipped = 0,photoErrors = 0;
    const needsReview: ImportRow[] = [];

    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token;

    for (let i = 0; i < importRows.length; i++) {
      const row = importRows[i];
      setImportProgress(Math.round((i + 1) / importRows.length * 100));

      if (!row.valid) {skipped++;needsReview.push(row);continue;}

      // Handle duplicates
      if (row.isDuplicate) {
        if (duplicateAction === "skip") {skipped++;continue;}
        // Update existing
        const updateData = buildInsertData(row.data);
        delete (updateData as any).approved_for_attendance;
        const { error } = await supabase.from("youth_registrations").update(updateData as any).eq("id", row.duplicateId!);
        if (error) {skipped++;needsReview.push({ ...row, warnings: [...row.warnings, `Update failed: ${error.message}`] });continue;}

        // Photo for update
        if (duplicateAction === "update_with_photo" && row.photoUrl && accessToken) {
          const photoResult = await importPhoto(row.photoUrl, row.duplicateId!, accessToken);
          if (photoResult) photosImported++;else
          {photoErrors++;needsReview.push({ ...row, warnings: [...row.warnings, "Photo import failed"] });}
        }
        updated++;
        continue;
      }

      // Insert new
      const insertData = buildInsertData(row.data);
      const { data: inserted, error } = await supabase.from("youth_registrations").insert(insertData as any).select("id").single();
      if (error) {skipped++;needsReview.push({ ...row, warnings: [...row.warnings, `Insert failed: ${error.message}`] });continue;}

      // Photo for new record
      if (row.photoUrl && inserted && accessToken) {
        const photoResult = await importPhoto(row.photoUrl, inserted.id, accessToken);
        if (photoResult) photosImported++;else
        {photoErrors++;needsReview.push({ ...row, warnings: [...row.warnings, "Photo import failed – needs manual upload"] });}
      } else if (!row.photoUrl) {
        needsReview.push({ ...row, warnings: [...row.warnings, "No photo URL provided"], duplicateId: inserted?.id || null });
      }

      imported++;
    }

    setResults({ imported, updated, photosImported, skipped, photoErrors, needsReview });
    setIsImporting(false);
    setStep("results");
    onImportComplete();
  };

  const buildInsertData = (data: Record<string, string>) => {
    const rec: Record<string, any> = {
      approved_for_attendance: true,
      submission_date: new Date().toISOString().split("T")[0],
      // Required defaults for waiver fields
      medical_consent_name: "Imported from Monday.com",
      medical_consent_signature_url: "",
      liability_waiver_name: "Imported from Monday.com",
      liability_waiver_signature_url: "",
      transportation_excursions_waiver_name: "Imported from Monday.com",
      transportation_excursions_signature_url: "",
      media_consent_name: "Imported from Monday.com",
      media_consent_signature_url: "",
      spiritual_development_policy_name: "Imported from Monday.com",
      spiritual_development_policy_signature_url: ""
    };

    if (data.child_first_name) rec.child_first_name = data.child_first_name.trim();
    if (data.child_last_name) rec.child_last_name = data.child_last_name.trim();
    if (data.child_sex) rec.child_sex = normalizeSex(data.child_sex);
    if (data.child_date_of_birth) rec.child_date_of_birth = data.child_date_of_birth;
    if (data.child_race_ethnicity) rec.child_race_ethnicity = data.child_race_ethnicity;
    if (data.parent_first_name) rec.parent_first_name = data.parent_first_name.trim();
    if (data.parent_last_name) rec.parent_last_name = data.parent_last_name.trim();
    if (data.parent_phone) rec.parent_phone = normalizePhone(data.parent_phone);
    if (data.child_phone) rec.child_phone = normalizePhone(data.child_phone);
    if (data.parent_email) rec.parent_email = data.parent_email.trim().toLowerCase();
    if (data.child_primary_address) rec.child_primary_address = data.child_primary_address;
    if (data.child_school_district) rec.child_school_district = data.child_school_district;
    if (data.child_grade_level) rec.child_grade_level = parseInt(data.child_grade_level) || null;
    if (data.child_boxing_program) rec.child_boxing_program = data.child_boxing_program;
    if (data.adults_in_household) rec.adults_in_household = parseInt(data.adults_in_household) || 1;
    if (data.siblings_in_household) rec.siblings_in_household = parseInt(data.siblings_in_household) || 0;
    if (data.household_income_range) rec.household_income_range = data.household_income_range;
    if (data.free_or_reduced_lunch) rec.free_or_reduced_lunch = data.free_or_reduced_lunch;
    if (data.allergies) rec.allergies = data.allergies;
    if (data.asthma_inhaler_info) rec.asthma_inhaler_info = data.asthma_inhaler_info;
    if (data.important_child_notes) rec.important_child_notes = data.important_child_notes;

    // Ensure required enum fields have valid defaults
    if (!rec.child_sex) rec.child_sex = "Male";
    if (!rec.child_race_ethnicity) rec.child_race_ethnicity = "Two or More Races";
    if (!rec.child_school_district) rec.child_school_district = "Other";
    if (!rec.child_boxing_program) rec.child_boxing_program = "Junior Boxing (Ages 7-10)";
    if (!rec.adults_in_household) rec.adults_in_household = 1;
    if (!rec.siblings_in_household && rec.siblings_in_household !== 0) rec.siblings_in_household = 0;
    if (!rec.household_income_range) rec.household_income_range = "Under $25,000";
    if (!rec.parent_first_name) rec.parent_first_name = "Unknown";
    if (!rec.parent_last_name) rec.parent_last_name = "Unknown";
    if (!rec.parent_phone) rec.parent_phone = "+10000000000";
    if (!rec.parent_email) rec.parent_email = "imported@placeholder.com";
    if (!rec.child_primary_address) rec.child_primary_address = "Imported – needs update";

    return rec;
  };

  const importPhoto = async (url: string, registrationId: string, _accessToken: string): Promise<boolean> => {
    try {
      const resp = await supabase.functions.invoke("import-youth-photo", {
        body: { photoUrl: url, registrationId }
      });
      return !resp.error && resp.data?.success;
    } catch {
      return false;
    }
  };

  const mappableFields = Object.entries(FIELD_MAP).map(([key, { aliases }]) => ({
    key,
    label: aliases[0].replace(/\b\w/g, (c) => c.toUpperCase())
  }));

  const mappedFieldKeys = new Set(Object.values(columnMapping));

  return (
    <Dialog open={open} onOpenChange={(v) => {if (!v) reset();onOpenChange(v);}}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col bg-black border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-red-400" />
            Import Youth from Monday.com
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-auto pr-2">
          {/* Step 1: Upload */}
          {step === "upload" &&
          <div className="space-y-6 py-4">
              <p className="text-sm text-white/60">
                Upload a CSV export from Monday.com. If the export includes photo/image URLs, they will be imported automatically.
              </p>
              <div className="border-2 border-dashed border-white/20 rounded-lg p-8 text-center">
                <FileText className="w-10 h-10 mx-auto text-white/30 mb-3" />
                <p className="text-sm text-white/50 mb-4">Choose a CSV file to import</p>
                <label className="cursor-pointer">
                  <Input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                  <Button variant="outline" className="border-white/20 text-white hover:bg-white/10" asChild>
                    <span className="text-primary">Select CSV File</span>
                  </Button>
                </label>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-2 text-sm text-white/60">
                <p className="font-medium text-white/80">Import Options:</p>
                <p>• <strong>Option 1:</strong> CSV with profile data only</p>
                <p>• <strong>Option 2:</strong> CSV with profile data + photo URLs from Monday.com file/image column</p>
                <p className="text-white/40 text-xs mt-2">Photos will be downloaded and stored securely. If a photo URL is inaccessible, the profile is still imported and flagged for manual photo upload.</p>
              </div>
            </div>
          }

          {/* Step 2: Column Mapping */}
          {step === "mapping" &&
          <div className="space-y-4 py-4">
              <p className="text-sm text-white/60">
                We detected <strong>{csvRows.length}</strong> rows. Map your CSV columns to registration fields below.
              </p>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {csvHeaders.map((header, idx) =>
              <div key={idx} className="flex items-center gap-3 p-2 rounded bg-white/5">
                    <span className="text-sm text-white/70 w-48 truncate" title={header}>{header}</span>
                    <span className="text-white/30">→</span>
                    <Select
                  value={columnMapping[idx] || "_skip"}
                  onValueChange={(v) => setColumnMapping((m) => ({ ...m, [idx]: v === "_skip" ? undefined! : v }))}>
                  
                      <SelectTrigger className="w-56 bg-white/5 border-white/20 text-white h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_skip">— Skip —</SelectItem>
                        {mappableFields.map((f) =>
                    <SelectItem key={f.key} value={f.key} disabled={mappedFieldKeys.has(f.key) && columnMapping[idx] !== f.key}>
                            {f.label} {f.key === "photo_url" && "📷"}
                          </SelectItem>
                    )}
                      </SelectContent>
                    </Select>
                    {columnMapping[idx] &&
                <Badge className="bg-green-500/15 text-green-500 border-green-500/30 text-[10px]">Mapped</Badge>
                }
                  </div>
              )}
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
                <Button variant="outline" onClick={() => setStep("upload")} className="border-white/20 text-white hover:bg-white/10">Back</Button>
                <Button onClick={buildPreview} className="bg-red-600 hover:bg-red-700">Preview Import</Button>
              </div>
            </div>
          }

          {/* Step 3: Preview */}
          {step === "preview" &&
          <div className="space-y-4 py-4">
              {/* Summary cards */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {[
              { label: "Total Rows", value: previewStats.total, color: "" },
              { label: "Ready", value: previewStats.valid, color: "text-green-400" },
              { label: "With Photos", value: previewStats.withPhotos, color: "text-blue-400" },
              { label: "No Photo", value: previewStats.missingPhotos, color: "text-amber-400" },
              { label: "Duplicates", value: previewStats.duplicates, color: "text-yellow-400" },
              { label: "Warnings", value: previewStats.withWarnings, color: "text-red-400" }].
              map((s) =>
              <Card key={s.label} className="bg-white/5 border-white/10">
                    <CardContent className="pt-3 pb-2 text-center">
                      <p className="text-[10px] text-white/50">{s.label}</p>
                      <p className={`text-lg font-bold ${s.color || "text-white"}`}>{s.value}</p>
                    </CardContent>
                  </Card>
              )}
              </div>

              {/* Duplicate handling */}
              {previewStats.duplicates > 0 &&
            <div className="flex items-center gap-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                  <span className="text-sm text-yellow-400">{previewStats.duplicates} duplicate(s) found.</span>
                  <Select value={duplicateAction} onValueChange={(v: DuplicateAction) => setDuplicateAction(v)}>
                    <SelectTrigger className="w-52 bg-white/5 border-white/20 text-white h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="skip">Skip existing</SelectItem>
                      <SelectItem value="update">Update profile fields</SelectItem>
                      <SelectItem value="update_with_photo">Update fields + replace photo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
            }

              {/* Preview table */}
              <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10">
                      <TableHead className="text-white/60 text-xs">#</TableHead>
                      <TableHead className="text-white/60 text-xs">Child Name</TableHead>
                      <TableHead className="text-white/60 text-xs">Program</TableHead>
                      <TableHead className="text-white/60 text-xs">District</TableHead>
                      <TableHead className="text-white/60 text-xs">Photo</TableHead>
                      <TableHead className="text-white/60 text-xs">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importRows.slice(0, 50).map((row, i) =>
                  <TableRow key={i} className="border-white/10">
                        <TableCell className="text-white/40 text-xs">{i + 1}</TableCell>
                        <TableCell className="text-white text-sm">{row.data.child_first_name || "—"} {row.data.child_last_name || "—"}</TableCell>
                        <TableCell className="text-white/60 text-xs">{row.data.child_boxing_program || "Default"}</TableCell>
                        <TableCell className="text-white/60 text-xs">{row.data.child_school_district || "Other"}</TableCell>
                        <TableCell>
                          {row.photoUrl ?
                      <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 text-[10px]">URL Found</Badge> :

                      <Badge className="bg-white/5 text-white/30 border-white/10 text-[10px]">Missing</Badge>
                      }
                        </TableCell>
                        <TableCell>
                          {!row.valid ?
                      <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-[10px]">Invalid</Badge> :
                      row.isDuplicate ?
                      <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/30 text-[10px]">Duplicate</Badge> :

                      <Badge className="bg-green-500/15 text-green-400 border-green-500/30 text-[10px]">Ready</Badge>
                      }
                        </TableCell>
                      </TableRow>
                  )}
                  </TableBody>
                </Table>
              </div>
              {importRows.length > 50 && <p className="text-xs text-white/30 text-center">Showing first 50 of {importRows.length} rows</p>}

              <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
                <Button variant="outline" onClick={() => setStep("mapping")} className="border-white/20 text-white hover:bg-white/10">Back</Button>
                <Button onClick={executeImport} className="bg-green-600 hover:bg-green-700" disabled={previewStats.valid === 0}>
                  Import {previewStats.valid} Records
                </Button>
              </div>
            </div>
          }

          {/* Step 4: Importing */}
          {step === "importing" &&
          <div className="py-12 text-center space-y-4">
              <Loader2 className="w-10 h-10 mx-auto animate-spin text-red-400" />
              <p className="text-white/70">Importing records and downloading photos...</p>
              <div className="w-64 mx-auto bg-white/10 rounded-full h-2">
                <div className="bg-red-500 h-2 rounded-full transition-all" style={{ width: `${importProgress}%` }} />
              </div>
              <p className="text-sm text-white/40">{importProgress}% complete</p>
            </div>
          }

          {/* Step 5: Results */}
          {step === "results" && results &&
          <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
              { label: "Records Imported", value: results.imported, icon: CheckCircle2, color: "text-green-400" },
              { label: "Records Updated", value: results.updated, icon: CheckCircle2, color: "text-blue-400" },
              { label: "Photos Imported", value: results.photosImported, icon: Camera, color: "text-green-400" },
              { label: "Records Skipped", value: results.skipped, icon: AlertTriangle, color: "text-amber-400" },
              { label: "Photo Errors", value: results.photoErrors, icon: ImageOff, color: "text-red-400" },
              { label: "Needs Review", value: results.needsReview.length, icon: AlertTriangle, color: "text-yellow-400" }].
              map((s) =>
              <Card key={s.label} className="bg-white/5 border-white/10">
                    <CardContent className="pt-3 pb-2 text-center">
                      <s.icon className={`w-5 h-5 mx-auto mb-1 ${s.color}`} />
                      <p className="text-[10px] text-white/50">{s.label}</p>
                      <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                    </CardContent>
                  </Card>
              )}
              </div>

              {results.needsReview.length > 0 &&
            <div>
                  <p className="text-sm font-medium text-white/70 mb-2">Records Needing Review</p>
                  <div className="max-h-[200px] overflow-y-auto space-y-1">
                    {results.needsReview.map((row, i) =>
                <div key={i} className="flex items-center gap-3 p-2 rounded bg-white/5 text-sm">
                        <span className="text-white">{row.data.child_first_name} {row.data.child_last_name}</span>
                        <span className="text-white/30">–</span>
                        <span className="text-white/40 text-xs">{row.warnings.join("; ")}</span>
                      </div>
                )}
                  </div>
                </div>
            }

              <div className="flex justify-end pt-3 border-t border-white/10">
                <Button onClick={() => {reset();onOpenChange(false);}} className="bg-white/10 hover:bg-white/15 text-white">
                  Done
                </Button>
              </div>
            </div>
          }
        </ScrollArea>
      </DialogContent>
    </Dialog>);

};

export default YouthImportModal;