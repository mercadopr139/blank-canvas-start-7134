 import { useNavigate } from "react-router-dom";
 import { Button } from "@/components/ui/button";
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
 import { FileText, Mail, ArrowLeft } from "lucide-react";
 
 const AdminFinance = () => {
   const navigate = useNavigate();
 
   const tiles = [
     {
       title: "Invoices",
       description: "Track billing and payments",
       icon: FileText,
       color: "bg-amber-500/10 text-amber-500",
       href: "/admin/invoices",
     },
     {
       title: "Sent History",
       description: "View emailed invoices",
       icon: Mail,
       color: "bg-cyan-500/10 text-cyan-500",
       href: "/admin/invoices?tab=sent",
     },
   ];
 
   return (
     <div className="min-h-screen bg-muted/30">
       <header className="bg-background border-b border-border">
         <div className="container mx-auto px-4 py-4 flex items-center gap-4">
           <Button variant="ghost" size="icon" onClick={() => navigate("/admin/dashboard")}>
             <ArrowLeft className="w-5 h-5" />
           </Button>
           <div>
             <h1 className="text-xl font-bold text-foreground">Finance</h1>
             <p className="text-sm text-muted-foreground">Manage invoices and payments</p>
           </div>
         </div>
       </header>
 
       <main className="container mx-auto px-4 py-8">
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
           {tiles.map((tile) => (
             <Card
               key={tile.title}
               className="cursor-pointer hover:shadow-md transition-shadow"
               onClick={() => navigate(tile.href)}
             >
               <CardHeader>
                 <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${tile.color} mb-2`}>
                   <tile.icon className="w-6 h-6" />
                 </div>
                 <CardTitle className="text-lg">{tile.title}</CardTitle>
                 <CardDescription>{tile.description}</CardDescription>
               </CardHeader>
               <CardContent>
                 <p className="text-sm text-primary">Manage →</p>
               </CardContent>
             </Card>
           ))}
         </div>
       </main>
     </div>
   );
 };
 
 export default AdminFinance;