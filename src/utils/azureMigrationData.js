/**
 * Azure Migration — 1:1 Parity Data
 * Single source of truth for every Base44 artifact that must map to an Azure
 * equivalent. Consumed by the on-screen Parity Matrix and the A3 wall-chart PDF.
 *
 * Principle: preserve everything exactly. Every entity → 1 Azure SQL table,
 * every function → 1 Azure Function, every automation → 1 timer trigger,
 * every webhook → 1 HTTP trigger, every agent → 1 Azure Function + Entra SP.
 */

// ── ENTITIES ──────────────────────────────────────────────────────────────
// Each entity → 1 Azure SQL table. RLS types:
//   division  = division_id match (SESSION_CONTEXT)
//   ownership = created_by_id match
//   admin     = admin-only
//   public    = null read (all authenticated users)
//   complex   = $or combination (division + ownership + admin)
//   none      = no RLS declared

export const ENTITY_GROUPS = {
  'Core Operations': [
    'Job', 'JobType', 'JobPack', 'JobMilestone', 'JobDelayLog', 'JobComment', 'JobDocument',
    'JobAssetAssignment', 'JobBillOfQuantities', 'JobBillingContract', 'JobCostItem',
    'RotaAssignment', 'RotaWeek', 'StaffShift', 'ShiftSwap', 'Absence', 'RecurringAbsence',
    'ShutdownPeriod', 'BankHoliday', 'RecurringDepotDuty',
  ],
  'Staff & HR': [
    'Staff', 'Team', 'DrillingCrew', 'PermissionGroup', 'TrainingCourse', 'TrainingRequirement',
    'TrainingBooking', 'StaffReview', 'StaffMessage', 'HolidayPayAccrual', 'TimesheetDelegation',
    'IncentiveScore', 'Achievement', 'Reward', 'RewardRedemption',
  ],
  'Timesheets & Payroll': [
    'Timesheet', 'OvertimeSetting', 'OvertimeRate', 'CashFlowEntry', 'DailyCost', 'ExpensePreset',
  ],
  'Financial & Billing': [
    'BillingRule', 'RateCardItem', 'KeywordRateMapping', 'Invoice', 'AFP', 'AFPLineItem',
    'AFPTemplate', 'CVR', 'CVRLineItem', 'VariationOrder', 'POAPriceLock', 'PurchaseOrder',
    'SubcontractorLog', 'FinancialAuditLog',
  ],
  'Clients & Contractors': [
    'Client', 'Contractor', 'Supplier',
  ],
  'Assets & Equipment': [
    'SiteAsset', 'EquipmentCatalogue', 'EquipmentCalibration', 'AssetManifest', 'AssetReturnLog',
    'DepreciationProfile', 'ServiceRecord', 'ConsumableStockItem', 'GoodsInReceipt', 'ScrapLog',
  ],
  'Vehicles & Fleet': [
    'Vehicle', 'VehicleMaintenanceBooking', 'VehicleMOTHistory', 'VehicleLocationLog', 'GeofenceEvent',
  ],
  'Compliance & Safety': [
    'ComplianceItem', 'ComplianceTask', 'ComplianceConfig', 'SafetyReport', 'ToolboxTalk',
    'EnvironmentalReport', 'BriefingSignature', 'Signature', 'InvestigationLog', 'InvestigationSOR',
    'Sample', 'MonitoringWell', 'LabTestResult',
  ],
  'Deliveries & Logistics': [
    'DeliveryLog', 'DeliveryLeg',
  ],
  'Settings & Config': [
    'AppSetting', 'BusinessConfig', 'ConfigList', 'EmailTemplate', 'ReportTemplate',
    'EmailAlertSetting', 'PortalBranding', 'LoginBranding', 'DashboardLayout', 'CustomField',
    'MittiConfig', 'AssetPandaConfig', 'KeyLogBookConfig', 'KeyLogBookWebhookLog',
    'AutomationControl', 'AutopilotControl', 'PowerBIDataset', 'BackupSchedule',
    'DivisionAccessManifest', 'DivisionSnapshot', 'Division',
  ],
  'System': ['SystemAuditLog', 'User'],
  'Weather': ['WeatherLog'],
  'Site': ['SitePhoto', 'ClientFeedback'],
};

