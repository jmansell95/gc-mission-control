import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import DomainAccessError from '@/components/DomainAccessError';
import AccessGateScreen from '@/components/AccessGateScreen';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import RouteGuard from '@/components/RouteGuard';
import AppLayout from '@/components/AppLayout';
import HubReadinessGate from '@/components/HubReadinessGate';
import { MobileAppProvider } from '@/contexts/MobileAppContext';
import AppShell from '@/components/mobile/AppShell';
import Home from './pages/Home';
import InboxPage from './pages/InboxPage';
import PendingAccess from './pages/PendingAccess';
import Onboarding from './pages/Onboarding';
import EnterpriseDashboard from './pages/EnterpriseDashboard';
import BusinessUnitPage from './pages/BusinessUnitPage';
import EnterpriseSettings from './pages/EnterpriseSettings';
import EnterpriseHelp from './pages/EnterpriseHelp';
import EnterpriseStaffHub from './pages/EnterpriseStaffHub';
import EnterpriseFleetHub from './pages/EnterpriseFleetHub';
import EnterpriseOperationsHub from './pages/EnterpriseOperationsHub';
import EnterpriseFinancialHub from './pages/EnterpriseFinancialHub';
import EnterpriseComplianceHub from './pages/EnterpriseComplianceHub';
import EnterpriseCrewAvailabilityPage from './pages/EnterpriseCrewAvailabilityPage';
import EnterpriseResourcePoolPage from './pages/EnterpriseResourcePoolPage';
import AdminDashboard from './pages/AdminDashboard';
import ManagerTeamDashboard from '@/components/dashboard/ManagerTeamDashboard';
import PrehistoricImportPage from './components/import/PrehistoricImportPage';

import ProfileRouter from '@/components/staff/ProfileRouter';
import DesktopProfile from '@/components/staff/DesktopProfile';
import FieldShell from '@/components/field/FieldShell';
import FieldHomeHub from '@/components/field/FieldHomeHub';
import TodayPage from './pages/field/TodayPage';
import UpcomingPage from './pages/field/UpcomingPage';
import MorePage from './pages/field/MorePage';
import MyDutiesPage from './pages/field/MyDutiesPage';
import ToolsPage from './pages/field/ToolsPage';
import SubcontractorDashboard from './pages/SubcontractorDashboard';
import ClientPortal from './pages/ClientPortal';
import DeliveryDashboard from './pages/DeliveryDashboard';
import AdminDeliveryHub from './pages/AdminDeliveryHub';
import DriverHub from './pages/DriverHub';
import HelpGuide from './pages/HelpGuide';
import PresentationPack from './pages/PresentationPack';
import AssetHub from './pages/AssetHub';
import AssetDetailPage from './pages/AssetDetailPage';
import ErrorBoundary from '@/components/ErrorBoundary';
import FleetHub from './pages/FleetHub';
import KeyLogBookDocs from './pages/KeyLogBookDocs';
import ImprovementRoadmap from './pages/ImprovementRoadmap';
import Microsoft365SetupGuide from './pages/Microsoft365SetupGuide';
import PATTestingConsole from './pages/PATTestingConsole';
import ReportingHub from './pages/ReportingHub';
import CompliancePage from './pages/CompliancePage';
import BillingPage from './pages/BillingPage';
import AzureMigrationPlan from './pages/AzureMigrationPlan';
import DepotPickLists from './pages/DepotPickLists';
import PowerAppsMigrationRoadmap from './pages/PowerAppsMigrationRoadmap';
import PowerAppsBuildHub from './pages/PowerAppsBuildHub';
import PortalDashboard from './pages/PortalDashboard';


