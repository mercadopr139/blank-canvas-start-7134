import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Search, Send, Eye, Mail } from "lucide-react";
import { toast } from "sonner";

// ─── Constants ───────────────────────────────────────────────────────────────

const OUTREACH_TAG_OPTIONS = [
  "Meal Train",
  "Monthly Postcard",
  "Event Alerts",
  "Program Updates",
  "Sponsors",
  "Donors",
];

const FROM_ADDRESSES = [
  "info@nolimitsboxingacademy.org",
  "alexandravalerio@nolimitsboxingacademy.org",
  "chrissycasiello@nolimitsboxingacademy.org",
];

const STATUSES = ["Active", "Prospect", "Lapsed", "Past"];
const CATEGORIES = ["Individual", "Organization"];
const REVENUE_STREAMS = ["Donation", "Sponsorship", "Fee for Service", "Re-Grant", "Mixed"];

// ─── Types ───────────────────────────────────────────────────────────────────

interface Supporter {
  id: string;
  name: string;
  email: string | null;
  status: string | null;
  supporter_category: string | null;
  primary_revenue_stream: string | null;
  outreach_tags: string[] | null;
  email_opt_in: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

const AdminBulkOutreach = () => {
  // ── Filter state
  const [statusFilter, setStatusFilter] = useState<string>("Active");
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [revenueFilter, setRevenueFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  // ── Data state
  const [supporters, setSupporters] = useState<Supporter[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // ── Email composer state
  const [fromAddress, setFromAddress] = useState(FROM_ADDRESSES[0]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loggedBy, setLoggedBy] = useState("");
  const [sending, setSending] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  // ── Fetch supporters
  const fetchSupporters = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("supporters")
      .select("id, name, email, status, supporter_category, primary_revenue_stream, outreach_tags, email_opt_in")
      .eq("email_opt_in", true)
      .order("name");

    if (statusFilter && statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }
    if (categoryFilter && categoryFilter !== "all") {
      query = query.eq("supporter_category", categoryFilter);
    }
    if (revenueFilter && revenueFilter !== "all") {
      query = query.eq("primary_revenue_stream", revenueFilter);
    }

    const { data } = await query;

    let results = (data || []) as Supporter[];

    // Client-side tag filtering (contains all selected tags)
    if (tagFilters.length > 0) {
      results = results.filter((s) =>
        tagFilters.every((tag) => s.outreach_tags?.includes(tag))
      );
    }

    setSupporters(results);
    // Keep selection that still exists in results
    setSelected((prev) => {
      const ids = new Set(results.map((r) => r.id));
      const next = new Set<string>();
      prev.forEach((id) => { if (ids.has(id)) next.add(id); });
      return next;
    });
    setLoading(false);
  }, [statusFilter, tagFilters, categoryFilter, revenueFilter]);

  useEffect(() => { fetchSupporters(); }, [fetchSupporters]);

  // ── Filtered by search
  const filtered = useMemo(
    () =>
      supporters.filter(
        (s) =>
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          (s.email && s.email.toLowerCase().includes(search.toLowerCase()))
      ),
    [supporters, search]
  );

  // ── Selection helpers
  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((s) => s.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleTag = (tag: string) => {
    setTagFilters((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  // ── Send
  const handleSend = async () => {
    if (selected.size === 0) { toast.error("Select at least one supporter."); return; }
    if (!subject.trim()) { toast.error("Subject is required."); return; }
    if (!body.trim()) { toast.error("Message body is required."); return; }

    setSending(true);
    try {
      const htmlBody = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f9f9f9;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;">
<tr><td align="center" style="padding:24px 0;">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;padding:32px;font-family:Arial,sans-serif;color:#333;">
<tr><td>
  <h2 style="margin:0 0 16px;color:#1a1a1a;">No Limits Academy</h2>
  ${body.split("\n").map((p) => `<p style="margin:0 0 12px;">${p}</p>`).join("")}
</td></tr></table>
</td></tr></table></body></html>`;

      const { data, error } = await supabase.functions.invoke("send-bulk-email", {
        body: {
          supporter_ids: Array.from(selected),
          from_address: fromAddress,
          subject: subject.trim(),
          html_body: htmlBody,
          logged_by: loggedBy.trim(),
        },
      });

      if (error) throw error;

      const r = data as any;
      toast.success(
        `Sent ${r.sent} email(s). ${r.failed ? `${r.failed} failed.` : ""} ${r.skipped_no_email ? `${r.skipped_no_email} had no email.` : ""} ${r.skipped_opt_out ? `${r.skipped_opt_out} opted out.` : ""}`,
        { duration: 8000 }
      );

      // Reset
      setSubject("");
      setBody("");
      setSelected(new Set());
    } catch (e: any) {
      toast.error(e.message || "Failed to send emails.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-black text-white">
      {/* Header */}
      <div className="border-b border-white/10 px-4 py-3">
        <h2 className="text-base font-semibold text-white flex items-center gap-2">
          <Mail className="w-4 h-4" /> Bulk Outreach
        </h2>
        <p className="text-xs text-white/50">Send targeted emails to filtered supporters</p>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-8">
        {/* ── SECTION 1: Recipient Selection ── */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-white/80 uppercase tracking-wider">
            1. Select Recipients
          </h3>

          {/* Filters row */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-40">
              <label className="text-xs text-white/50 mb-1 block">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-white/5 border-white/20 text-white text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-44">
              <label className="text-xs text-white/50 mb-1 block">Category</label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="bg-white/5 border-white/20 text-white text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-48">
              <label className="text-xs text-white/50 mb-1 block">Revenue Stream</label>
              <Select value={revenueFilter} onValueChange={setRevenueFilter}>
                <SelectTrigger className="bg-white/5 border-white/20 text-white text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {REVENUE_STREAMS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="relative flex-1 min-w-[200px]">
              <label className="text-xs text-white/50 mb-1 block">Search</label>
              <Search className="absolute left-3 top-[calc(50%+2px)] w-4 h-4 text-white/40" />
              <Input
                placeholder="Name or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-white/5 border-white/20 text-white placeholder:text-white/30 text-sm"
              />
            </div>
          </div>

          {/* Outreach Tags */}
          <div>
            <label className="text-xs text-white/50 mb-2 block">Outreach Tags</label>
            <div className="flex flex-wrap gap-2">
              {OUTREACH_TAG_OPTIONS.map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className={`cursor-pointer text-xs transition-colors ${
                    tagFilters.includes(tag)
                      ? "bg-green-600/30 text-green-300 border-green-500/50"
                      : "bg-white/5 text-white/60 border-white/20 hover:bg-white/10"
                  }`}
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </div>

          {/* Selected count */}
          <div className="flex items-center gap-3">
            <Badge className="bg-sky-600/20 text-sky-300 border-sky-500/30">
              {selected.size} selected
            </Badge>
            <span className="text-xs text-white/40">
              {filtered.length} supporter(s) match filters • Only Email Opt-In = ✓ shown
            </span>
          </div>

          {/* Supporters table */}
          <div className="rounded-lg border border-white/10 overflow-auto max-h-[400px]">
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="w-10">
                    <Checkbox
                      checked={filtered.length > 0 && selected.size === filtered.length}
                      onCheckedChange={toggleAll}
                      className="border-white/40 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                    />
                  </TableHead>
                  <TableHead className="text-white bg-green-600">Name</TableHead>
                  <TableHead className="text-white bg-green-600">Email</TableHead>
                  <TableHead className="text-white bg-green-600">Status</TableHead>
                  <TableHead className="text-white bg-green-600">Tags</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow className="border-white/10">
                    <TableCell colSpan={5} className="text-center py-12 text-white/50">Loading…</TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow className="border-white/10">
                    <TableCell colSpan={5} className="text-center py-12 text-white/50">No supporters match filters.</TableCell>
                  </TableRow>
                ) : (
                  filtered.map((s) => (
                    <TableRow key={s.id} className="border-white/10 hover:bg-white/5">
                      <TableCell>
                        <Checkbox
                          checked={selected.has(s.id)}
                          onCheckedChange={() => toggleOne(s.id)}
                          className="border-white/40 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                        />
                      </TableCell>
                      <TableCell className="text-white font-medium">{s.name}</TableCell>
                      <TableCell className="text-white/70">{s.email || "—"}</TableCell>
                      <TableCell>
                        <Badge className="bg-white/10 text-white/70 border-white/20 text-xs">
                          {s.status || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(s.outreach_tags || []).map((t) => (
                            <Badge key={t} variant="outline" className="text-[10px] bg-white/5 text-white/50 border-white/15">
                              {t}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>

        {/* ── SECTION 2: Email Composer ── */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-white/80 uppercase tracking-wider">
            2. Compose Email
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-white/50 mb-1 block">Send From</label>
              <Select value={fromAddress} onValueChange={setFromAddress}>
                <SelectTrigger className="bg-white/5 border-white/20 text-white text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FROM_ADDRESSES.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">Logged By</label>
              <Input
                placeholder="Your name"
                value={loggedBy}
                onChange={(e) => setLoggedBy(e.target.value)}
                className="bg-white/5 border-white/20 text-white placeholder:text-white/30 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-white/50 mb-1 block">Subject</label>
            <Input
              placeholder="Email subject line…"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="bg-white/5 border-white/20 text-white placeholder:text-white/30 text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-white/50 mb-1 block">Message Body</label>
            <Textarea
              placeholder="Write your message here… (use line breaks for paragraphs)"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              className="bg-white/5 border-white/20 text-white placeholder:text-white/30 text-sm resize-y"
            />
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="text-sky-300 hover:text-sky-200 hover:bg-white/10"
              onClick={() => setPreviewOpen(true)}
              disabled={!body.trim()}
            >
              <Eye className="w-4 h-4 mr-1" /> Preview
            </Button>
          </div>
        </section>

        {/* ── SECTION 3: Send ── */}
        <section className="border-t border-white/10 pt-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-white/40">
              Emails will be sent individually. An engagement record is created per recipient.
            </p>
            <Button
              onClick={handleSend}
              disabled={sending || selected.size === 0 || !subject.trim() || !body.trim()}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Send className="w-4 h-4 mr-2" />
              {sending ? "Sending…" : `Send Email to ${selected.size} Supporter(s)`}
            </Button>
          </div>
        </section>
      </div>

      {/* ── Preview Dialog ── */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="bg-zinc-900 border-white/10 text-white max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Email Preview</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div><span className="text-white/50">From:</span> {fromAddress}</div>
            <div><span className="text-white/50">Subject:</span> {subject || "(empty)"}</div>
            <hr className="border-white/10" />
            <div className="bg-white rounded p-6 text-black">
              <h2 className="text-lg font-bold mb-3">No Limits Academy</h2>
              {body.split("\n").map((p, i) => (
                <p key={i} className="mb-2">{p || <br />}</p>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminBulkOutreach;