// Entities with complex ($or) RLS — security predicate must replicate the $or
const COMPLEX_RLS = new Set([
  'Staff', 'Timesheet', 'BillingRule', 'RotaAssignment', 'DeliveryLog', 'ComplianceItem',
]);
// Entities with admin-only RLS
const ADMIN_RLS = new Set([
  'MittiConfig', 'AssetPandaConfig', 'AutopilotControl', 'AutomationControl', 'SystemAuditLog',
  'HelpTopic', 'PowerBIDataset', 'BackupSchedule',
]);
// Entities with public (null) read RLS
const PUBLIC_RLS = new Set([
  'HelpTopic', 'ShutdownPeriod', 'HotelBooking', 'SafetyReport',
]);
// Entities with ownership-based RLS
const OWNERSHIP_RLS = new Set([
  'ComplianceItem',
]);

function rlsFor(name) {
  if (COMPLEX_RLS.has(name)) return 'complex';
  if (ADMIN_RLS.has(name)) return 'admin';
  if (PUBLIC_RLS.has(name)) return 'public';
  if (OWNERSHIP_RLS.has(name)) return 'ownership';
  return 'division';
}

export const ENTITIES = Object.entries(ENTITY_GROUPS).flatMap(([category, names]) =>
  names.map(name => ({
    id: `entity-${name}`,
    name,
    category,
    type: 'entity',
    rls: rlsFor(name),
    azureTarget: `Azure SQL table: dbo.${name}`,
  }))
);

// ── BACKEND FUNCTIONS ─────────────────────────────────────────────────────
// Each function → 1 Azure Function. Trigger: HTTP (webhook receiver), Timer
// (scheduled), or HTTP (on-demand SDK call).

const WEBHOOK_FUNCTIONS = [
  'accountingWebhook', 'assetPandaWebhook', 'bobWebhook', 'geotabWebhook', 'holmanWebhook',
  'receiveKeyLogBookData', 'receiveMittiData', 'stripeWebhook', 'whatsappWebhook', 'zapierWebhook',
];

const SCHEDULED_FUNCTIONS = [
  'checkAllJobsAssetCompliance', 'checkAssetCompliance', 'checkBOQVariations', 'checkBillingReadiness',
  'checkComplianceExpiry', 'checkDriverSafety', 'checkFloodRisk', 'checkGeofencePresence',
  'checkGeotechAlerts', 'checkIdleVehicles', 'checkInventoryAlerts', 'checkInvoiceDiscrepancies',
  'checkJobBudgetAlerts', 'checkMileageDiscrepancies', 'checkMilestoneTriggers', 'checkOverdueInvoices',
  'checkPredictiveMaintenance', 'checkRetentionStatus', 'checkSiteReadiness', 'checkSiteWeatherAlerts',
  'checkSubconMargin', 'checkVehicleMaintenance',
  'runCashFlowForecast', 'runClientWeeklyReport', 'runDelayPrediction', 'runPayrollAutopilot',
  'runRigProfitabilityCheck', 'runScheduledBackups', 'runTrainingCompliance', 'runWeatherRostering',
  'syncAccounting', 'syncAssetCompliance', 'syncAssetPanda', 'syncBankHolidays', 'syncBillableItemToAFP',
  'syncBobAbsences', 'syncConcurExpenses', 'syncGeotabFleet', 'syncGeotabTimesheets', 'syncHolmanFleet',
  'syncKeyLogBook', 'syncMetOfficeWeather', 'syncMitti', 'syncOpenGround', 'syncPermanentCrew',
  'syncPortalFeedbackToJobStatus', 'syncPowerBI', 'syncStaffDivisionFromTeam', 'syncStaffUserRoles',
  'syncVehicleOperator',
  'sendDailyReminders', 'sendDailyStandup', 'sendDailyTimesheetSummary', 'sendScheduledReports',
  'sendWeeklyProgressReport',
  'generateMonthlyStatements', 'generateWeeklyOpsDigest',
  'autoBillAssetOnSite', 'autoBookMaintenance', 'autoBuildDailyTimesheets', 'autoCreateAFPFromMilestone',
  'autoCreateBillingFromRemarks', 'autoGenerateInvoice', 'autoGenerateTransferLegs',
  'autoMatchVendorInvoice', 'autoPopulateNewAFP',
  'detectAutoBreaks', 'calculateHolidayAccruals', 'calculateShiftDifferentials',
  'calculateWeeklyIncentives', 'chaseOverdueInvoices',
  'recalculateCVR', 'recalculateDepreciation', 'recalculateUsageMaintenance',
  'reclassifyGhostJobs', 'refreshAllDraftAFPs', 'backfillDivisionTags', 'backfillKlbDurations',
  'cleanupDuplicateAssignments', 'logDailyWeather', 'classifyTrainingCertificates',
];

