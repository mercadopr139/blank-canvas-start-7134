import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Send } from "lucide-react";

const FULL_MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const AdminCSBGSubmissions = () => {
  const qc = useQueryClient();
  const now = new Date();
  const [invoiceNum, setInvoiceNum] = useState("");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [subDate, setSubDate] = useState(new Date().toISOString().split("T")[0]);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Email");
  const [notes, setNotes] = useState("");
  const [showForm, setShowForm] = useState(false);

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ["csbg-submissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("csbg_submissions")
        .select("*")
        .order("submission_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("csbg_submissions").insert({
        invoice_number: invoiceNum,
        service_month: month,
        service_year: year,
        submission_date: subDate,
        total_amount: parseFloat(amount),
        method,
        notes: notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["csbg-submissions"] });
      toast.success("Submission logged");
      setInvoiceNum(""); setAmount(""); setNotes(""); setShowForm(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-full">
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div>
          <h2 className="text-lg font-semibold">Submission Log</h2>
          <p className="text-xs text-white/50">History of all CSBG reimbursement submissions</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)} className="bg-sky-600 hover:bg-sky-500">
          <Plus className="w-4 h-4 mr-1" /> Log Submission
        </Button>
      </div>

      {showForm && (
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-white">New Submission</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-white/70 text-xs">Invoice #</Label>
                <Input value={invoiceNum} onChange={(e) => setInvoiceNum(e.target.value)} placeholder="NLA-001" className="bg-white/5 border-white/10 text-white" />
              </div>
              <div>
                <Label className="text-white/70 text-xs">Submission Date</Label>
                <Input type="date" value={subDate} onChange={(e) => setSubDate(e.target.value)} className="bg-white/5 border-white/10 text-white" />
              </div>
              <div>
                <Label className="text-white/70 text-xs">Service Month</Label>
                <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent>{FULL_MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-white/70 text-xs">Year</Label>
                <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent>{[year - 1, year, year + 1].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-white/70 text-xs">Total Amount ($)</Label>
                <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="bg-white/5 border-white/10 text-white" />
              </div>
              <div>
                <Label className="text-white/70 text-xs">Method</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Email">Email</SelectItem>
                    <SelectItem value="Mail">Mail</SelectItem>
                    <SelectItem value="Portal">Portal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-white/70 text-xs">Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="bg-white/5 border-white/10 text-white text-sm" placeholder="Optional notes…" />
            </div>
            <Button onClick={() => createMutation.mutate()} disabled={!invoiceNum || !amount || createMutation.isPending} className="bg-sky-600 hover:bg-sky-500">
              <Send className="w-4 h-4 mr-2" /> Log Submission
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? <p className="text-white/40 text-sm">Loading…</p> : submissions.length === 0 ? <p className="text-white/40 text-sm">No submissions logged yet.</p> : (
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10">
                <TableHead className="text-white/50">Invoice #</TableHead>
                <TableHead className="text-white/50">Service Month</TableHead>
                <TableHead className="text-white/50">Submitted</TableHead>
                <TableHead className="text-white/50 text-right">Amount</TableHead>
                <TableHead className="text-white/50">Method</TableHead>
                <TableHead className="text-white/50">Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions.map((s: any) => (
                <TableRow key={s.id} className="border-white/5">
                  <TableCell className="text-white font-medium text-sm">{s.invoice_number}</TableCell>
                  <TableCell className="text-white/70 text-sm">{FULL_MONTHS[s.service_month - 1]} {s.service_year}</TableCell>
                  <TableCell className="text-white/70 text-sm">{new Date(s.submission_date).toLocaleDateString()}</TableCell>
                  <TableCell className="text-white text-right text-sm">${Number(s.total_amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-white/70 text-sm">{s.method}</TableCell>
                  <TableCell className="text-white/50 text-xs max-w-[150px] truncate">{s.notes || "–"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default AdminCSBGSubmissions;
