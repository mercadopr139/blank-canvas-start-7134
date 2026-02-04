import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ScrollToTop from "./components/ScrollToTop";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/admin/ProtectedRoute";
import Index from "./pages/Index";
import Programs from "./pages/Programs";
import GymBuddies from "./pages/GymBuddies";
import MealTrain from "./pages/MealTrain";
import OurStory from "./pages/OurStory";
import ImpactStory from "./pages/ImpactStory";
import Vision from "./pages/Vision";
import AdminIndex from "./pages/admin/AdminIndex";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminClients from "./pages/admin/AdminClients";
import AdminServiceCalendar from "./pages/admin/AdminServiceCalendar";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Index />} />
            <Route path="/programs" element={<Programs />} />
            <Route path="/gym-buddies" element={<GymBuddies />} />
            <Route path="/meal-train" element={<MealTrain />} />
            <Route path="/our-story" element={<OurStory />} />
            <Route path="/impact" element={<ImpactStory />} />
            <Route path="/vision" element={<Vision />} />
            
            {/* Admin Routes */}
            <Route path="/admin" element={<AdminIndex />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/clients"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminClients />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/service-calendar"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminServiceCalendar />
                </ProtectedRoute>
              }
            />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
