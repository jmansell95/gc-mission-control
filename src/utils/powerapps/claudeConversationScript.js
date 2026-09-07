// Generates a single plain-text "Claude Conversation Script" — 12 sequential
// prompts (one per migration phase). Each prompt is self-contained: it carries
// the Dataverse table definitions, Power Automate flow specs, Power Fx blocks
// and connector guide that phase needs, so the user pastes ONE prompt into
// Claude per phase and Claude produces step-by-step paste instructions.

import { BUILD_ORDER } from './claudeBuildBrief';
import { convertEntityToDataverse } from './dataverseConverter';
import { generateFlowDocument } from './flowGenerator';
import { generatePowerFxDocument } from './powerFxSource';
import { generateIntegrationGuide } from './integrationGuideContent';
import { ALL_FLOWS } from './flowManifest';

// --- Per-phase Dataverse tables (Phase 1 gets every table) ---
const PHASE_ENTITIES = {
  2: ['Staff', 'PermissionGroup', 'Team', 'Division', 'DivisionAccessManifest'],
  3: ['Job', 'JobType', 'JobMilestone', 'JobDocument', 'JobComment', 'JobDelayLog', 'SiteAsset', 'JobAssetAssignment', 'Vehicle', 'VehicleMaintenanceBooking', 'VehicleMOTHistory', 'ComplianceItem', 'ComplianceTask', 'ToolboxTalk', 'SafetyReport', 'ConfigList', 'AppSetting', 'EmailAlertSetting', 'SystemAuditLog', 'KeyLogBookConfig', 'MittiConfig', 'AssetPandaConfig'],
  4: ['RotaAssignment', 'StaffLocationLog', 'StaffGeofenceEvent', 'DeliveryLog', 'DeliveryLeg', 'InvestigationLog', 'SitePhoto', 'BriefingSignature', 'Timesheet', 'TrainingBooking'],
  5: ['AFP', 'AFPLineItem', 'AFPTemplate', 'CVR', 'CVRLineItem', 'VariationOrder', 'BillingRule', 'RateCardItem', 'KeywordRateMapping', 'JobCostItem', 'DailyCost', 'Invoice', 'PurchaseOrder', 'POAPriceLock', 'CashFlowEntry', 'JobBillingContract', 'JobBillOfQuantities', 'FinancialAuditLog', 'SubcontractorLog'],
  6: ['RotaAssignment', 'RotaWeek', 'DrillingCrew', 'Absence', 'RecurringAbsence', 'RecurringDepotDuty', 'BankHoliday', 'ShutdownPeriod', 'ShiftSwap', 'HotelBooking'],
  7: ['InvestigationLog', 'Sample', 'LabTestResult', 'MonitoringWell', 'KeyLogBookWebhookLog', 'KeyLogBookConfig', 'InvestigationSOR', 'EquipmentCalibration'],
  9: ['PowerBIDataset', 'ReportTemplate', 'DashboardLayout'],
  10: ['EmailAlertSetting', 'EmailTemplate', 'AutopilotControl', 'AutomationControl'],
  11: ['BackupSchedule', 'DivisionSnapshot'],
};

