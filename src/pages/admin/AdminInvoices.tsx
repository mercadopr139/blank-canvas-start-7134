import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import InvoicePreview from "@/components/admin/InvoicePreview";
import ClientFormDialog from "@/components/admin/ClientFormDialog";
import SentInvoicesTable from "@/components/admin/SentInvoicesTable";
import { ArrowLeft, FileText, Eye, CalendarDays, Plus, Pencil, Trash2, Mail } from "lucide-react";
import { format } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";
type Client = Tables<"clients">;
type ServiceLog = Tables<"service_logs">;
type Invoice = Tables<"invoices">;
const MONTHS = [{
  value: "1",
  label: "January"
}, {
  value: "2",
  label: "February"
}, {
  value: "3",
  label: "March"
}, {
  value: "4",
  label: "April"
}, {
  value: "5",
  label: "May"
}, {
  value: "6",
  label: "June"
}, {
  value: "7",
  label: "July"
}, {
  value: "8",
  label: "August"
}, {
  value: "9",
  label: "September"
}, {
  value: "10",
  label: "October"
}, {
  value: "11",
  label: "November"
}, {
  value: "12",
  label: "December"
}];
const currentYear = new Date().getFullYear();
const YEARS = Array.from({
  length: 5
}, (_, i) => ({
  value: String(currentYear - 2 + i),
  label: String(currentYear - 2 + i)
}));
const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-500/10 text-blue-600",
  paid: "bg-green-500/10 text-green-600"
};
export default function AdminInvoices() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>(String(new Date().getMonth() + 1));
  const [selectedYear, setSelectedYear] = useState<string>(String(currentYear));
  const [serviceLogs, setServiceLogs] = useState<ServiceLog[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [existingInvoice, setExistingInvoice] = useState<Invoice | null>(null);
  const [invoices, setInvoices] = useState<(Invoice & {
    client_name?: string;
  })[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [tempInvoiceNumber, setTempInvoiceNumber] = useState("");
  const [showClientDialog, setShowClientDialog] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deleteClientId, setDeleteClientId] = useState<string | null>(null);
  const [deleteInvoiceId, setDeleteInvoiceId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("all");
  const autoGenerateTriggered = useRef(false);
  const {
    toast
  } = useToast();
  const {
    signOut
  } = useAuth();

  // Apply URL params on mount
  useEffect(() => {
    const clientId = searchParams.get("client");
    const month = searchParams.get("month");
    const year = searchParams.get("year");
    if (clientId) setSelectedClientId(clientId);
    if (month) setSelectedMonth(month);
    if (year) setSelectedYear(year);
    // Check for tab param
    const tabParam = searchParams.get("tab");
    if (tabParam === "sent") setActiveTab("sent");
  }, []);
  const fetchClients = async () => {
    const {
      data,
      error
    } = await supabase.from("clients").select("*").order("client_name");
    if (error) {
      toast({
        title: "Error fetching clients",
        description: error.message,
        variant: "destructive"
      });
    } else {
      setClients(data || []);
    }
  };

  // Fetch clients on mount
  useEffect(() => {
    fetchClients();
    fetchInvoices();
  }, []);
  const fetchInvoices = async () => {
    const {
      data,
      error
    } = await supabase.from("invoices").select("*").order("created_at", {
      ascending: false
    }).limit(50);
    if (error) {
      toast({
        title: "Error fetching invoices",
        description: error.message,
        variant: "destructive"
      });
    } else {
      // Fetch client names
      const invoicesWithClients = await Promise.all((data || []).map(async inv => {
        const client = clients.find(c => c.id === inv.client_id);
        if (client) {
          return {
            ...inv,
            client_name: client.client_name
          };
        }
        // Fallback fetch if clients not loaded yet
        const {
          data: clientData
        } = await supabase.from("clients").select("client_name").eq("id", inv.client_id).single();
        return {
          ...inv,
          client_name: clientData?.client_name || "Unknown"
        };
      }));
      setInvoices(invoicesWithClients);
    }
  };
  const handleGeneratePreview = useCallback(async (clientIdOverride?: string) => {
    const clientId = clientIdOverride || selectedClientId;
    if (!clientId) {
      toast({
        title: "Please select a client",
        variant: "destructive"
      });
      return;
    }
    setIsLoading(true);
    const month = parseInt(selectedMonth);
    const year = parseInt(selectedYear);

    // Fetch service logs for the selected month/year
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate = new Date(year, month, 0).toISOString().split("T")[0];
    const {
      data: logs,
      error: logsError
    } = await supabase.from("service_logs").select("*").eq("client_id", clientId).gte("service_date", startDate).lte("service_date", endDate).order("service_date");
    if (logsError) {
      toast({
        title: "Error fetching service logs",
        description: logsError.message,
        variant: "destructive"
      });
      setIsLoading(false);
      return;
    }
    setServiceLogs(logs || []);

    // Check for existing invoice
    const {
      data: existingInv
    } = await supabase.from("invoices").select("*").eq("client_id", clientId).eq("invoice_month", month).eq("invoice_year", year).maybeSingle();
    setExistingInvoice(existingInv);

    // Generate temp invoice number for preview
    if (!existingInv) {
      setTempInvoiceNumber(`INV-XXXXX (auto-generated on save)`);
    }
    setShowPreview(true);
    setIsLoading(false);

    // Clear URL params after auto-generation
    if (searchParams.get("autoGenerate")) {
      setSearchParams({}, {
        replace: true
      });
    }
  }, [selectedClientId, selectedMonth, selectedYear, searchParams, setSearchParams, toast]);

  // Auto-generate preview when navigating from Service Calendar
  useEffect(() => {
    const shouldAutoGenerate = searchParams.get("autoGenerate") === "true";
    const clientId = searchParams.get("client");
    if (shouldAutoGenerate && clientId && clients.length > 0 && !autoGenerateTriggered.current) {
      autoGenerateTriggered.current = true;
      handleGeneratePreview(clientId);
    }
  }, [searchParams, clients, handleGeneratePreview]);
  const handleSaveDraft = async (subtotal: number, total: number) => {
    if (!selectedClientId) return;
    setIsLoading(true);
    const month = parseInt(selectedMonth);
    const year = parseInt(selectedYear);
    try {
      if (existingInvoice) {
        // Update existing
        const {
          error
        } = await supabase.from("invoices").update({
          subtotal,
          total
        }).eq("id", existingInvoice.id);
        if (error) throw error;
        toast({
          title: "Invoice updated"
        });
      } else {
        // Create new - invoice_number is auto-generated by trigger
        const {
          data,
          error
        } = await supabase.from("invoices").insert([{
          invoice_number: "",
          // Will be auto-generated by trigger
          client_id: selectedClientId,
          invoice_month: month,
          invoice_year: year,
          subtotal,
          total,
          issue_date: format(new Date(), "yyyy-MM-dd")
        }]).select().single();
        if (error) throw error;
        setExistingInvoice(data);
        toast({
          title: "Invoice saved as draft"
        });

        // Clear service logs after invoice is created (invoice captured the totals)
        const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
        const endDate = new Date(year, month, 0).toISOString().split("T")[0];
        await supabase
          .from("service_logs")
          .delete()
          .eq("client_id", selectedClientId)
          .gte("service_date", startDate)
          .lte("service_date", endDate);
        
        setServiceLogs([]);
      }
      fetchInvoices();
    } catch (error: any) {
      toast({
        title: "Error saving invoice",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  const handleMarkSent = async () => {
    if (!existingInvoice) return;
    setIsLoading(true);
    try {
      const {
        error
      } = await supabase.from("invoices").update({
        status: "sent"
      }).eq("id", existingInvoice.id);
      if (error) throw error;
      setExistingInvoice({
        ...existingInvoice,
        status: "sent"
      });
      toast({
        title: "Invoice marked as sent"
      });
      fetchInvoices();
    } catch (error: any) {
      toast({
        title: "Error updating invoice",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  const handleMarkPaid = async () => {
    if (!existingInvoice) return;
    setIsLoading(true);
    try {
      const {
        error
      } = await supabase.from("invoices").update({
        status: "paid"
      }).eq("id", existingInvoice.id);
      if (error) throw error;
      setExistingInvoice({
        ...existingInvoice,
        status: "paid"
      });
      toast({
        title: "Invoice marked as paid"
      });
      fetchInvoices();
    } catch (error: any) {
      toast({
        title: "Error updating invoice",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  const handleViewInvoice = async (invoice: Invoice) => {
    setSelectedClientId(invoice.client_id);
    setSelectedMonth(String(invoice.invoice_month));
    setSelectedYear(String(invoice.invoice_year));

    // Generate preview directly with invoice data
    setIsLoading(true);
    const month = invoice.invoice_month;
    const year = invoice.invoice_year;

    // Fetch service logs for the invoice period
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate = new Date(year, month, 0).toISOString().split("T")[0];
    const {
      data: logs,
      error: logsError
    } = await supabase.from("service_logs").select("*").eq("client_id", invoice.client_id).gte("service_date", startDate).lte("service_date", endDate).order("service_date");
    if (logsError) {
      toast({
        title: "Error fetching service logs",
        description: logsError.message,
        variant: "destructive"
      });
      setIsLoading(false);
      return;
    }
    setServiceLogs(logs || []);
    setExistingInvoice(invoice);
    setShowPreview(true);
    setIsLoading(false);
  };
  const handleDeleteClient = async () => {
    if (!deleteClientId) return;
    setIsLoading(true);
    try {
      const {
        error
      } = await supabase.from("clients").delete().eq("id", deleteClientId);
      if (error) throw error;
      toast({
        title: "Client deleted successfully"
      });
      setSelectedClientId("");
      setShowPreview(false);
      fetchClients();
      fetchInvoices();
    } catch (error: any) {
      toast({
        title: "Error deleting client",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
      setDeleteClientId(null);
    }
  };
  const handleDeleteInvoice = async () => {
    if (!deleteInvoiceId) return;
    setIsLoading(true);
    try {
      const {
        error
      } = await supabase.from("invoices").delete().eq("id", deleteInvoiceId);
      if (error) throw error;
      toast({
        title: "Invoice deleted successfully"
      });
      setShowPreview(false);
      setExistingInvoice(null);
      fetchInvoices();
    } catch (error: any) {
      toast({
        title: "Error deleting invoice",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
      setDeleteInvoiceId(null);
    }
  };
  const selectedClient = clients.find(c => c.id === selectedClientId);
  const clientToDelete = clients.find(c => c.id === deleteClientId);
  const invoiceToDelete = invoices.find(inv => inv.id === deleteInvoiceId);
  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD"
    }).format(amount);
  };
  return <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-background border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/admin/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Dashboard
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              <h1 className="text-xl font-semibold">Invoices</h1>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={signOut}>
            Log out
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Controls */}
        <div className="bg-background rounded-lg border shadow-sm p-6">
          <h2 className="font-semibold mb-4">Generate Invoice</h2>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
            <div className="flex-1 max-w-xs">
              <label className="text-sm text-muted-foreground mb-1 block">​Partner Name
 </label>
              <div className="flex items-center gap-2">
                <Select value={selectedClientId} onValueChange={v => {
                setSelectedClientId(v);
                setShowPreview(false);
              }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map(client => <SelectItem key={client.id} value={client.id}>
                        {client.client_name}
                      </SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" onClick={() => setShowClientDialog(true)} className="shrink-0" title="Add new client">
                  <Plus className="w-4 h-4" />
                </Button>
                {selectedClientId && <>
                    <Button variant="ghost" size="icon" onClick={() => {
                  const client = clients.find(c => c.id === selectedClientId);
                  setEditingClient(client || null);
                  setShowClientDialog(true);
                }} className="shrink-0" title="Edit client">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteClientId(selectedClientId)} className="shrink-0 text-destructive hover:text-destructive" title="Delete client">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </>}
              </div>
            </div>
            <div className="w-40">
              <label className="text-sm text-muted-foreground mb-1 block">Month</label>
              <Select value={selectedMonth} onValueChange={v => {
              setSelectedMonth(v);
              setShowPreview(false);
            }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map(m => <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="w-32">
              <label className="text-sm text-muted-foreground mb-1 block">Year</label>
              <Select value={selectedYear} onValueChange={v => {
              setSelectedYear(v);
              setShowPreview(false);
            }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map(y => <SelectItem key={y.value} value={y.value}>
                      {y.label}
                    </SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {selectedClientId && <Link to={`/admin/service-calendar?client=${selectedClientId}&month=${selectedMonth}&year=${selectedYear}`}>
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                  <CalendarDays className="w-4 h-4 mr-2" />
                  Add / View Service Days
                </Button>
              </Link>}
          </div>
        </div>

        {/* Invoice Preview */}
        {showPreview && selectedClient && <InvoicePreview client={selectedClient} serviceLogs={serviceLogs} invoiceNumber={existingInvoice?.invoice_number || tempInvoiceNumber} issueDate={existingInvoice?.issue_date ? new Date(existingInvoice.issue_date) : new Date()} month={parseInt(selectedMonth)} year={parseInt(selectedYear)} existingInvoice={existingInvoice} onSaveDraft={handleSaveDraft} onMarkSent={handleMarkSent} onMarkPaid={handleMarkPaid} onInvoiceUpdated={() => {
        handleGeneratePreview();
        fetchInvoices();
      }} isLoading={isLoading} />}

        {/* Saved Invoices List */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-4 grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="all" className="gap-2">
              <FileText className="w-4 h-4" />
              All Invoices
            </TabsTrigger>
            <TabsTrigger value="sent" className="gap-2">
              <Mail className="w-4 h-4" />
              Sent History
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="all">
            <div className="bg-background rounded-lg border shadow-sm">
              <div className="p-4 border-b">
                <h2 className="font-semibold">Saved Invoices</h2>
              </div>
              {invoices.length === 0 ? <div className="p-8 text-center text-muted-foreground">
                  No invoices yet. Generate and save your first invoice above.
                </div> : <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map(invoice => <TableRow key={invoice.id}>
                        <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                        <TableCell>{invoice.client_name}</TableCell>
                        <TableCell>
                          {MONTHS.find(m => m.value === String(invoice.invoice_month))?.label}{" "}
                          {invoice.invoice_year}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[invoice.status]}>
                            {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(invoice.total)}</TableCell>
                        <TableCell>{format(new Date(invoice.created_at), "MMM d, yyyy")}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => handleViewInvoice(invoice)} title="View invoice">
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setDeleteInvoiceId(invoice.id)} className="text-destructive hover:text-destructive" title="Delete invoice">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>)}
                  </TableBody>
                </Table>}
            </div>
          </TabsContent>
          
          <TabsContent value="sent">
            <div className="bg-background rounded-lg border shadow-sm">
              <div className="p-4 border-b">
                <h2 className="font-semibold">Sent Invoice History</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  View all invoices that have been emailed to partners
                </p>
              </div>
              <SentInvoicesTable invoices={invoices} />
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Add/Edit Client Modal */}
      <ClientFormDialog open={showClientDialog} onOpenChange={open => {
      setShowClientDialog(open);
      if (!open) setEditingClient(null);
    }} client={editingClient} onSuccess={fetchClients} />

      {/* Delete Client Confirmation */}
      <AlertDialog open={!!deleteClientId} onOpenChange={open => !open && setDeleteClientId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Client</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{clientToDelete?.client_name}"? This will also delete all associated invoices and service logs. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteClient} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Yes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Invoice Confirmation */}
      <AlertDialog open={!!deleteInvoiceId} onOpenChange={open => !open && setDeleteInvoiceId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete invoice "{invoiceToDelete?.invoice_number}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteInvoice} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Yes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>;
}