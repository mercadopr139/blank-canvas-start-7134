import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { FileText, Download, Trash2 } from "lucide-react";
import jsPDF from "jspdf";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const FROM = {
  name: "No Limits Academy Inc.",
  address: "301 N Vineyard Court, Cape May NJ 08210",
  email: "joshmercado@nolimitsboxingacademy.org",
};
const BILL_TO = {
  name: "O.C.E.A.N. Inc",
  address: "PO Box 1029, Toms River NJ 08755",
  contact: "Darrell Barron",
  email: "rfp@oceaninc.org",
};
const CERT = "I certify that the expenditures are true, accurate, allowable, and allocable under the CSBG grant.";

const AdminCSBGInvoice = () => {
  const qc = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(currentYear);
  const [amount, setAmount] = useState("");
  const [certified, setCertified] = useState(false);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["csbg-invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("csbg_invoices")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const nextNumber = `NLA-${String((invoices.length || 0) + 1).padStart(3, "0")}`;

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("csbg_invoices").insert({
        invoice_number: nextNumber,
        service_month: month,
        service_year: year,
        reimbursement_total: parseFloat(amount),
        certified,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["csbg-invoices"] });
      toast.success("Invoice created");
      setAmount("");
      setCertified(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("csbg_invoices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["csbg-invoices"] });
      toast.success("Invoice deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const generatePdf = (inv: any) => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("INVOICE", 105, 20, { align: "center" });

    doc.setFontSize(10);
    doc.text("FROM:", 14, 35);
    doc.setFontSize(9);
    doc.text(FROM.name, 14, 41);
    doc.text(FROM.address, 14, 46);
    doc.text(FROM.email, 14, 51);

    doc.setFontSize(10);
    doc.text("BILL TO:", 120, 35);
    doc.setFontSize(9);
    doc.text(BILL_TO.name, 120, 41);
    doc.text(BILL_TO.address, 120, 46);
    doc.text(`Attn: ${BILL_TO.contact}`, 120, 51);
    doc.text(BILL_TO.email, 120, 56);

    doc.setFontSize(10);
    doc.text(`Invoice #: ${inv.invoice_number}`, 14, 70);
    doc.text(`Service Month: ${MONTHS[inv.service_month - 1]} ${inv.service_year}`, 14, 76);
    doc.text(`Date: ${new Date(inv.created_at).toLocaleDateString()}`, 14, 82);

    doc.setFillColor(30, 30, 30);
    doc.rect(14, 92, 182, 10, "F");
    doc.setTextColor(255);
    doc.text("Description", 16, 99);
    doc.text("Amount", 170, 99, { align: "right" });
    doc.setTextColor(0);

    doc.text(`CSBG Grant Reimbursement – ${MONTHS[inv.service_month - 1]} ${inv.service_year}`, 16, 112);
    doc.text(`$${Number(inv.reimbursement_total).toLocaleString("en-US", { minimumFractionDigits: 2 })}`, 170, 112, { align: "right" });

    doc.line(14, 120, 196, 120);
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL:", 130, 128);
    doc.text(`$${Number(inv.reimbursement_total).toLocaleString("en-US", { minimumFractionDigits: 2 })}`, 170, 128, { align: "right" });
    doc.setFont("helvetica", "normal");

    doc.setFontSize(8);
    const certLines = doc.splitTextToSize(CERT, 170);
    doc.text(certLines, 14, 145);

    doc.save(`${inv.invoice_number}.pdf`);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-full">
      <div className="border-b border-white/10 pb-3">
        <h2 className="text-lg font-semibold">CSBG Invoice Generator</h2>
        <p className="text-xs text-white/50">Generate monthly reimbursement invoices for O.C.E.A.N. Inc.</p>
      </div>

      <Card className="bg-white/5 border-white/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-white">Create New Invoice</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label className="text-white/70 text-xs">Invoice #</Label>
              <Input value={nextNumber} disabled className="bg-white/5 border-white/10 text-white" />
            </div>
            <div>
              <Label className="text-white/70 text-xs">Service Month</Label>
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-white/70 text-xs">Year</Label>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                <SelectContent>{[currentYear - 1, currentYear, currentYear + 1].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-white/70 text-xs">Reimbursement Total ($)</Label>
            <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="bg-white/5 border-white/10 text-white max-w-xs" />
          </div>
          <div className="flex items-start gap-2">
            <Checkbox id="cert" checked={certified} onCheckedChange={(v) => setCertified(!!v)} />
            <label htmlFor="cert" className="text-xs text-white/70 leading-tight">{CERT}</label>
          </div>
          <Button onClick={() => createMutation.mutate()} disabled={!amount || !certified || createMutation.isPending} className="bg-sky-600 hover:bg-sky-500">
            <FileText className="w-4 h-4 mr-2" /> Generate Invoice
          </Button>
        </CardContent>
      </Card>

      <div>
        <h3 className="text-sm font-medium text-white/70 mb-3">Invoice History</h3>
        {isLoading ? <p className="text-white/40 text-sm">Loading…</p> : invoices.length === 0 ? <p className="text-white/40 text-sm">No invoices yet.</p> : (
          <div className="space-y-2">
            {invoices.map((inv: any) => (
              <div key={inv.id} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-white">{inv.invoice_number}</p>
                  <p className="text-xs text-white/50">{MONTHS[inv.service_month - 1]} {inv.service_year} · ${Number(inv.reimbursement_total).toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => generatePdf(inv)} className="border-sky-300/50 text-sky-300 hover:bg-sky-300/10">
                  <Download className="w-3.5 h-3.5 mr-1" /> PDF
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminCSBGInvoice;