// --- Per-phase Power Automate flows (Phase 8 gets every flow not used elsewhere) ---
const PHASE_FLOW_MATCHERS = {
  2: /^(syncStaffUserRoles|syncStaffDivisionFromTeam|ensureMyStaffProfile|getMyStaffProfile|getUnlinkedUsers|sendStaffInvite|sendBrandedInvite|sendWelcomeEmail|updateMyOnboarding|deduplicateStaff|processStaffUpload|getDivisionScopedData)$/,
  3: /^(logSystemAudit|getConfigListUsage|getSettingsHubStats|cloneJob|notifyNewJob|notifyJobStatusChange|geocodeJobAddress|reGeocodeAllJobs|splitMultiSiteJobs|migrateJobDisciplines|migrateJobTeamTypes|startDecommissioning|completeDecommissioning|checkComplianceExpiry|checkVehicleMaintenance|checkAssetCompliance|checkAllJobsAssetCompliance|syncAssetCompliance|updateAssetComplianceOnMaintenance|autoBookMaintenance|notifyMaintenanceBooking|notifyTrainingBooking|classifyTrainingCertificates|commitTrainingImport|redirectRigToJob|validateRigTooling|manageEmailAlerts)$/,
  4: /^(updateMyAssignment|acknowledgeSchedule|submitDailyTimesheet|recordStaffLocation|confirmHomeLocation|resolveAssetByQR|resolveConsumableByBarcode|commitBasketSignOut|commitConsumableUsage|uploadProfilePhoto|updateMyEmailPreference|createDeliveryTimesheetEntry|logBriefingAsTask|requestStaffTraining|redeemReward|getJobWeatherStatus|refreshScannedAsset|optimizeDailyRoute|processSiteCollection|stampRigOnSiteFromDelivery|bookAssetToStaff|processAssetReturn|retryAssetReturnSync|detectAutoBreaks|greenPathApproveTimesheet|mergeWeeklyTimesheet|notifyTimesheetSubmitted|checkGeofencePresence)$/,
  5: /afp|cvr|invoice|billing|charge|retention|poa|ratecard|masterpricelist|sorupload|ewr|boq|stripe|accounting|vendor|statements|cashflow|profitab|subconmargin|jobfinancials|financialaudit|internalcostrates|concur|budget|milestone/i,
  6: /^(publishRotaWeek|generateRotaPDF|syncPermanentCrew|cleanupDuplicateAssignments|replaceShiftsWithLeave|suggestCrewAllocation|validateRigAssignments|sendScheduleEmail|sendAssignmentNotification|importPlannerSpreadsheet|resetAssignmentBriefing|notifyAbsenceRequest|syncBankHolidays|runWeatherRostering|syncBobAbsences|pushAbsenceToBob|bobWebhook|migrateCrews|autoGenerateTransferLegs|getStaffICalFeed)$/,
  7: /^(importAGS|syncKeyLogBook|approveKeyLogBookLogs|backfillKlbDurations|generateDelayLogFromRemarks|approveDelayLog|autoCreateBillingFromRemarks|resolveLogPricing|stampBillingCharge|generateJobAGSExport|syncOpenGround|checkGeotechAlerts|autoBuildDailyTimesheets|runDelayPrediction)$/,
  9: /^(syncPowerBI|sendScheduledReports|generateJobReport|generateJobPack|exportPayroll|runClientWeeklyReport|getRigProfitability|getCrewEarnings|getVehicleUtilisation|generateWeeklyOpsDigest|getEnterpriseStats|getVehicleLocationHistory|getVehicleSafetyEvents|getRouteComparison)$/,
  10: /^(sendDailyReminders|sendWeeklyProgressReport|generateMonthlyStatements|runPayrollAutopilot|runTrainingCompliance|sendCrewWhatsApp|whatsappWebhook|sendDailyStandup|sendDailyTimesheetSummary|calculateHolidayAccruals|calculateShiftDifferentials|calculateWeeklyIncentives|checkSiteWeatherAlerts|checkFloodRisk|logDailyWeather|syncMetOfficeWeather|checkDriverSafety|checkIdleVehicles|checkMileageDiscrepancies|checkPredictiveMaintenance|predictMaintenance|checkInventoryAlerts|checkSiteReadiness)$/,
  11: /^(incrementalImport|csvBulkImport|batchProcessImport|backupDivision|restoreDivision|runScheduledBackups|resetDatabase|seedDemoData|importLegacyArchive|importPrehistoricSnapshot|purgeCompletedJobs|reclassifyGhostJobs|backfillDivisionTags|migrateToDivisions)$/,
};

// --- Per-phase Power Fx screen sections (matched against the "## " headings) ---
const PHASE_POWERFX = {
  4: [/^App /, /LoginScreen/, /ScheduleScreen/, /ShiftWizardScreen/, /LogActivityScreen/, /ProfileScreen/, /DeliveryDashboardScreen/, /ScannerScreen/, /Offline Sync Pattern/, /Build Instructions/],
  5: [/AFPBuilderScreen/],
  6: [/RotaBuilderScreen/],
  9: [/AdminDashboardScreen/],
};

function resolvePhaseFlows() {
  const assigned = {};
  const used = new Set();
  for (const [phase, rx] of Object.entries(PHASE_FLOW_MATCHERS)) {
    assigned[phase] = ALL_FLOWS.filter((f) => rx.test(f));
    assigned[phase].forEach((f) => used.add(f));
  }
  assigned[8] = ALL_FLOWS.filter((f) => !used.has(f));
  return assigned;
}

