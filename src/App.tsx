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
import HouseRules from "./pages/HouseRules";
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
import AdminCSBGInvoice from "./pages/admin/AdminCSBGInvoice";
import AdminDocumentVault from "./pages/admin/AdminDocumentVault";
import AdminCSBGBudget from "./pages/admin/AdminCSBGBudget";
import AdminCSBGChecklist from "./pages/admin/AdminCSBGChecklist";
import AdminCSBGDashboard from "./pages/admin/AdminCSBGDashboard";
import AdminCSBGSubmissions from "./pages/admin/AdminCSBGSubmissions";
import AdminRegistrationAnalytics from "./pages/admin/AdminRegistrationAnalytics";
import AdminAttendance from "./pages/admin/AdminAttendance";
import AdminFormBuilder from "./pages/admin/AdminFormBuilder";
import AdminAttendanceReports from "./pages/admin/AdminAttendanceReports";
import CheckIn from "./pages/CheckIn";
import LilChampsCheckIn from "./pages/LilChampsCheckIn";
import AdminLilChampsAttendance from "./pages/admin/AdminLilChampsAttendance";
import AdminCallOuts from "./pages/admin/AdminCallOuts";
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
import AdminStaffManagement from "./pages/admin/AdminStaffManagement";
import AdminPDTaskManager from "./pages/admin/AdminPDTaskManager";
import AdminPCTaskManager from "./pages/admin/AdminPCTaskManager";
import InvoiceApproval from "./pages/InvoiceApproval";
import TransportLogin from "./pages/TransportLogin";
import TransportAdminLogin from "./pages/transport/TransportAdminLogin";
import CallOut from "./pages/CallOut";
import TransportAdminLayout from "./pages/transport/TransportAdminLayout";
import TransportDrivers from "./pages/transport/TransportDrivers";
import TransportYouth from "./pages/transport/TransportYouth";
import TransportRunsPay from "./pages/transport/TransportRunsPay";
import TransportDashboard from "./pages/transport/TransportDashboard";
import TransportRun from "./pages/transport/TransportRun";
import TransportIncidents from "./pages/transport/TransportIncidents";
import AdminTransportImpactReports from "./pages/admin/AdminTransportImpactReports";
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
            <Route path="/house-rules" element={<HouseRules />} />
            <Route path="/register" element={<Register />} />
            <Route path="/supporters" element={<Supporters />} />
            <Route path="/check-in" element={<CheckIn />} />
            <Route path="/check-in/lil-champs-corner" element={<LilChampsCheckIn />} />
            <Route path="/call-out" element={<CallOut />} />
            <Route path="/approvals/invoice/:token" element={<InvoiceApproval />} />
            <Route path="/transport" element={<TransportLogin />} />
            <Route path="/transport/dashboard" element={<TransportDashboard />} />
            <Route path="/transport/run" element={<TransportRun />} />
            <Route path="/transport/admin" element={<TransportAdminLogin />} />
            <Route element={<TransportAdminLayout />}>
              <Route path="/transport/admin/drivers" element={<TransportDrivers />} />
              <Route path="/transport/admin/youth" element={<TransportYouth />} />
              <Route path="/transport/admin/runs" element={<TransportRunsPay />} />
              <Route path="/transport/admin/incidents" element={<TransportIncidents />} />
            </Route>
            
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
              <Route path="attendance" element={<AdminAttendance />} />
              <Route path="attendance-reports" element={<AdminAttendanceReports />} />
              <Route path="form-builder" element={<AdminFormBuilder />} />
              <Route path="lil-champs-attendance" element={<AdminLilChampsAttendance />} />
              <Route path="callouts" element={<AdminCallOuts />} />
              <Route path="transportation/drivers" element={<TransportDrivers />} />
              <Route path="transportation/youth" element={<TransportYouth />} />
              <Route path="transportation/runs" element={<TransportRunsPay />} />
              <Route path="transportation/incidents" element={<TransportIncidents />} />
              <Route path="transportation/impact-reports" element={<AdminTransportImpactReports />} />
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
              <Route path="csbg/invoice" element={<AdminCSBGInvoice />} />
              <Route path="csbg/budget" element={<AdminCSBGBudget />} />
              <Route path="csbg/checklist" element={<AdminCSBGChecklist />} />
              <Route path="csbg/dashboard" element={<AdminCSBGDashboard />} />
              <Route path="csbg/submissions" element={<AdminCSBGSubmissions />} />
              <Route path="vault" element={<AdminDocumentVault />} />
              <Route path="invoices" element={<AdminInvoices />} />
              <Route path="clients" element={<AdminClients />} />
              <Route path="service-calendar" element={<AdminServiceCalendar />} />
              <Route path="donations" element={<AdminDonations />} />
              <Route path="deposits" element={<AdminDeposits />} />
              <Route path="deposits/:id" element={<AdminDepositDetail />} />
              <Route path="master-revenue-tracker" element={<AdminMasterRevenueTracker />} />
            </Route>

            {/* PD Task Manager — Focus Area selection */}
            <Route
              path="/admin/pd-task-manager"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminPDTaskManager />
                </ProtectedRoute>
              }
            />

            {/* PC Task Manager — Focus Area selection */}
            <Route
              path="/admin/pc-task-manager"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminPCTaskManager />
                </ProtectedRoute>
              }
            />

            {/* PC Signals — per focus area */}
            <Route
              path="/admin/pc-signals/:focusArea"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminSignals managerType="PC" />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/pc-signals/:focusArea/archive"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminSignalsArchive managerType="PC" />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/pc-signals/:focusArea/trash"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminSignalsTrash managerType="PC" />
                </ProtectedRoute>
              }

            {/* Signals — per focus area */}
            <Route
              path="/admin/signals/:focusArea"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminSignals />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/signals/:focusArea/archive"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminSignalsArchive />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/signals/:focusArea/trash"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminSignalsTrash />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/staff"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminStaffManagement />
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
