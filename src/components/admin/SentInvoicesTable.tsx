 import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
 import { Badge } from "@/components/ui/badge";
 import { format } from "date-fns";
 import { Mail, CheckCircle, Clock } from "lucide-react";
 import type { Tables } from "@/integrations/supabase/types";
 
 type Invoice = Tables<"invoices">;
 
 interface SentInvoice extends Invoice {
   client_name?: string;
 }
 
 interface SentInvoicesTableProps {
   invoices: SentInvoice[];
 }
 
 export default function SentInvoicesTable({ invoices }: SentInvoicesTableProps) {
   // Filter to only show sent or paid invoices
   const sentInvoices = invoices.filter(inv => inv.status === "sent" || inv.status === "paid");
 
   const formatDateTime = (dateStr: string | null) => {
     if (!dateStr) return "—";
     return format(new Date(dateStr), "MMM d, yyyy 'at' h:mm a");
   };
 
   if (sentInvoices.length === 0) {
     return (
       <div className="p-12 text-center">
         <Mail className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
         <h3 className="font-medium text-lg mb-1">No sent invoices yet</h3>
         <p className="text-muted-foreground text-sm">
           When you send invoices via email, they'll appear here for easy tracking.
         </p>
       </div>
     );
   }
 
   return (
     <Table>
       <TableHeader>
         <TableRow>
           <TableHead>Invoice #</TableHead>
           <TableHead>Partner</TableHead>
           <TableHead>Sent To</TableHead>
           <TableHead>Sent At</TableHead>
           <TableHead>Status</TableHead>
         </TableRow>
       </TableHeader>
       <TableBody>
         {sentInvoices.map((invoice) => (
           <TableRow key={invoice.id}>
             <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
             <TableCell>{invoice.client_name || "—"}</TableCell>
             <TableCell>
               <span className="text-sm">{invoice.sent_to || "—"}</span>
             </TableCell>
             <TableCell>
               <span className="text-sm">{formatDateTime(invoice.sent_at)}</span>
             </TableCell>
             <TableCell>
               {invoice.status === "paid" ? (
                 <Badge className="bg-green-500/10 text-green-600">
                   <CheckCircle className="w-3 h-3 mr-1" />
                   Paid
                 </Badge>
               ) : invoice.sent_at ? (
                 <Badge className="bg-blue-500/10 text-blue-600">
                   <Mail className="w-3 h-3 mr-1" />
                   Email Sent
                 </Badge>
               ) : (
                 <Badge className="bg-amber-500/10 text-amber-600">
                   <Clock className="w-3 h-3 mr-1" />
                   Marked Sent
                 </Badge>
               )}
             </TableCell>
           </TableRow>
         ))}
       </TableBody>
     </Table>
   );
 }