import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calendar, FileText, Settings, LogOut } from "lucide-react";

const AdminDashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate("/admin/login", { replace: true });
  };

  const tiles = [
    {
      title: "Clients",
      description: "Manage client information",
      icon: Users,
      color: "bg-blue-500/10 text-blue-500",
      href: "/admin/clients",
    },
    {
      title: "Service Calendar",
      description: "View and manage schedules",
      icon: Calendar,
      color: "bg-green-500/10 text-green-500",
      href: "/admin/service-calendar",
    },
    {
      title: "Invoices",
      description: "Track billing and payments",
      icon: FileText,
      color: "bg-amber-500/10 text-amber-500",
      href: null,
    },
    {
      title: "Settings",
      description: "Configure admin preferences",
      icon: Settings,
      color: "bg-purple-500/10 text-purple-500",
      href: null,
    },
  ];

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-background border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Log out
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {tiles.map((tile) => {
            const content = (
              <Card
                key={tile.title}
                className={`${tile.href ? "cursor-pointer hover:shadow-md" : "opacity-75"} transition-shadow`}
              >
                <CardHeader>
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${tile.color} mb-2`}>
                    <tile.icon className="w-6 h-6" />
                  </div>
                  <CardTitle className="text-lg">{tile.title}</CardTitle>
                  <CardDescription>{tile.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  {tile.href ? (
                    <p className="text-sm text-primary">Manage →</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Coming soon</p>
                  )}
                </CardContent>
              </Card>
            );

            return tile.href ? (
              <div key={tile.title} onClick={() => navigate(tile.href!)}>
                {content}
              </div>
            ) : (
              <div key={tile.title}>{content}</div>
            );
          })}
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
