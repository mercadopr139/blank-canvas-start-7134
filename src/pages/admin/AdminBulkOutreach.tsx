import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { OUTREACH_TOKENS, applyTokens, buildOutreachEmailHtml, getSenderProfile } from "@/lib/outreachTokens";
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
  "VIP",
  "Meal Train",
  "Monthly Postcard",
  "Event Alerts",
  "Program Updates",
  "Sponsors",
  "Donors",
];

const FROM_ADDRESSES = [
  "joshmercado@nolimitsboxingacademy.org",
  "info@nolimitsboxingacademy.org",
  "alexandravalerio@nolimitsboxingacademy.org",
  "chrissycasiello@nolimitsboxingacademy.org",
];

const STATUSES = ["Donor", "Sponsor", "Meal Train", "Partner", "Advocate", "In-Kind Support"];
const CATEGORIES = ["Individual", "Organization"];
const REVENUE_STREAMS = ["Donation", "Sponsorship", "Fee for Service", "Re-Grant", "Mixed"];

// ─── Types ───────────────────────────────────────────────────────────────────

interface Supporter {
  id: string;
  name: string;
  greeting_name: string | null;
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
  const [statusFilter, setStatusFilter] = useState<string>("all");
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
  const [previewRecipientId, setPreviewRecipientId] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const subjectRef = useRef<HTMLInputElement | null>(null);
  // Track the last focused composer field so the Insert Token toolbar drops
  // tokens into whichever field the admin was actually working in (subject vs body).
  const [lastFocused, setLastFocused] = useState<"body" | "subject">("body");

  // Insert a personalization token at the cursor position in the last-focused
  // composer field (subject or body). Falls back to appending to the body if
  // no field has been focused yet.
  const insertToken = (token: string) => {
    const target = lastFocused === "subject" ? subjectRef.current : bodyRef.current;
    const currentValue = lastFocused === "subject" ? subject : body;
    const setValue = lastFocused === "subject" ? setSubject : setBody;
    if (!target) {
      setValue(currentValue + token);
      return;
    }
    const start = target.selectionStart ?? currentValue.length;
    const end = target.selectionEnd ?? currentValue.length;
    const next = currentValue.slice(0, start) + token + currentValue.slice(end);
    setValue(next);
    // Restore focus and put the cursor right after the inserted token.
    requestAnimationFrame(() => {
      target.focus();
      const cursor = start + token.length;
      target.setSelectionRange(cursor, cursor);
    });
  };

  // ── Fetch supporters
  const fetchSupporters = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("supporters")
      .select("id, name, greeting_name, email, status, supporter_category, primary_revenue_stream, outreach_tags, email_opt_in")
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
      const htmlBody = buildOutreachEmailHtml({ body, fromAddress });

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
              <label className="text-xs text-white/50 mb-1 block">Supporter Role</label>
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
              ref={subjectRef}
              placeholder="Email subject line…"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              onFocus={() => setLastFocused("subject")}
              className="bg-white/5 border-white/20 text-white placeholder:text-white/30 text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-white/50 mb-1 block">Message Body</label>
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              <span className="text-[10px] text-white/40 uppercase tracking-wider">Insert token:</span>
              {OUTREACH_TOKENS.map((t) => (
                <button
                  key={t.token}
                  type="button"
                  onClick={() => insertToken(t.token)}
                  title={t.description}
                  className="text-[11px] bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 hover:border-white/30 rounded px-2 py-0.5 transition-colors"
                >
                  {t.label}
                </button>
              ))}
              <span className="text-[10px] text-white/30 ml-1">
                — these get swapped per recipient when sent
              </span>
            </div>
            <Textarea
              ref={bodyRef}
              placeholder="Write your message here… use Insert token buttons above to add per-recipient personalization, e.g. Hi {{first_name}}, …"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onFocus={() => setLastFocused("body")}
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
      <Dialog
        open={previewOpen}
        onOpenChange={(open) => {
          setPreviewOpen(open);
          // Default the preview recipient to the first selected supporter
          // when the dialog opens, so there's always something useful to show.
          if (open && !previewRecipientId) {
            const firstSelected = filtered.find((s) => selected.has(s.id));
            if (firstSelected) setPreviewRecipientId(firstSelected.id);
          }
        }}
      >
        <DialogContent className="bg-zinc-900 border-white/10 text-white max-w-2xl max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Email Preview</DialogTitle>
          </DialogHeader>
          {(() => {
            const selectedRecipients = filtered.filter((s) => selected.has(s.id) && s.email);
            const previewSupporter =
              selectedRecipients.find((s) => s.id === previewRecipientId) ||
              selectedRecipients[0] ||
              null;
            const resolvedSubject = previewSupporter ? applyTokens(subject, previewSupporter) : subject;
            const resolvedBody = previewSupporter ? applyTokens(body, previewSupporter) : body;
            const senderProfile = getSenderProfile(fromAddress);
            // Render the actual HTML the recipient will see, signature and all.
            // Using an iframe so the email's styles don't bleed into the dashboard.
            const previewHtml = buildOutreachEmailHtml({ body: resolvedBody, fromAddress });

            return (
              <div className="space-y-3 text-sm">
                {selectedRecipients.length === 0 ? (
                  <p className="text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded px-3 py-2">
                    Select at least one supporter with an email to preview a personalized message.
                  </p>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-white/60 text-xs whitespace-nowrap">Preview as:</span>
                    <Select
                      value={previewSupporter?.id ?? ""}
                      onValueChange={(v) => setPreviewRecipientId(v)}
                    >
                      <SelectTrigger className="bg-white/5 border-white/20 text-white text-xs h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedRecipients.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name} {s.email ? `· ${s.email}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-white/30 text-[11px] whitespace-nowrap">
                      {selectedRecipients.length} selected
                    </span>
                  </div>
                )}

                <div>
                  <span className="text-white/50">From:</span>{" "}
                  {senderProfile.displayName} <span className="text-white/40">&lt;{fromAddress}&gt;</span>
                </div>
                <div>
                  <span className="text-white/50">To:</span>{" "}
                  {previewSupporter ? (
                    <>
                      {previewSupporter.name}{" "}
                      <span className="text-white/40">&lt;{previewSupporter.email}&gt;</span>
                    </>
                  ) : (
                    "(no recipient)"
                  )}
                </div>
                <div><span className="text-white/50">Subject:</span> {resolvedSubject || "(empty)"}</div>
                <hr className="border-white/10" />
                <iframe
                  title="Email preview"
                  srcDoc={previewHtml}
                  className="w-full bg-white rounded border border-white/10"
                  style={{ height: 520 }}
                />
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminBulkOutreach;
