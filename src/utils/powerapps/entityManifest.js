// Complete manifest of every Base44 entity in GC Mission Control.
// Used by the Dataverse schema generator to fetch each schema and convert it.

export const ENTITY_NAMES = [
  // Core operational
  'Staff', 'Job', 'RotaAssignment', 'InvestigationLog', 'SiteAsset', 'Vehicle',
  'DeliveryLog', 'Timesheet', 'TimesheetDelegation', 'StaffShift', 'StaffShift',
  'Absence', 'RecurringAbsence', 'ShiftSwap', 'StaffMessage', 'StaffReview',
  'HolidayPayAccrual', 'OvertimeRate', 'OvertimeSetting', 'RotaWeek',
  'RecurringDepotDuty', 'BankHoliday', 'ShutdownPeriod',

  // Financial / billing
  'AFP', 'AFPLineItem', 'AFPTemplate', 'CVR', 'CVRLineItem', 'VariationOrder',
  'BillingRule', 'RateCardItem', 'KeywordRateMapping', 'JobCostItem', 'DailyCost',
  'Invoice', 'PurchaseOrder', 'POAPriceLock', 'CashFlowEntry', 'JobBillingContract',
  'JobBillOfQuantities', 'ExpensePreset', 'CostPreset', 'PresetItem',
  'FinancialAuditLog', 'InvestigationSOR',

  // Compliance / safety
  'ComplianceItem', 'ComplianceTask', 'ComplianceConfig', 'SafetyReport',
  'ToolboxTalk', 'EnvironmentalReport', 'BriefingSignature', 'Signature',

  // Training
  'TrainingCourse', 'TrainingBooking', 'TrainingRequirement',

  // Assets / fleet
  'SiteAsset', 'Vehicle', 'VehicleMaintenanceBooking', 'VehicleLocationLog',
  'VehicleMOTHistory', 'ServiceRecord', 'DepreciationProfile',
  'EquipmentCalibration', 'EquipmentCatalogue', 'JobAssetAssignment',
  'AssetManifest', 'AssetReturnLog', 'ConsumableStockItem', 'GoodsInReceipt',
  'ScrapLog',

  // Geotechnical investigation
  'InvestigationLog', 'Sample', 'LabTestResult', 'MonitoringWell',
  'KeyLogBookWebhookLog',

  // People / org
  'Staff', 'Team', 'DrillingCrew', 'Division', 'DivisionAccessManifest',
  'DivisionSnapshot', 'PermissionGroup', 'Contractor', 'Supplier', 'Client',
  'ClientFeedback', 'HotelBooking', 'SubcontractorLog',

  // System / config
  'AppSetting', 'ConfigList', 'BusinessConfig', 'AutopilotControl',
  'AutomationControl', 'DashboardLayout', 'PowerBIDataset', 'BackupSchedule',
  'EmailAlertSetting', 'EmailTemplate', 'ReportTemplate', 'CustomField',
  'SystemAuditLog', 'JobType', 'JobDocument', 'JobMilestone', 'JobDelayLog',
  'JobComment', 'JobPack', 'SitePhoto', 'WeatherLog', 'PortalBranding',
  'LoginBranding', 'Reward', 'RewardRedemption', 'IncentiveScore', 'Achievement',
  'StaffLocationLog', 'StaffGeofenceEvent', 'GeofenceEvent', 'DeliveryLeg',

  // Integration configs
  'KeyLogBookConfig', 'MittiConfig', 'AssetPandaConfig',

  // Help
  'HelpTopic',
];

// De-duplicated list (some entities appear in multiple groups above)
export const UNIQUE_ENTITY_NAMES = [...new Set(ENTITY_NAMES)].sort();

export const ENTITY_COUNT = UNIQUE_ENTITY_NAMES.length;