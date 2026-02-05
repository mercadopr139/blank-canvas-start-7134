import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calendar, FileText, Settings, LogOut, Mail, Briefcase, TrendingUp, DollarSign } from "lucide-react";

const AdminDashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate("/admin/login", { replace: true });
  };

  const operationsTiles = [
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
  ];

  const financeTiles = [
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

  const settingsTile = {
    title: "Settings",
    description: "Configure admin preferences",
    icon: Settings,
    color: "bg-purple-500/10 text-purple-500",
    href: null,
  };

  const renderTile = (tile: typeof operationsTiles[0]) => {
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
  };

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
      <main className="container mx-auto px-4 py-8 space-y-10">
        {/* Operations Section */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-blue-500" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">Operations</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {operationsTiles.map(renderTile)}
          </div>
        </section>

        {/* Sales & Marketing Section */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-pink-500/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-pink-500" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">Sales & Marketing</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="border border-dashed border-muted-foreground/30 rounded-lg p-6 flex items-center justify-center min-h-[180px]">
              <p className="text-sm text-muted-foreground">Coming soon</p>
            </div>
          </div>
        </section>

        {/* Finance Section */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-amber-500" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">Finance</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {financeTiles.map(renderTile)}
          </div>
        </section>

        {/* Settings - Standalone */}
        <div className="pt-4 border-t border-border">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {renderTile(settingsTile)}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
