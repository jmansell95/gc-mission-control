import React, { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import StaffCommand from '@/components/StaffCommand';
import VehicleManager from '@/components/VehicleManager';
import ContractorManager from '@/components/ContractorManager';
import ClientManager from '@/components/ClientManager';
import AbsenceManager from '@/components/AbsenceManager';
import EmailAlertsSettings from '@/components/EmailAlertsSettings';
import GlobalBrandingSettings from '@/components/GlobalBrandingSettings';
import LoginBrandingSettings from '@/components/settings/LoginBrandingSettings';
import PortalBrandingEditor from '@/components/settings/PortalBrandingEditor';
import SupplierManager from '@/components/SupplierManager';
import OvertimeRatesManager from '@/components/OvertimeRatesManager';
import BusinessConfigManager from '@/components/BusinessConfigManager';
import AutomationCenter from '@/components/AutomationCenter';
import BillingRulesManager from '@/components/BillingRulesManager';
import EquipmentLibraryManager from '@/components/EquipmentLibraryManager';
import CrewTypeCommand from '@/components/CrewTypeCommand';
import AssetPandaSettings from '@/components/AssetPandaSettings';
import AssetManifestManager from '@/components/assetpanda/AssetManifestManager';
import RateCardManager from '@/components/RateCardManager';
import DropdownConfigManager from '@/components/DropdownConfigManager';
import SettingsHubOverview from '@/components/SettingsHubOverview';
import { accessibleSettingsItems } from '@/components/SettingsNav';
import ComplianceManager from '@/components/ComplianceManager';
import ComplianceRulesSettings from '@/components/ComplianceRulesSettings';
import LogQualityControl from '@/components/investigation/LogQualityControl';
import AuditTrailHub from '@/components/audit/AuditTrailHub';
import SystemAuditLogViewer from '@/components/audit/SystemAuditLogViewer';
import EmailTemplateManager from '@/components/settings/EmailTemplateManager';
import TimesheetManager from '@/components/TimesheetManager';
import BillingPage from '@/components/BillingPage';
import FinancialDataExchange from '@/components/billing/FinancialDataExchange';
import AGSImportSettings from '@/components/AGSImportSettings';
import GeotechSettings from '@/components/settings/GeotechSettings';
import DailyChecklistManager from '@/components/settings/DailyChecklistManager';
import ImportDashboard from '@/pages/ImportDashboard';
import SafetyCultureSettings from '@/components/SafetyCultureSettings';
import SystemLogicGuide from '@/components/SystemLogicGuide';

import ExpensePresetManager from '@/components/settings/ExpensePresetManager';
import ExpenseDefaultsManager from '@/components/settings/ExpenseDefaultsManager';
import ConcurSyncSettings from '@/components/settings/ConcurSyncSettings';
import SubconMarkupRules from '@/components/settings/SubconMarkupRules';
import GLCodeMapping from '@/components/settings/GLCodeMapping';
import BillingContractManager from '@/components/settings/BillingContractManager';
import PurchaseOrderManager from '@/components/settings/PurchaseOrderManager';
import BillingPipelineDashboard from '@/components/settings/BillingPipelineDashboard';
import FinancialAuditLogViewer from '@/components/settings/FinancialAuditLogViewer';
import BobHRSettings from '@/components/settings/BobHRSettings';
import PayrollExportSettings from '@/components/settings/PayrollExportSettings';
import CISSettings from '@/components/settings/CISSettings';
import HolmanSettings from '@/components/settings/HolmanSettings';
import GeotabSettings from '@/components/settings/GeotabSettings';
import JobAlertSettings from '@/components/settings/JobAlertSettings';
import IntegrationsHub from '@/components/settings/IntegrationsHub';
import MetOfficeSettings from '@/components/settings/MetOfficeSettings';
import GoogleMapsSettings from '@/components/settings/GoogleMapsSettings';
import WhatsAppSettings from '@/components/settings/WhatsAppSettings';
import AccountingSyncSettings from '@/components/settings/AccountingSyncSettings';
import PaymentGatewaySettings from '@/components/settings/PaymentGatewaySettings';
import CustomReportBuilder from '@/components/reports/CustomReportBuilder';
import HolidayAccrualManager from '@/components/staff/HolidayAccrualManager';
import StaffReviewManager from '@/components/staff/StaffReviewManager';
import TimesheetDelegationManager from '@/components/settings/TimesheetDelegationManager';
import BackupRestoreManager from '@/components/settings/BackupRestoreManager';
import ClientProgressReport from '@/components/reports/ClientProgressReport';
import AssetLifecycleManager from '@/components/settings/AssetLifecycleManager';
import DepreciationProfileManager from '@/components/settings/DepreciationProfileManager';
import ZapierWebhookSettings from '@/components/settings/ZapierWebhookSettings';
import PushNotificationSettings from '@/components/settings/PushNotificationSettings';
import Microsoft365Hub from '@/components/settings/Microsoft365Hub';
import IncrementalImportSettings from '@/components/settings/IncrementalImportSettings';
import OpenGroundSettings from '@/components/settings/OpenGroundSettings';
import RewardsManager from '@/components/settings/RewardsManager';
import ReadinessManager from '@/components/settings/ReadinessManager';
import DivisionManager from '@/components/settings/DivisionManager';
import SettingsAccessGuard from '@/components/settings/SettingsAccessGuard';
import SettingsSidebar from '@/components/SettingsSidebar';
import { useSettingsAccess } from '@/hooks/useSettingsAccess';
import ErrorBoundary from '@/components/ErrorBoundary';
import { resolveRole } from '@/utils/access';
import { base44 } from '@/api/base44Client';

// IDs managed by the Integrations Hub — back button returns to 'integrations' from these
const INTEGRATION_IDS = new Set([
  'geotab-sync', 'holman-sync', 'asset-panda', 'bob-hr', 'concur-sync',
  'safety-culture', 'cis-verification', 'payroll-export',
  'met-office', 'google-maps', 'whatsapp', 'accounting-sync', 'payment-gateway',
  'microsoft-365',
]);

export default function SettingsPage({ initialTab, onSelectJob, standalone }) {
  const [activeTab, setActiveTab] = useState(initialTab || 'hub');
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    (async () => {
      try { const res = await base44.functions.invoke('getMyStaffProfile'); setProfile(res.data); } catch (e) {}
    })();
  }, []);

  const role = resolveRole(profile) || 'admin';
  const { lockdownMap, isPageAccessible, isLoading: lockdownLoading } = useSettingsAccess();

  // Filter nav items by both the existing role-based access AND the lockdown config.
  const items = accessibleSettingsItems(role, profile).filter(i => isPageAccessible(i.id, role));

  useEffect(() => { if (initialTab) setActiveTab(initialTab); }, [initialTab]);

  useEffect(() => {
    // Standalone pages (Staff, Contacts, Import, etc.) handle access control
    // via RouteGuard at the route level. Skip the settings-item accessibility
    // check so the requested tab renders even though it's no longer in the
    // settings nav list.
    if (standalone) return;
    if (!profile || items.length === 0 || lockdownLoading) return;
    if (!items.find(i => i.id === activeTab)) setActiveTab(items[0].id);
  }, [profile, role, activeTab, items, lockdownLoading, standalone]);

  const active = items.find(t => t.id === activeTab);
  const activeLockdown = active ? lockdownMap[active.id] : null;
  const isLockedOut = active && activeLockdown?.locked && !isPageAccessible(active.id, role);

  const isIntegration = INTEGRATION_IDS.has(activeTab);

  const renderContent = () => {
    // If this page is locked down and the user doesn't have access, show the guard.
    if (isLockedOut) {
      return <SettingsAccessGuard pageLabel={active.label} lockedBy={activeLockdown.lockedBy} lockedAt={activeLockdown.lockedAt} />;
    }
   
    switch (activeTab) {
      case 'hub': return <SettingsHubOverview onNavigate={setActiveTab} />;
      case 'divisions': return <DivisionManager />;
      case 'readiness': return <ReadinessManager />;
      case 'integrations': return <IntegrationsHub onNavigate={setActiveTab} />;
      case 'staff': return <StaffCommand />;
      case 'teams': return <CrewTypeCommand />;

      case 'asset-panda': return <AssetPandaSettings />;
      case 'asset-manifests': return <AssetManifestManager />;
      case 'vehicles': return <VehicleManager />;
      case 'clients': return <ClientManager />;
      case 'contractors': return <ContractorManager />;
      case 'suppliers': return <SupplierManager />;
      case 'absences': return <AbsenceManager />;
      case 'overtime': return <OvertimeRatesManager />;
      case 'business-rules': return <BusinessConfigManager />;
      case 'email-alerts': return <EmailAlertsSettings />;
      case 'global-branding': return <GlobalBrandingSettings />;
      case 'login-branding': return <LoginBrandingSettings />;
      case 'portal-branding': return <PortalBrandingEditor />;
      case 'automations': return <AutomationCenter />;
      case 'daily-checklists': return <DailyChecklistManager />;
      case 'dropdowns': return <DropdownConfigManager />;
      case 'rate-card': return <RateCardManager />;
      case 'billing': return <BillingRulesManager />;
      case 'equipment-library': return <EquipmentLibraryManager />;
      case 'compliance': return <ComplianceManager />;
      case 'compliance-rules': return <ComplianceRulesSettings />;
      case 'log-qc': return <LogQualityControl />;
      case 'audit-trail': return <AuditTrailHub />;
      case 'system-audit-log': return <SystemAuditLogViewer />;
      case 'email-templates': return <EmailTemplateManager />;
      case 'timesheets': return <TimesheetManager />;
      case 'invoicing': return <BillingPage onSelectJob={onSelectJob} />;
      case 'data-exchange': return <FinancialDataExchange />;
      case 'ags-import': return <GeotechSettings />;
      case 'planner-import': return <ImportDashboard />;
      case 'safety-culture': return <SafetyCultureSettings />;
      case 'system-guide': return <SystemLogicGuide />;
      case 'custom-reports': return <CustomReportBuilder />;
      case 'expense-presets': return <ExpensePresetManager />;
      case 'expense-defaults': return <ExpenseDefaultsManager />;
      case 'concur-sync': return <ConcurSyncSettings />;
      case 'subcon-markup': return <SubconMarkupRules />;
      case 'gl-mapping': return <GLCodeMapping />;
      case 'billing-contracts': return <BillingContractManager />;
      case 'purchase-orders': return <PurchaseOrderManager />;
      case 'billing-pipeline': return <BillingPipelineDashboard onNavigate={setActiveTab} onSelectJob={onSelectJob} />;
      case 'financial-audit': return <FinancialAuditLogViewer />;
      case 'bob-hr': return <BobHRSettings />;
      case 'payroll-export': return <PayrollExportSettings />;
      case 'cis-verification': return <CISSettings />;
      case 'job-alerts': return <JobAlertSettings />;
      case 'holman-sync': return <HolmanSettings />;
      case 'geotab-sync': return <GeotabSettings />;
      case 'met-office': return <MetOfficeSettings />;
      case 'google-maps': return <GoogleMapsSettings />;
      case 'whatsapp': return <WhatsAppSettings />;
      case 'accounting-sync': return <AccountingSyncSettings />;
      case 'payment-gateway': return <PaymentGatewaySettings />;
      case 'microsoft-365': return <Microsoft365Hub />;
      case 'holiday-accrual': return <HolidayAccrualManager />;
      case 'staff-reviews': return <StaffReviewManager />;
      case 'timesheet-delegation': return <TimesheetDelegationManager />;
      case 'backup-restore': return <BackupRestoreManager />;
      case 'client-progress-report': return <ClientProgressReport />;
      case 'asset-lifecycle': return <AssetLifecycleManager />;
      case 'depreciation-profiles': return <DepreciationProfileManager />;
      case 'zapier-webhooks': return <ZapierWebhookSettings />;
      case 'push-notifications': return <PushNotificationSettings />;
      case 'incremental-import': return <IncrementalImportSettings />;
      case 'openground-sync': return <GeotechSettings />;
      case 'rewards': return <RewardsManager />;
      default: return null;
    }
  };

  return (
    <div className="flex gap-4">
      {!standalone && (
        <div className="w-60 flex-shrink-0 hidden lg:block">
          <SettingsSidebar activeTab={activeTab} onNavigate={setActiveTab} items={items} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        {!standalone && activeTab !== 'hub' && (
          <button
            onClick={() => setActiveTab(isIntegration ? 'integrations' : 'hub')}
            className="mb-4 inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition shadow-sm lg:hidden"
          >
            <ArrowLeft className="w-4 h-4" />
            {isIntegration ? 'Back to Integrations' : 'Back to Overview'}
          </button>
        )}
        <ErrorBoundary key={activeTab}>
          {renderContent()}
        </ErrorBoundary>
      </div>
    </div>
  );
}