const ON_DEMAND_FUNCTIONS = [
  'acknowledgeSchedule', 'activateBillingContract', 'addPortalComment', 'approveDelayLog',
  'approveKeyLogBookLogs', 'approvePortalDocument', 'bookAssetToStaff', 'boqImportExport',
  'calculateCharge', 'calculateJobFinancials', 'cloneJob', 'commitAFPParse', 'commitBasketSignOut',
  'commitCVRParse', 'commitConsumableUsage', 'commitGoodsIn', 'commitTrainingImport',
  'completeDecommissioning', 'confirmAssetPandaLink', 'confirmHomeLocation', 'confirmPandaScanLink',
  'createDeliveryTimesheetEntry', 'createStripeCheckout', 'csvBulkImport', 'ensureMyStaffProfile',
  'exportAFPToExcel', 'exportCVRPack', 'exportCVRToExcel', 'exportPayroll',
  'generateDelayLogFromRemarks', 'generateJobAGSExport', 'generateJobPack', 'generateJobReport',
  'generateRotaPDF', 'geocodeJobAddress',
  'getAssetPandaGroupFields', 'getAssetPandaImages', 'getAssetPandaLinkReview', 'getAssetPandaObject',
  'getConfigListUsage', 'getCrewEarnings', 'getDivisionScopedData', 'getEnterpriseStats',
  'getJobByPortalToken', 'getJobWeatherStatus', 'getMyStaffProfile', 'getPortalBranding',
  'getRigProfitability', 'getRouteComparison', 'getSettingsHubStats', 'getStaffICalFeed',
  'getUnlinkedUsers', 'getVehicleLocationHistory', 'getVehicleSafetyEvents', 'getVehicleUtilisation',
  'greenPathApproveTimesheet',
  'importAGS', 'importConcurReconciliation', 'importEWRApplicationData', 'importInternalCostRates',
  'importLegacyArchive', 'importPlannerSpreadsheet', 'importPrehistoricSnapshot', 'incrementalImport',
  'lockPOAPrice', 'logBriefingAsTask', 'logSystemAudit', 'manageEmailAlerts', 'mergeWeeklyTimesheet',
  'migrateCrews', 'migrateJobDisciplines', 'migrateJobTeamTypes', 'migrateToDivisions',
  'notifyAbsenceRequest', 'notifyJobStatusChange', 'notifyMaintenanceBooking', 'notifyNewJob',
  'notifyTimesheetSubmitted', 'notifyTrainingBooking', 'optimizeDailyRoute',
  'parseAFPUpload', 'parseCVRUpload', 'parseEWRAFPUpload', 'populateAFPFromFieldData',
  'predictMaintenance', 'processAssetReturn', 'processEWRRateCardUpload', 'processMasterPriceListUpload',
  'processOffHire', 'processRateCardUpload', 'processSORUpload', 'processSiteCollection',
  'processStaffUpload', 'publishRotaWeek', 'purgeCompletedJobs',
  'pushAFPToCVR', 'pushAbsenceToBob', 'pushAllToAssetPanda', 'pushAssetPhotoToPanda',
  'pushAssetUpdateToPanda', 'pushMilestoneToClient', 'pushSignOutToPanda', 'reGeocodeAllJobs',
  'recordFinancialAudit', 'redeemReward', 'refreshScannedAsset', 'releaseRetention',
  'repriceAFPFromRateCard', 'requestStaffTraining', 'resetAssignmentBriefing', 'resetDatabase',
  'resolveAssetByQR', 'resolveConsumableByBarcode', 'resolveLogPricing', 'restoreDivision',
  'retryAssetReturnSync', 'seedDemoData', 'sendAssignmentNotification', 'sendBrandedInvite',
  'sendCrewWhatsApp', 'sendScheduleEmail', 'sendWelcomeEmail', 'splitMultiSiteJobs',
  'stampBillingCharge', 'startDecommissioning', 'submitAFPToClient', 'submitDailyTimesheet',
  'suggestCrewAllocation', 'testAssetPandaConnection', 'updateAssetComplianceOnMaintenance',
  'updateMyEmailPreference', 'updateMyOnboarding', 'uploadProfilePhoto',
  'validateCompaniesHouse', 'validateRigAssignments', 'validateRigTooling', 'verifyCIS',
];