function splitPowerFxSections() {
  const doc = generatePowerFxDocument();
  const parts = doc.split(/\n(?=## )/);
  const preamble = parts.filter((p) => !p.startsWith('## ') || /Setup Checklist|How to Use|Naming Conventions/.test(p.split('\n')[0]));
  const sections = parts.filter((p) => p.startsWith('## ')).map((p) => ({ heading: p.split('\n')[0].replace(/^## /, ''), body: p }));
  return { preamble: preamble.join('\n'), sections };
}

const rule = (ch = '=') => ch.repeat(78);

function phasePrompt(p, ctx) {
  const { schemaMap, flowsByPhase, powerFx } = ctx;
  const n = p.phase;
  let out = '';

  out += `${rule()}\n`;
  out += `PROMPT ${n + 1} OF ${BUILD_ORDER.length}  —  PHASE ${n}: ${p.title.toUpperCase()}\n`;
  out += `${rule()}\n`;
  out += `>>> COPY FROM THE LINE BELOW AND PASTE INTO CLAUDE AS ONE MESSAGE <<<\n\n`;

  out += `We are now on Phase ${n} of 11 of the GC Mission Control → Microsoft Power Platform migration: "${p.title}".\n\n`;
  out += `Build in: ${p.tool}\n`;
  out += `Paste target: ${p.pasteTarget}\n\n`;
  out += `PHASE STEPS (what must be true when this phase is complete):\n`;
  p.steps.forEach((s, i) => { out += `  ${i + 1}. ${s}\n`; });
  out += '\n';

  out += `Everything you need for this phase is inline below — do NOT ask me for any other file.\n\n`;

  // Dataverse tables
  const entities = n === 1 ? Object.keys(schemaMap) : (PHASE_ENTITIES[n] || []);
  if (entities.length) {
    out += `${rule('-')}\nINLINE MATERIAL A — DATAVERSE TABLE DEFINITIONS (${entities.length} tables)\n${rule('-')}\n`;
    if (n !== 1) out += `(These tables were created in Phase 1. They are repeated here so you can reference exact column schema names when building this phase.)\n\n`;
    for (const name of entities) {
      const schema = schemaMap[name];
      out += schema
        ? convertEntityToDataverse(name, schema)
        : `## Table: ${name}\n\nSchema Name: gc_${name.toLowerCase()}\n(Schema not loaded — create from base44/entities/${name}.jsonc)\n\n---\n\n`;
    }
  }

  // Flows
  const flows = flowsByPhase[n] || [];
  if (flows.length) {
    out += `${rule('-')}\nINLINE MATERIAL B — POWER AUTOMATE FLOW DEFINITIONS (${flows.length} flows)\n${rule('-')}\n\n`;
    flows.forEach((f) => { out += generateFlowDocument(f); });
  }

  // Power Fx
  const fxMatchers = PHASE_POWERFX[n] || [];
  if (fxMatchers.length) {
    const picked = powerFx.sections.filter((s) => fxMatchers.some((rx) => rx.test(s.heading)));
    out += `${rule('-')}\nINLINE MATERIAL C — CANVAS APP POWER FX SOURCE (${picked.length} screens)\n${rule('-')}\n\n`;
    if (n === 4) out += powerFx.preamble + '\n\n';
    picked.forEach((s) => { out += s.body + '\n\n'; });
  }

  // Integration guide
  if (n === 8) {
    out += `${rule('-')}\nINLINE MATERIAL D — INTEGRATION & CONNECTOR SETUP GUIDE\n${rule('-')}\n\n`;
    out += generateIntegrationGuide() + '\n\n';
  }

  // What Claude must produce
  out += `${rule('-')}\nWHAT I NEED FROM YOU NOW\n${rule('-')}\n`;
  out += `Turn the material above into exact, numbered, click-by-click paste instructions I can follow in the Power Platform web UI. For every item:\n`;
  out += `  - Tell me the exact URL / app to open and the menu path to click.\n`;
  out += `  - Tell me the exact field or property to paste into and give me the exact text to paste (schema names, option-set values, flow actions, Power Fx) — copy them verbatim from the material above, never abbreviate or use "etc."\n`;
  out += `  - Tell me what to click next and what I should see on screen if it worked.\n`;
  out += `Work in batches of roughly 8–10 tables / flows / screens. After each batch stop and wait for me to reply "next" before continuing. If I reply with an error message, diagnose it and tell me the fix before moving on.\n`;
  out += `Respect the ordering rules: global Option Sets before the columns that use them; parent tables before child tables with Lookups; flows before the Power Fx that calls them via .Run().\n\n`;

  out += `VALIDATION CHECKPOINT (run this with me once every batch is done):\n${p.validation}\n`;
  out += `When I type "checkpoint", walk me through each check above one at a time and ask me to confirm the result. Only when every check passes, tell me: "Phase ${n} complete — paste Prompt ${n + 2} to begin Phase ${n + 1}."\n\n`;
  out += `>>> STOP COPYING HERE <<<\n\n\n`;
  return out;
}

export function generateClaudeConversationScript(schemaList) {
  const schemaMap = {};
  for (const { name, schema } of schemaList) schemaMap[name] = schema;
  const ctx = { schemaMap, flowsByPhase: resolvePhaseFlows(), powerFx: splitPowerFxSections() };
  const date = new Date().toISOString().split('T')[0];

  let out = '';
  out += `${rule()}\n`;
  out += `GC MISSION CONTROL — CLAUDE CONVERSATION SCRIPT\n`;
  out += `Power Platform migration · ${BUILD_ORDER.length} phase prompts · generated ${date}\n`;
  out += `${rule()}\n\n`;
  out += `HOW TO USE THIS FILE\n\n`;
  out += `1. Open claude.ai and start ONE new conversation. Keep using the same conversation for the whole migration.\n`;
  out += `2. Paste PROMPT 0 (the role-setting prompt) first.\n`;
  out += `3. Paste PROMPT 1 (Phase 0). Follow Claude's instructions batch by batch, replying "next" after each batch.\n`;
  out += `4. When Claude says the phase is complete, come back here and paste the next prompt.\n`;
  out += `5. Repeat through PROMPT ${BUILD_ORDER.length} (Phase 11). Each prompt already contains every schema, flow and Power Fx block that phase needs — you never need another file.\n\n`;
  out += `Some prompts are very long (Phase 1 carries every table definition). claude.ai accepts long pastes — it will attach the text automatically. Paste the whole block between the >>> COPY / STOP <<< markers each time.\n\n\n`;

  out += `${rule()}\nPROMPT 0  —  SET CLAUDE'S ROLE (paste this first)\n${rule()}\n`;
  out += `>>> COPY FROM THE LINE BELOW AND PASTE INTO CLAUDE AS ONE MESSAGE <<<\n\n`;
  out += `You are an expert Microsoft Power Platform developer (Dataverse, model-driven apps, canvas apps, Power Automate, Power BI, Power Pages). I am migrating an operations platform called GC Mission Control off Base44 and rebuilding it 1:1 inside the Power Platform. I am the hands — I click and paste in the web UIs. You are the brain — you read the build material I paste and turn it into exact, numbered, click-by-click instructions.\n\n`;
  out += `Ground rules for the entire conversation:\n`;
  out += `- I will paste one phase prompt at a time (12 in total). Each contains the full inline material for that phase. Never ask me for another file.\n`;
  out += `- Always use the exact gc_ schema names, option-set values and control names from the material — never rename, abbreviate or summarise them.\n`;
  out += `- Work in batches of 8–10 items and wait for me to say "next" between batches.\n`;
  out += `- If I paste an error, diagnose and fix it before moving on.\n`;
  out += `- Every phase ends with a validation checkpoint. When I type "checkpoint", walk me through it and only declare the phase complete when everything passes.\n\n`;
  out += `Reply with "Ready — paste Prompt 1 to begin Phase 0." and nothing else.\n\n`;
  out += `>>> STOP COPYING HERE <<<\n\n\n`;

  for (const p of BUILD_ORDER) out += phasePrompt(p, ctx);

  out += `${rule()}\nEND OF SCRIPT — when Phase 11 passes its checkpoint, GC Mission Control is fully live on the Power Platform.\n${rule()}\n`;
  return out;
}