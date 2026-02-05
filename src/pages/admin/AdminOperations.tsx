 import { useNavigate } from "react-router-dom";
 import { Button } from "@/components/ui/button";
 import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Users, BarChart3, ClipboardList, LucideIcon } from "lucide-react";

interface OperationsTile {
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
  href: string;
  external?: boolean;
}

const tiles: OperationsTile[] = [
  {
    title: "Registration Form",
    description: "Public youth registration form",
    icon: ClipboardList,
    color: "bg-green-100 text-green-600",
    href: "/register",
    external: true,
  },
  {
    title: "Registrations",
    description: "View and manage youth registrations",
    icon: Users,
    color: "bg-primary/10 text-primary",
    href: "/admin/operations/registrations",
  },
  {
    title: "Registration Analytics",
    description: "Charts and insights from registrations",
    icon: BarChart3,
    color: "bg-primary/10 text-primary",
    href: "/admin/operations/registration-analytics",
  },
];
 
 const AdminOperations = () => {
   const navigate = useNavigate();
 
   return (
     <div className="min-h-screen bg-muted/30">
       <header className="bg-background border-b border-border">
         <div className="container mx-auto px-4 py-4 flex items-center gap-4">
           <Button variant="ghost" size="icon" onClick={() => navigate("/admin/dashboard")}>
             <ArrowLeft className="w-5 h-5" />
           </Button>
           <div>
             <h1 className="text-xl font-bold text-foreground">Operations</h1>
             <p className="text-sm text-muted-foreground">Manage registrations and schedules</p>
           </div>
         </div>
       </header>
 
       <main className="container mx-auto px-4 py-8">
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {tiles.map((tile) => (
              <Card
                key={tile.title}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => tile.external ? window.open(tile.href, '_blank') : navigate(tile.href)}
              >
               <CardContent className="pt-6">
                 <div className="flex items-start gap-4">
                   <div className={`p-3 rounded-lg ${tile.color}`}>
                     <tile.icon className="w-6 h-6" />
                   </div>
                   <div>
                     <h3 className="font-semibold text-foreground">{tile.title}</h3>
                     <p className="text-sm text-muted-foreground mt-1">{tile.description}</p>
                   </div>
                 </div>
               </CardContent>
             </Card>
           ))}
         </div>
       </main>
     </div>
   );
 };
 
 export default AdminOperations;