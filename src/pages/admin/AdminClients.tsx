import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import ClientFormDialog from "@/components/admin/ClientFormDialog";
import { ArrowLeft, Plus, Pencil, Trash2, Search, Users } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Client = Tables<"clients">;

const rateTypeLabels: Record<string, string> = {
  per_day: "Per Day",
  per_session: "Per Session",
  per_hour: "Per Hour",
  flat_monthly: "Flat Monthly",
};

export default function AdminClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deleteClient, setDeleteClient] = useState<Client | null>(null);
  const { toast } = useToast();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const goBack = () => window.history.state?.idx > 0 ? navigate(-1) : navigate("/admin/finance");
  const fetchClients = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .order("client_name", { ascending: true });

    if (error) {
      toast({ title: "Error fetching clients", description: error.message, variant: "destructive" });
    } else {
      setClients(data || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchClients(); }, []);

  const handleEdit = (client: Client) => { setEditingClient(client); setDialogOpen(true); };
  const handleAdd = () => { setEditingClient(null); setDialogOpen(true); };

  const handleDelete = async () => {
    if (!deleteClient) return;
    const { error } = await supabase.from("clients").delete().eq("id", deleteClient.id);
    if (error) {
      toast({ title: "Error deleting client", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Client deleted successfully" });
      fetchClients();
    }
    setDeleteClient(null);
  };

  const filteredClients = clients.filter((client) =>
    client.client_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return "—";
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="bg-black border-b border-white/10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={goBack} className="text-white hover:bg-white/10 hover:text-white">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-sky-300" />
              <h1 className="text-xl font-semibold text-white">Clients</h1>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={signOut} className="border-white/10 text-white hover:bg-white/10 hover:text-white">
            Log out
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row gap-4 mb-6 justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
            <Input
              placeholder="Search clients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/30"
            />
          </div>
          <Button onClick={handleAdd}>
            <Plus className="w-4 h-4 mr-2" />
            Add Client
          </Button>
        </div>

        <div className="bg-white/5 rounded-lg border border-white/10 shadow-sm">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-300 mx-auto"></div>
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="p-8 text-center text-white/50">
              {searchQuery ? "No clients found matching your search." : "No clients yet. Add your first client to get started."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-white/5">
                  <TableHead className="text-white/70">Partner</TableHead>
                  <TableHead className="text-white/70">Billing Email</TableHead>
                  <TableHead className="text-white/70">Rate Type</TableHead>
                  <TableHead className="text-white/70">Rate Amount</TableHead>
                  <TableHead className="text-right text-white/70">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.map((client) => (
                  <TableRow key={client.id} className="border-white/10 hover:bg-white/5">
                    <TableCell className="font-medium text-white">{client.client_name}</TableCell>
                    <TableCell className="text-white/70">{client.billing_email || "—"}</TableCell>
                    <TableCell className="text-white/70">
                      {client.rate_type ? rateTypeLabels[client.rate_type] : "—"}
                    </TableCell>
                    <TableCell className="text-white">{formatCurrency(client.rate_amount)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(client)} className="text-white hover:bg-white/10 hover:text-white">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteClient(client)} className="hover:bg-white/10">
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </main>

      <ClientFormDialog open={dialogOpen} onOpenChange={setDialogOpen} client={editingClient} onSuccess={fetchClients} />

      <AlertDialog open={!!deleteClient} onOpenChange={() => setDeleteClient(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Client</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteClient?.client_name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
