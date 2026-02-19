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
import RookieOrientation from "./pages/RookieOrientation";
import HouseRulesTest from "./pages/HouseRulesTest";
import AdminIndex from "./pages/admin/AdminIndex";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminOperations from "./pages/admin/AdminOperations";
import AdminSalesMarketing from "./pages/admin/AdminSalesMarketing";
import AdminFinance from "./pages/admin/AdminFinance";
import AdminClients from "./pages/admin/AdminClients";
import AdminServiceCalendar from "./pages/admin/AdminServiceCalendar";
import AdminInvoices from "./pages/admin/AdminInvoices";
 import AdminRegistrations from "./pages/admin/AdminRegistrations";
 import AdminBilling from "./pages/admin/AdminBilling";
 import AdminRegistrationAnalytics from "./pages/admin/AdminRegistrationAnalytics";
import Register from "./pages/Register";
import Supporters from "./pages/Supporters";
import AdminDonations from "./pages/admin/AdminDonations";
import AdminDeposits from "./pages/admin/AdminDeposits";
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
            <Route path="/rookie-orientation" element={<RookieOrientation />} />
            <Route path="/house-rules-test" element={<HouseRulesTest />} />
             <Route path="/register" element={<Register />} />
            <Route path="/supporters" element={<Supporters />} />
            
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
              path="/admin/operations"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminOperations />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/sales-marketing"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminSalesMarketing />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/finance"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminFinance />
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
            <Route
              path="/admin/invoices"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminInvoices />
                </ProtectedRoute>
              }
            />
             <Route
               path="/admin/operations/registrations"
               element={
                 <ProtectedRoute requireAdmin>
                   <AdminRegistrations />
                 </ProtectedRoute>
               }
             />
             <Route
               path="/admin/operations/registration-analytics"
               element={
                 <ProtectedRoute requireAdmin>
                   <AdminRegistrationAnalytics />
                 </ProtectedRoute>
               }
             />
             <Route
               path="/admin/finance/billing"
               element={
                 <ProtectedRoute requireAdmin>
                   <AdminBilling />
                 </ProtectedRoute>
               }
             />
             <Route
               path="/admin/finance/donations"
               element={
                 <ProtectedRoute requireAdmin>
                   <AdminDonations />
                 </ProtectedRoute>
               }
             />
             <Route
               path="/admin/finance/deposits"
               element={
                 <ProtectedRoute requireAdmin>
                   <AdminDeposits />
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