export const FUNCTIONS = [
  ...WEBHOOK_FUNCTIONS.map(name => ({
    id: `fn-${name}`, name, type: 'function', trigger: 'HTTP (webhook)',
    azureTarget: `Azure Function (HttpTrigger): ${name}`,
  })),
  ...SCHEDULED_FUNCTIONS.map(name => ({
    id: `fn-${name}`, name, type: 'function', trigger: 'Timer',
    azureTarget: `Azure Function (TimerTrigger): ${name}`,
  })),
  ...ON_DEMAND_FUNCTIONS.map(name => ({
    id: `fn-${name}`, name, type: 'function', trigger: 'HTTP (on-demand)',
    azureTarget: `Azure Function (HttpTrigger): ${name}`,
  })),
];

// ── AUTOMATIONS → Timer Triggers ──────────────────────────────────────────
export const AUTOMATIONS = [
  { id: 'auto-compliance-expiry', name: 'Compliance Expiry Check', schedule: 'Daily 06:00', source: 'checkComplianceExpiry', azureTarget: 'Timer Trigger — daily 06:00 UTC' },
  { id: 'auto-vehicle-maintenance', name: 'Vehicle Maintenance Check', schedule: 'Daily 06:00', source: 'checkVehicleMaintenance', azureTarget: 'Timer Trigger — daily 06:00 UTC' },
  { id: 'auto-asset-compliance', name: 'Asset Compliance Check', schedule: 'Daily 06:30', source: 'checkAllJobsAssetCompliance', azureTarget: 'Timer Trigger — daily 06:30 UTC' },
  { id: 'auto-geotab-sync', name: 'Geotab Fleet Sync', schedule: 'Hourly', source: 'syncGeotabFleet', azureTarget: 'Timer Trigger — every hour' },
  { id: 'auto-holman-sync', name: 'Holman Fleet Sync', schedule: 'Daily 02:00', source: 'syncHolmanFleet', azureTarget: 'Timer Trigger — daily 02:00 UTC' },
  { id: 'auto-asset-panda-sync', name: 'Asset Panda Sync', schedule: 'Daily 03:00', source: 'syncAssetPanda', azureTarget: 'Timer Trigger — daily 03:00 UTC' },
  { id: 'auto-bob-absence-sync', name: 'Bob HR Absence Sync', schedule: 'Hourly', source: 'syncBobAbsences', azureTarget: 'Timer Trigger — every hour' },
  { id: 'auto-concur-sync', name: 'Concur Expense Sync', schedule: 'Daily 04:00', source: 'syncConcurExpenses', azureTarget: 'Timer Trigger — daily 04:00 UTC' },
  { id: 'auto-mitti-sync', name: 'Mitti/SafetyCulture Sync', schedule: 'Hourly', source: 'syncMitti', azureTarget: 'Timer Trigger — every hour' },
  { id: 'auto-met-office', name: 'Met Office Weather Sync', schedule: 'Hourly', source: 'syncMetOfficeWeather', azureTarget: 'Timer Trigger — every hour' },
  { id: 'auto-daily-reminders', name: 'Daily Schedule Reminders', schedule: 'Daily 06:30', source: 'sendDailyReminders', azureTarget: 'Timer Trigger — daily 06:30 UTC' },
  { id: 'auto-daily-standup', name: 'Daily Standup Digest', schedule: 'Daily 07:00', source: 'sendDailyStandup', azureTarget: 'Timer Trigger — daily 07:00 UTC' },
  { id: 'auto-weekly-progress', name: 'Weekly Progress Report', schedule: 'Weekly Mon 08:00', source: 'sendWeeklyProgressReport', azureTarget: 'Timer Trigger — weekly Mon 08:00 UTC' },
  { id: 'auto-weekly-ops-digest', name: 'Weekly Ops Digest', schedule: 'Weekly Mon 09:00', source: 'generateWeeklyOpsDigest', azureTarget: 'Timer Trigger — weekly Mon 09:00 UTC' },
  { id: 'auto-payroll-autopilot', name: 'Payroll Autopilot', schedule: 'Daily 23:00', source: 'runPayrollAutopilot', azureTarget: 'Timer Trigger — daily 23:00 UTC' },
  { id: 'auto-timesheet-build', name: 'Auto-Build Daily Timesheets', schedule: 'Daily 22:00', source: 'autoBuildDailyTimesheets', azureTarget: 'Timer Trigger — daily 22:00 UTC' },
  { id: 'auto-scheduled-reports', name: 'Scheduled Reports', schedule: 'Various', source: 'sendScheduledReports', azureTarget: 'Timer Trigger — per-report schedule' },
  { id: 'auto-backup', name: 'Scheduled Division Backups', schedule: 'Daily 01:00', source: 'runScheduledBackups', azureTarget: 'Timer Trigger — daily 01:00 UTC' },
  { id: 'auto-bank-holidays', name: 'Bank Holiday Sync', schedule: 'Weekly', source: 'syncBankHolidays', azureTarget: 'Timer Trigger — weekly' },
  { id: 'auto-training-compliance', name: 'Training Compliance Check', schedule: 'Daily 07:00', source: 'runTrainingCompliance', azureTarget: 'Timer Trigger — daily 07:00 UTC' },
];

