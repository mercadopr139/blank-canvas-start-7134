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
import AdminOperations, { AdminOperationsIndex } from "./pages/admin/AdminOperations";
import AdminSalesMarketing, { AdminSalesMarketingIndex } from "./pages/admin/AdminSalesMarketing";
import AdminFinance, { AdminFinanceIndex } from "./pages/admin/AdminFinance";
import AdminClients from "./pages/admin/AdminClients";
import AdminServiceCalendar from "./pages/admin/AdminServiceCalendar";
import AdminInvoices from "./pages/admin/AdminInvoices";
 import AdminRegistrations from "./pages/admin/AdminRegistrations";
 import AdminBilling from "./pages/admin/AdminBilling";
 import AdminRegistrationAnalytics from "./pages/admin/AdminRegistrationAnalytics";
import Register from "./pages/Register";
import Supporters from "./pages/Supporters";
import AdminDonations from "./pages/admin/AdminDonations";
import AdminRevenue from "./pages/admin/AdminRevenue";
import AdminDeposits from "./pages/admin/AdminDeposits";
import AdminDepositDetail from "./pages/admin/AdminDepositDetail";
import AdminMasterRevenueTracker from "./pages/admin/AdminMasterRevenueTracker";
import AdminSupporters from "./pages/admin/AdminSupporters";
import AdminSupportersDatabase from "./pages/admin/AdminSupportersDatabase";
import AdminSupporterDetail from "./pages/admin/AdminSupporterDetail";
import AdminEngagements from "./pages/admin/AdminEngagements";
import AdminTasks from "./pages/admin/AdminTasks";
import AdminBulkOutreach from "./pages/admin/AdminBulkOutreach";
import AdminSignals from "./pages/admin/AdminSignals";
import AdminSignalsArchive from "./pages/admin/AdminSignalsArchive";
import AdminSignalsTrash from "./pages/admin/AdminSignalsTrash";
import InvoiceApproval from "./pages/InvoiceApproval";
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
            <Route path="/approvals/invoice/:token" element={<InvoiceApproval />} />
            
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
            {/* Operations section — sidebar layout wraps sub-pages */}
            <Route
              path="/admin/operations"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminOperations />
                </ProtectedRoute>
              }
            >
              <Route index element={<AdminOperationsIndex />} />
              <Route path="registrations" element={<AdminRegistrations />} />
              <Route path="registration-analytics" element={<AdminRegistrationAnalytics />} />
            </Route>

            {/* Sales & Marketing section — sidebar layout wraps sub-pages */}
            <Route
              path="/admin/sales-marketing"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminSalesMarketing />
                </ProtectedRoute>
              }
            >
              <Route index element={<AdminSalesMarketingIndex />} />
              <Route path="revenue" element={<AdminRevenue />} />
              <Route path="master-revenue-tracker" element={<AdminMasterRevenueTracker />} />
              <Route path="supporters/:id" element={<AdminSupporterDetail />} />
              <Route path="supporters-database" element={<AdminSupportersDatabase />} />
              <Route path="engagements" element={<AdminEngagements />} />
              <Route path="tasks" element={<AdminTasks />} />
              <Route path="bulk-outreach" element={<AdminBulkOutreach />} />
            </Route>

            {/* Finance section — sidebar layout wraps sub-pages */}
            <Route
              path="/admin/finance"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminFinance />
                </ProtectedRoute>
              }
            >
              <Route index element={<AdminFinanceIndex />} />
              <Route path="billing" element={<AdminBilling />} />
              <Route path="invoices" element={<AdminInvoices />} />
              <Route path="clients" element={<AdminClients />} />
              <Route path="service-calendar" element={<AdminServiceCalendar />} />
              <Route path="donations" element={<AdminDonations />} />
              <Route path="deposits" element={<AdminDeposits />} />
              <Route path="deposits/:id" element={<AdminDepositDetail />} />
              <Route path="master-revenue-tracker" element={<AdminMasterRevenueTracker />} />
            </Route>

            {/* Signals — standalone admin pages */}
            <Route
              path="/admin/signals"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminSignals />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/signals/archive"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminSignalsArchive />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/signals/trash"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminSignalsTrash />
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