import StaffPage from './pages/StaffPage';
import Login from './pages/Login';
import OAuthConsent from './pages/OAuthConsent';
import { StaffAssistantProvider } from '@/components/StaffAssistantChat';
import { GlobalScannerProvider } from '@/contexts/GlobalScannerContext';
import { SchedulingAssistantProvider } from '@/components/SchedulingAssistantChat';
import { DrillingIntelligenceProvider } from '@/components/DrillingIntelligenceChat';
import { AIHubProvider } from '@/components/ai/AIHub';
import { DivisionProvider } from '@/contexts/DivisionContext';
import { AutopilotToastProvider } from '@/components/autopilot/AutopilotToastProvider';
import RouteLoadingOverlay from '@/components/RouteLoadingOverlay';
import AppBaseUrlSync from '@/components/AppBaseUrlSync';
import LocationPermissionGate from '@/components/LocationPermissionGate';
import AssetScannerPage from './pages/AssetScannerPage';
import KioskScannerRedirect from '@/components/KioskScannerRedirect';
import MobileFieldRedirect from '@/components/MobileFieldRedirect';
import MobileFieldShell from '@/components/MobileFieldShell';
import useJobRealtimeSync from '@/hooks/useJobRealtimeSync';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError } = useAuth();
  useJobRealtimeSync();

  const isClientPortalRoute = window.location.pathname.includes('/client-portal/') || window.location.pathname === '/portal';

  // Skip auth checks for public client portal routes
  if (!isClientPortalRoute && (isLoadingPublicSettings || isLoadingAuth)) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle "user not registered" error (skip for public client portal).
  // auth_required is handled by ProtectedRoute redirecting to /login, NOT by a
  // hard redirect during render (which caused the refresh loop on publish).
  if (!isClientPortalRoute && authError && authError.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }

  // Reject Microsoft SSO logins from non-ground-control.co.uk email domains
  if (!isClientPortalRoute && authError && authError.type === 'domain_not_allowed') {
    return <DomainAccessError email={authError.email} />;
  }

  // Access gate — user is waiting for admin approval
  if (!isClientPortalRoute && authError && authError.type === 'access_pending') {
    return (
      <AccessGateScreen
        status="pending"
        email={authError.email}
        approvers={authError.approvers || []}
        contactInstructions={authError.contact_instructions || ''}
      />
    );
  }

  // Access gate — user was rejected by an admin
  if (!isClientPortalRoute && authError && authError.type === 'access_rejected') {
    return <AccessGateScreen status="rejected" email={authError.email} />;
  }

  // Render the main app — wrapped in ErrorBoundary so any provider/route
  // crash shows a diagnostic error card instead of a blank white screen.
  return (
    <ErrorBoundary>
    <MobileAppProvider>
    <StaffAssistantProvider>
      <SchedulingAssistantProvider>
        <DrillingIntelligenceProvider>
        <AIHubProvider>
        <DivisionProvider>
        <AutopilotToastProvider>
        <AppBaseUrlSync />
        <RouteLoadingOverlay />
        {!isClientPortalRoute && <LocationPermissionGate />}
        <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/oauth/consent" element={<OAuthConsent />} />
        <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route path="/portal" element={<PortalDashboard />} />
        <Route element={<AppShell />}>
          <Route path="/" element={<KioskScannerRedirect><Home /></KioskScannerRedirect>} />
          <Route path="/pending-access" element={<PendingAccess />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/inbox" element={<RouteGuard><InboxPage /></RouteGuard>} />
          <Route path="/admin" element={<RouteGuard><AdminDashboard /></RouteGuard>} />
          <Route path="/manager-team" element={<RouteGuard><ManagerTeamDashboard /></RouteGuard>} />
          {/* Profile router — splits field (mobile) vs office (desktop) profile.
              Standalone (not inside FieldShell) so office users get a clean
              redirect to /admin/profile without a FieldShell flash, and field
              users get FieldShell wrapping conditionally inside ProfileRouter. */}
          <Route path="/staff-profile" element={<RouteGuard><ProfileRouter /></RouteGuard>} />
          <Route path="/m/staff-profile" element={<RouteGuard><ProfileRouter /></RouteGuard>} />
          {/* Field crew routes — shared FieldShell with persistent bottom bar, fully responsive */}
          <Route element={<FieldShell />}>
            {/* Home hub — the card-based landing page (replaces the old bottom tab bar) */}
            <Route path="/staff-schedule" element={<RouteGuard><FieldHomeHub /></RouteGuard>} />
            {/* Actual schedule detail (was at /staff-schedule, now at /today-schedule) */}
            <Route path="/today-schedule" element={<RouteGuard><TodayPage /></RouteGuard>} />
            <Route path="/upcoming" element={<RouteGuard><UpcomingPage /></RouteGuard>} />
            <Route path="/more" element={<RouteGuard><MorePage /></RouteGuard>} />
            <Route path="/my-duties" element={<RouteGuard><MyDutiesPage /></RouteGuard>} />
            <Route path="/tools" element={<RouteGuard><ToolsPage /></RouteGuard>} />
            <Route path="/scanner" element={<RouteGuard><AssetScannerPage /></RouteGuard>} />
            {/* Mobile /m/ tree — same components, FieldShell handles mobile layout */}
            <Route path="/m/staff-schedule" element={<RouteGuard><FieldHomeHub /></RouteGuard>} />
            <Route path="/m/today-schedule" element={<RouteGuard><TodayPage /></RouteGuard>} />
            <Route path="/m/upcoming" element={<RouteGuard><UpcomingPage /></RouteGuard>} />
            <Route path="/m/more" element={<RouteGuard><MorePage /></RouteGuard>} />
            <Route path="/m/my-duties" element={<RouteGuard><MyDutiesPage /></RouteGuard>} />
            <Route path="/m/tools" element={<RouteGuard><ToolsPage /></RouteGuard>} />
            <Route path="/m/scanner" element={<RouteGuard><AssetScannerPage /></RouteGuard>} />
          </Route>
          {/* Deliveries — separate route (not one of the 5 main field tabs) */}
          <Route path="/deliveries" element={<MobileFieldRedirect><RouteGuard><DeliveryDashboard /></RouteGuard></MobileFieldRedirect>} />
          <Route element={<MobileFieldShell />}>
            <Route path="/m/deliveries" element={<RouteGuard><DeliveryDashboard /></RouteGuard>} />
          </Route>
          <Route path="/help" element={<HelpGuide audience="office" />} />
          <Route path="/help-field" element={<HelpGuide audience="field" />} />
          <Route path="/enterprise" element={<RouteGuard><EnterpriseDashboard /></RouteGuard>} />
          <Route path="/enterprise/business-unit/:id" element={<RouteGuard><BusinessUnitPage /></RouteGuard>} />
          <Route path="/enterprise/settings" element={<RouteGuard><EnterpriseSettings /></RouteGuard>} />
          <Route path="/enterprise/help" element={<RouteGuard><EnterpriseHelp /></RouteGuard>} />
          <Route path="/enterprise/staff" element={<RouteGuard><EnterpriseStaffHub /></RouteGuard>} />
          <Route path="/enterprise/fleet" element={<RouteGuard><EnterpriseFleetHub /></RouteGuard>} />
          <Route path="/enterprise/operations" element={<RouteGuard><EnterpriseOperationsHub /></RouteGuard>} />
          <Route path="/enterprise/financial" element={<RouteGuard><EnterpriseFinancialHub /></RouteGuard>} />
          <Route path="/enterprise/compliance" element={<RouteGuard><EnterpriseComplianceHub /></RouteGuard>} />
          <Route path="/enterprise/crew-availability" element={<RouteGuard><EnterpriseCrewAvailabilityPage /></RouteGuard>} />
          <Route path="/enterprise/resource-pool" element={<RouteGuard><EnterpriseResourcePoolPage /></RouteGuard>} />
          <Route element={<AppLayout />}>
            <Route path="/admin/profile" element={<RouteGuard><DesktopProfile /></RouteGuard>} />
            <Route path="/subcontractor" element={<RouteGuard><SubcontractorDashboard /></RouteGuard>} />
            <Route path="/admin/logistics" element={<RouteGuard><HubReadinessGate featureId="logistics"><DriverHub /></HubReadinessGate></RouteGuard>} />
            <Route path="/depot-pick-lists" element={<RouteGuard><HubReadinessGate featureId="logistics"><DepotPickLists /></HubReadinessGate></RouteGuard>} />
            <Route path="/presentation-pack" element={<RouteGuard><PresentationPack /></RouteGuard>} />

            <Route path="/pat-testing" element={<RouteGuard><PATTestingConsole /></RouteGuard>} />
            <Route path="/compliance" element={<RouteGuard><HubReadinessGate featureId="compliance"><CompliancePage /></HubReadinessGate></RouteGuard>} />
            <Route path="/billing" element={<RouteGuard><HubReadinessGate featureId="billing"><BillingPage /></HubReadinessGate></RouteGuard>} />

            <Route path="/reports" element={<RouteGuard><HubReadinessGate featureId="reports"><ReportingHub /></HubReadinessGate></RouteGuard>} />
            <Route path="/staff" element={<RouteGuard><HubReadinessGate featureId="staff"><StaffPage /></HubReadinessGate></RouteGuard>} />
            <Route path="/safety" element={<Navigate to="/compliance" replace />} />
            <Route path="/assets" element={<RouteGuard><HubReadinessGate featureId="assets"><ErrorBoundary><AssetHub /></ErrorBoundary></HubReadinessGate></RouteGuard>} />
            <Route path="/assets/:id" element={<RouteGuard><ErrorBoundary><AssetDetailPage /></ErrorBoundary></RouteGuard>} />
            <Route path="/fleet" element={<RouteGuard><HubReadinessGate featureId="fleet"><FleetHub /></HubReadinessGate></RouteGuard>} />
            <Route path="/timesheets" element={<Navigate to="/staff" replace />} />
            <Route path="/contacts" element={<Navigate to="/staff" replace />} />
            <Route path="/audit" element={<Navigate to="/compliance" replace />} />
            <Route path="/price-list" element={<Navigate to="/billing" replace />} />
            <Route path="/vehicles" element={<Navigate to="/fleet" replace />} />
            <Route path="/import" element={<Navigate to="/admin" replace />} />
            <Route path="/automations" element={<Navigate to="/admin" replace />} />
            <Route path="/keylogbook-docs" element={<RouteGuard><KeyLogBookDocs /></RouteGuard>} />
            <Route path="/roadmap" element={<RouteGuard><ImprovementRoadmap /></RouteGuard>} />
            <Route path="/azure-migration-plan" element={<RouteGuard><AzureMigrationPlan /></RouteGuard>} />
            <Route path="/m365-setup-guide" element={<RouteGuard><Microsoft365SetupGuide /></RouteGuard>} />
            <Route path="/powerapps-migration-roadmap" element={<RouteGuard><PowerAppsMigrationRoadmap /></RouteGuard>} />
            <Route path="/powerapps-build-hub" element={<RouteGuard><PowerAppsBuildHub /></RouteGuard>} />
            <Route path="/prehistoric-import" element={<RouteGuard><PrehistoricImportPage /></RouteGuard>} />
          </Route>
          <Route path="/rig-hub" element={<Navigate to="/assets" replace />} />
          <Route path="/asset-inventory" element={<Navigate to="/assets" replace />} />
        </Route>
        </Route>
        <Route path="/client-portal/:token" element={<ClientPortal />} />
        <Route path="*" element={<PageNotFound />} />
      </Routes>
        </AutopilotToastProvider>
        </DivisionProvider>
        </AIHubProvider>
        </DrillingIntelligenceProvider>
      </SchedulingAssistantProvider>
    </StaffAssistantProvider>
    </MobileAppProvider>
    </ErrorBoundary>
  );
};


function App() {

  return (
    <ErrorBoundary>
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <GlobalScannerProvider>
            <AuthenticatedApp />
          </GlobalScannerProvider>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
    </ErrorBoundary>
  )
}

export default App