// ── AGENTS → Azure Functions + Entra Service Principals ───────────────────
export const AGENTS = [
  { id: 'agent-staff', name: 'Staff Assistant', azureTarget: 'Azure Function + Entra SP — staff_assistant' },
  { id: 'agent-scheduling', name: 'Scheduling Assistant', azureTarget: 'Azure Function + Entra SP — scheduling_assistant' },
  { id: 'agent-drilling', name: 'Drilling Intelligence', azureTarget: 'Azure Function + Entra SP — drilling_intelligence' },
];

// ── CONNECTOR WEBHOOKS → HTTP Triggers ────────────────────────────────────
export const CONNECTOR_WEBHOOKS = [
  { id: 'wh-geotab', name: 'Geotab GPS', events: 'Trip, status, exception', azureTarget: 'HTTP Trigger — geotabWebhook' },
  { id: 'wh-holman', name: 'Holman Fleet', events: 'MOT, service, mileage', azureTarget: 'HTTP Trigger — holmanWebhook' },
  { id: 'wh-asset-panda', name: 'Asset Panda', events: 'Object CRUD', azureTarget: 'HTTP Trigger — assetPandaWebhook' },
  { id: 'wh-bob', name: 'Bob HR', events: 'Absence, staff change', azureTarget: 'HTTP Trigger — bobWebhook' },
  { id: 'wh-mitti', name: 'Mitti / SafetyCulture', events: 'Audit submitted', azureTarget: 'HTTP Trigger — receiveMittiData' },
  { id: 'wh-keylogbook', name: 'KeyLogBook', events: 'Daily log remarks', azureTarget: 'HTTP Trigger — receiveKeyLogBookData' },
  { id: 'wh-stripe', name: 'Stripe Payments', events: 'Payment, invoice', azureTarget: 'HTTP Trigger — stripeWebhook' },
  { id: 'wh-whatsapp', name: 'WhatsApp Business', events: 'Inbound message', azureTarget: 'HTTP Trigger — whatsappWebhook' },
  { id: 'wh-zapier', name: 'Zapier', events: 'Custom zap', azureTarget: 'HTTP Trigger — zapierWebhook' },
  { id: 'wh-accounting', name: 'Accounting (Xero/Sage)', events: 'Invoice, bill', azureTarget: 'HTTP Trigger — accountingWebhook' },
  { id: 'wh-outlook', name: 'Microsoft 365 — Outlook', events: 'Calendar, mail', azureTarget: 'HTTP Trigger — outlookWebhook (new)' },
  { id: 'wh-teams', name: 'Microsoft 365 — Teams', events: 'Channel message', azureTarget: 'HTTP Trigger — teamsWebhook (new)' },
];

