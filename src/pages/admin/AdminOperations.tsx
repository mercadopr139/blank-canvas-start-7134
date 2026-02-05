 import { useNavigate } from "react-router-dom";
 import { Button } from "@/components/ui/button";
import { ArrowLeft, Briefcase } from "lucide-react";
 
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
             <p className="text-sm text-muted-foreground">Manage clients and schedules</p>
           </div>
         </div>
       </header>
 
       <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mb-4">
            <Briefcase className="w-8 h-8 text-blue-500" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-2">Coming Soon</h2>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            Operations tools will be available here soon.
          </p>
         </div>
       </main>
     </div>
   );
 };
 
 export default AdminOperations;