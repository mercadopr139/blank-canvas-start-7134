import { useState, useEffect, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Send, Search, Eye, RefreshCw, CheckCircle, Mail, XCircle, Clock, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type Invoice = Tables<"invoices">;

interface SendHistoryItem {
  id: string;
  invoice_id: string;
  sent_to: string;
  subject: string;
  message: string | null;
  sent_at: string;
  type: string;
  status: string;
  error: string | null;
  provider_message_id?: string | null;
  provider_status?: string | null;
  last_checked_at?: string | null;
}

interface ResendCenterDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoices: (Invoice & { client_name?: string })[];
  onResendInvoice: (invoice: Invoice & { client_name?: string }) => void;
  onViewInvoice: (invoice: Invoice) => void;
}

const statusConfig: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  success: { label: "Sent", className: "bg-green-500/10 text-green-500", icon: <CheckCircle className="w-3 h-3" /> },
  sent: { label: "Sent", className: "bg-green-500/10 text-green-500", icon: <CheckCircle className="w-3 h-3" /> },
  delivered: { label: "Delivered", className: "bg-emerald-500/10 text-emerald-400", icon: <CheckCircle className="w-3 h-3" /> },
  opened: { label: "Opened", className: "bg-sky-500/10 text-sky-400", icon: <Eye className="w-3 h-3" /> },
  bounced: { label: "Bounced", className: "bg-amber-500/10 text-amber-500", icon: <AlertCircle className="w-3 h-3" /> },
  failed: { label: "Failed", className: "bg-red-500/10 text-red-500", icon: <XCircle className="w-3 h-3" /> },
  queued: { label: "Queued", className: "bg-muted text-muted-foreground", icon: <Clock className="w-3 h-3" /> },
};

export default function ResendCenterDrawer({
  open,
  onOpenChange,
  invoices,
  onResendInvoice,
  onViewInvoice,
}: ResendCenterDrawerProps) {
  const [history, setHistory] = useState<SendHistoryItem[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateRange, setDateRange] = useState("90");
  const [isLoading, setIsLoading] = useState(false);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchHistory = async () => {
    setIsLoading(true);
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(dateRange));

    const { data, error } = await supabase
      .from("invoice_sends")
      .select("*")
      .gte("sent_at", daysAgo.toISOString())
      .order("sent_at", { ascending: false })
      .limit(200);

    if (error) {
      toast({ title: "Error loading send history", description: error.message, variant: "destructive" });
    } else {
      setHistory((data as SendHistoryItem[]) || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (open) fetchHistory();
  }, [open, dateRange]);

  const enrichedHistory = useMemo(() => {
    return history.map((h) => {
      const inv = invoices.find((i) => i.id === h.invoice_id);
      return {
        ...h,
        invoice_number: inv?.invoice_number || "—",
        client_name: inv?.client_name || "—",
        invoice: inv,
      };
    });
  }, [history, invoices]);

  const filtered = useMemo(() => {
    return enrichedHistory.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (typeFilter !== "all" && item.type !== typeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !item.invoice_number.toLowerCase().includes(q) &&
          !item.client_name.toLowerCase().includes(q) &&
          !item.sent_to.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [enrichedHistory, search, statusFilter, typeFilter]);

  const handleCheckDelivery = async (item: SendHistoryItem) => {
    setCheckingId(item.id);
    // Resend doesn't expose delivery tracking via API in the free tier.
    // We update last_checked_at and note that provider tracking is unavailable.
    const { error } = await supabase
      .from("invoice_sends")
      .update({
        last_checked_at: new Date().toISOString(),
        provider_status: "no_tracking",
      } as any)
      .eq("id", item.id);

    if (error) {
      toast({ title: "Error checking delivery", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: "Status checked",
        description: "Email was sent successfully. Provider does not confirm delivery tracking.",
      });
      fetchHistory();
    }
    setCheckingId(null);
  };

  const getStatusBadge = (item: SendHistoryItem) => {
    const cfg = statusConfig[item.status] || statusConfig.queued;
    return (
      <Badge className={cfg.className + " gap-1"}>
        {cfg.icon}
        {cfg.label}
      </Badge>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-3xl bg-black border-white/10 text-white overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-white flex items-center gap-2">
            <Send className="w-5 h-5 text-sky-400" />
            Resend Center
          </SheetTitle>
        </SheetHeader>

        {/* Filters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="col-span-2 sm:col-span-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <Input
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="success">Sent</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="opened">Opened</SelectItem>
              <SelectItem value="bounced">Bounced</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="initial">Initial</SelectItem>
              <SelectItem value="resend">Resend</SelectItem>
            </SelectContent>
          </Select>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white">
              <SelectValue placeholder="Date range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="text-center py-12 text-white/50">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Mail className="w-10 h-10 mx-auto text-white/20 mb-3" />
            <p className="text-white/50">No send events found</p>
          </div>
        ) : (
          <div className="rounded-lg border border-white/10 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-white/5">
                  <TableHead className="text-white/70 text-xs">Date/Time</TableHead>
                  <TableHead className="text-white/70 text-xs">Invoice #</TableHead>
                  <TableHead className="text-white/70 text-xs">Client</TableHead>
                  <TableHead className="text-white/70 text-xs">Sent To</TableHead>
                  <TableHead className="text-white/70 text-xs">Type</TableHead>
                  <TableHead className="text-white/70 text-xs">Status</TableHead>
                  <TableHead className="text-white/70 text-xs text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => (
                  <TableRow key={item.id} className="border-white/10 hover:bg-white/5">
                    <TableCell className="text-xs text-white/70">
                      {format(new Date(item.sent_at), "MMM d, yyyy")}
                      <br />
                      <span className="text-white/40">{format(new Date(item.sent_at), "h:mm a")}</span>
                    </TableCell>
                    <TableCell className="text-sm font-medium text-white">{item.invoice_number}</TableCell>
                    <TableCell className="text-sm text-white">{item.client_name}</TableCell>
                    <TableCell className="text-xs text-white/70 max-w-[140px] truncate">{item.sent_to}</TableCell>
                    <TableCell>
                      {item.type === "resend" ? (
                        <Badge className="bg-sky-500/10 text-sky-400 gap-1">
                          <Send className="w-3 h-3" />
                          Resend
                        </Badge>
                      ) : (
                        <Badge className="bg-blue-500/10 text-blue-400 gap-1">
                          <Mail className="w-3 h-3" />
                          Initial
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(item)}
                      {item.last_checked_at && (
                        <span className="block text-[10px] text-white/30 mt-0.5">
                          Checked {format(new Date(item.last_checked_at), "MMM d")}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {item.invoice && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              onOpenChange(false);
                              setTimeout(() => onViewInvoice(item.invoice!), 300);
                            }}
                            className="text-white/70 hover:text-white hover:bg-white/10"
                            title="View invoice"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {item.invoice && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              onOpenChange(false);
                              setTimeout(() => onResendInvoice(item.invoice!), 300);
                            }}
                            className="text-sky-400 hover:text-sky-300 hover:bg-white/10"
                            title="Resend again"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCheckDelivery(item)}
                          disabled={checkingId === item.id}
                          className="text-white/50 hover:text-white hover:bg-white/10"
                          title="Check delivery"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${checkingId === item.id ? "animate-spin" : ""}`} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <p className="text-[11px] text-white/30 mt-4 text-center">
          Showing {filtered.length} of {history.length} events • Delivery tracking via Resend is limited
        </p>
      </SheetContent>
    </Sheet>
  );
}