// ── AUTH FLOWS → Entra ID (MSAL) ──────────────────────────────────────────
export const AUTH_FLOWS = [
  { id: 'auth-login', name: 'Login (email + password)', base44Source: 'loginViaEmailPassword', azureTarget: 'Entra ID — ROPC / MSAL sign-in' },
  { id: 'auth-register', name: 'Register + OTP verify', base44Source: 'register → verifyOtp → setToken', azureTarget: 'Entra ID — user create + invite redemption' },
  { id: 'auth-google', name: 'Google OAuth', base44Source: 'loginWithProvider("google")', azureTarget: 'Entra ID — external identity provider (Google)' },
  { id: 'auth-forgot', name: 'Forgot password', base44Source: 'resetPasswordRequest', azureTarget: 'Entra ID — self-service password reset' },
  { id: 'auth-reset', name: 'Reset password', base44Source: 'resetPassword', azureTarget: 'Entra ID — self-service password reset' },
  { id: 'auth-session', name: 'Session token', base44Source: 'Base44 JWT token', azureTarget: 'MSAL token cache + Entra ID session' },
  { id: 'auth-roles', name: 'Role-based access', base44Source: 'Staff.system_role / PermissionGroup', azureTarget: 'Entra ID app roles + PermissionGroup table' },
];

// ── INFRASTRUCTURE → Azure Services ───────────────────────────────────────
export const INFRASTRUCTURE = [
  { id: 'infra-frontend', layer: 'Frontend', base44Source: 'Base44 CDN (React + Vite)', azureTarget: 'Azure Static Web Apps' },
  { id: 'infra-db', layer: 'Database', base44Source: 'Base44 entities (MongoDB)', azureTarget: 'Azure SQL Database (UK South)' },
  { id: 'infra-api', layer: 'API / backend', base44Source: 'base44/functions (Deno)', azureTarget: 'Azure Functions Premium (Node 20)' },
  { id: 'infra-auth', layer: 'Auth', base44Source: 'Base44 Auth (email/OTP)', azureTarget: 'Microsoft Entra ID (MSAL)' },
  { id: 'infra-secrets', layer: 'Secrets', base44Source: 'Base44 secrets', azureTarget: 'Azure Key Vault' },
  { id: 'infra-files', layer: 'File storage', base44Source: 'Base44 files (UploadFile)', azureTarget: 'Azure Blob Storage + signed URLs' },
  { id: 'infra-realtime', layer: 'Realtime', base44Source: 'Base44 entity subscriptions', azureTarget: 'Azure SignalR Service' },
  { id: 'infra-email', layer: 'Email', base44Source: 'Base44 SendEmail', azureTarget: 'Azure Communication Services Email' },
  { id: 'infra-push', layer: 'Mobile push', base44Source: 'Base44 SendPushNotification', azureTarget: 'Azure Notification Hubs' },
  { id: 'infra-analytics', layer: 'Analytics', base44Source: 'Base44 analytics.track', azureTarget: 'Application Insights' },
];

// ── SUMMARY ───────────────────────────────────────────────────────────────
export const MIGRATION_SUMMARY = {
  entities: ENTITIES.length,
  functions: FUNCTIONS.length,
  webhooks: WEBHOOK_FUNCTIONS.length,
  scheduled: SCHEDULED_FUNCTIONS.length,
  onDemand: ON_DEMAND_FUNCTIONS.length,
  automations: AUTOMATIONS.length,
  agents: AGENTS.length,
  connectorWebhooks: CONNECTOR_WEBHOOKS.length,
  authFlows: AUTH_FLOWS.length,
  infrastructure: INFRASTRUCTURE.length,
};

// All parity items in a single flat array (for the matrix + progress tracking)
export const ALL_PARITY_ITEMS = [
  ...ENTITIES,
  ...FUNCTIONS,
  ...AUTOMATIONS,
  ...AGENTS,
  ...CONNECTOR_WEBHOOKS,
  ...AUTH_FLOWS,
  ...INFRASTRUCTURE,
];