import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Printer, CheckCircle2, AlertTriangle, Database, Users, LayoutGrid, Smartphone, Receipt, Calendar, FlaskConical, Workflow, BarChart3, Bell, GitMerge, ShieldCheck, Layers, Clock, DollarSign, Zap, Globe } from 'lucide-react';

const BRAND_DARK = '#2E5A1A';
const BRAND_LEAF = '#8DC63F';

const PHASES = [
  { n: 0, name: 'Foundation & Environment Setup', icon: ShieldCheck, weeks: 2, color: '#475569', deps: [],
    summary: 'Provision the Power Platform environment, Dataverse, Entra ID SSO, solution structure, and the data-type mapping master sheet.',
    steps: [
      'Provision a Production Power Platform environment + a Dev/Sandbox environment in the Microsoft 365 tenant.',
      'Create the Dataverse database in both environments (select region = UK South).',
      'Register an Entra ID app registration for the Power Apps SSO (redirect URIs for canvas + model-driven apps).',
      'Create the unmanaged solution in Dev ("GC Mission Control") and the managed solution in Prod.',
      'Establish maker security groups (Makers, Admins, Field App Users) and assign Power Apps licences.',
      'Create the Data Type Mapping master sheet (Excel in SharePoint) — one row per Base44 entity → Dataverse table, listing field types, enums, and relationships. Every later phase references this sheet.',
      'Configure environment-level DLP policies (allow Dataverse, Outlook, SharePoint, Power BI; block consumer connectors).',
      'Confirm the Power BI workspace provisioning for embedded dashboards.',
    ] },
  { n: 1, name: 'Core Data Schema Migration (Dataverse)', icon: Database, weeks: 3, color: '#0ea5e9', deps: [0],
    summary: 'Recreate every Base44 entity as a Dataverse table, preserving field types, enums, relationships, and division-scoped RLS.',
    steps: [
      'Create the core Dataverse tables: gc_staff, gc_job, gc_rotaassignment, gc_investigationlog, gc_siteasset, gc_vehicle, gc_deliverylog, gc_timesheet, gc_afp, gc_afplineitem, gc_cvr, gc_complianceitem, gc_supplier, gc_contractor, gc_permissiongroup, gc_helptopic.',
      'Create the supporting tables (~40): gc_client, gc_team, gc_drillingcrew, gc_trainingcourse, gc_trainingbooking, gc_hotelbooking, gc_sample, gc_labtestresult, gc_billingrule, gc_ratecarditem, gc_jobcostitem, gc_purchaseorder, gc_invoice, gc_vehiclemaintenancebooking, gc_toolboxtalk, gc_safetyreport, gc_systemauditlog, gc_appsetting, gc_configlist, gc_division, gc_absence, gc_recurringabsence, gc_recurringdepotduty, gc_bankholiday, gc_shutdownperiod, gc_keylogbookconfig, gc_mitticonfig, gc_emailalertsetting, gc_stafflocationlog, gc_staffgeofenceevent, gc_jobassetassignment, gc_subcontractorlog, gc_dailycost, gc_jobmilestone, gc_jobcomment, gc_sitephoto, gc_jobdocument, gc_monitoringwell, gc_equipmentcalibration, gc_consumablestockitem, gc_goodsinreceipt, gc_scraplog.',
      'For each table, recreate every field with the matching Dataverse type: Text → Text, Number → Whole/Decimal, Boolean → Yes/No, enum → Choice (Option Set), date → Date Only, datetime → Date and Time, array → Related (N:N or N:1), file_url → URL.',
      'Recreate all enum choice columns as global Option Sets (worker_type, assignment_type, log_type, sheet_name, status, dispute_status, etc.) so they are reusable across tables.',
      'Build the table relationships: 1:N (Job → RotaAssignment, Staff → RotaAssignment, Job → InvestigationLog, AFP → AFPLineItem, Staff → Timesheet, Vehicle → VehicleMaintenanceBooking) and N:N (Staff ↔ Team, Staff ↔ TrainingRequirement).',
      'Recreate the built-in fields: id → primary key (GUID), created_date → Created On, updated_date → Modified On, created_by_id → Created By (system).',
      'Recreate division-scoped RLS: add a gc_divisionid column to every division-scoped table, then create Dataverse security roles per division with row-level filters (division = user division OR division = null OR role = admin).',
      'Build the data migration pipeline: export each Base44 entity to CSV via the Base44 API → store in SharePoint → import to Dataverse via Power Query Dataflows → validate record counts match.',
      'Run a test migration on the Dev environment and sign off record counts against the Base44 source.',
    ] },
  { n: 2, name: 'Staff & Permission Model', icon: Users, weeks: 2, color: '#8b5cf6', deps: [1],
    summary: 'Build the Staff table relationships, recreate the four permission groups as Dataverse security roles, and wire Entra ID SSO auto-matching.',
    steps: [
      'Build the gc_staff relationships: worker_type (direct_employee / subcontractor / agency), crew_parent_id (self-reference to gc_staff), permission_group_id (→ gc_permissiongroup), division_id (→ gc_division), team_id (→ gc_team), agency_id (→ gc_supplier).',
      'Create the four permission groups as Dataverse security roles: Super Admin, Admin, Office, Field — each with the per-hub none/read/write privilege matrix (Overview, Jobs, Scheduling, Staff, Logistics, Assets, Fleet, Investigation, Compliance, Billing, Reports, Settings).',
      'Map each hub privilege to Dataverse table privileges (e.g. Billing write = Append/Write on gc_afp + gc_afplineitem + gc_invoice).',
      'Create Entra ID security groups mirroring the four permission groups and assign the Dataverse security roles to them.',
      'Build a Power Automate flow triggered by Entra ID sign-in events: on first login, look up the user email in gc_staff, and if found, set their system_role and division from the Staff record. If not found, route to a "pending access" screen.',
      'Recreate the Staff onboarding flow (photo + phone first-login screen) as a canvas app screen gated on gc_staff.onboarding_complete = false.',
      'Recreate the syncStaffUserRoles logic: when a Staff record permission_group_id changes, a Dataverse plugin updates the user Entra ID group membership.',
      'Migrate all existing Staff records from Base44, preserving the crew_parent_id hierarchy so subcontractor parent companies and their individual crew members stay linked.',
    ] },
  { n: 3, name: 'Model-Driven Admin Hubs', icon: LayoutGrid, weeks: 4, color: '#14b8a6', deps: [2],
    summary: 'Build model-driven apps for Staff, Jobs, Assets, Fleet, Compliance, and Settings — forms, views, and business process flows mirroring the current admin modules.',
    steps: [
      'Build the "GC Staff Hub" model-driven app: Staff form (with worker_type, crew pairing, contacts array, permission group, division), Staff views (active, by team, by worker type), and the Crew Profiles / Contacts / Training tabs as sub-grids.',
      'Build the "GC Jobs Hub" model-driven app: Job form (multi-discipline array as a child table gc_jobdiscipline), Job views (active, by status, by division), and the Job detail tabs (Overview, Crew, Logistics, Boreholes, Financials, Documents) as sub-grids and form sections.',
      'Build the "GC Assets Hub" model-driven app: SiteAsset form (rig flag, compliance, weight), Asset views (by type, by status, by job), and the Rig Detail drawer as a form with sub-grids for assignments and maintenance.',
      'Build the "GC Fleet Hub" model-driven app: Vehicle form, Vehicle views (active, by maintenance status, by division), MOT history sub-grid, maintenance bookings sub-grid.',
      'Build the "GC Compliance Hub" model-driven app: ComplianceItem form, views (expiring, expired, by staff, by category), ToolboxTalk form + views, SafetyReport form + views.',
      'Build the "GC Settings" model-driven app: ConfigList manager (Option Sets editor), PermissionGroup editor, Division manager, EmailAlertSetting manager, KeyLogBookConfig, MittiConfig, AppSetting manager.',
      'Recreate the ConfigList dropdown system as Dataverse global Option Sets + a central gc_configlist table for non-enum lists (asset types, revenue streams, job types).',
      'Recreate the SystemAuditLog: enable Dataverse auditing on every table, and build a plugin that writes a gc_systemauditlog record on every create/update/delete with the user, timestamp, field, old value, and new value.',
      'Build the app navigation (sitemap) mirroring the current admin sidebar: Overview, Jobs, Scheduling, Staff, Logistics, Assets, Fleet, Investigation, Compliance, Billing, Reports, Settings.',
      'Configure business process flows for the Job lifecycle (Planning → In Progress → Decommissioning → Completed) and the Staff onboarding (Invited → Onboarded → Active).',
    ] },
  { n: 4, name: 'Canvas Field-Crew Mobile App', icon: Smartphone, weeks: 5, color: '#f59e0b', deps: [2],
    summary: 'Build the canvas app for field crew — My Schedule, My Profile, Deliveries, Scanner, and the Shift Wizard with native GPS, camera, signature, and offline sync.',
    steps: [
      'Create the "GC Field Crew" canvas app (tablet layout, mobile-first) and configure the Power Apps Mobile offline profile (download Staff, RotaAssignment, Job, SiteAsset for the current user).',
      'Build the My Schedule screen: today rota card, weekly rota cards, the schedule splash/acknowledge screen, and the "next job" prompt. Data bound to gc_rotaassignment filtered by staff_id = current user.',
      'Build the My Profile screen: avatar + phone editor, compliance wallet (flip card with training certificates), training history, ID card, tracking consent + signature, email notification toggle.',
      'Build the Deliveries screen (driver hub): today delivery legs, the load manifest, the safe-to-drive panel, the route order, and the sign-off modal with signature + photo + GPS.',
      'Build the Scanner screen: device camera barcode scan → resolve asset by QR → sign-out / sign-in flow with the scan basket. Use the native BarcodeScanner control.',
      'Build the Shift Wizard screens: Daily Checks (Mitti form links + verification badges) → Arrive on Site (geolocation confirm + POWRA link) → Site Briefing (sign) → Working Step (progress notes, meterage) → End of Shift (travel-from-site, hours, signature).',
      'Use the native Geolocation sensor for GPS tracking (Location.Latitude / Location.Longitude) — write to gc_stafflocationlog on a timer while the shift is active. Note: background tracking is limited to foreground app usage (see Risk Register).',
      'Use the native Camera control for all photo capture (site photos, delivery evidence, compliance certificates).',
      'Use the native Signature capture (PenInput control) for briefing signatures, end-of-day signatures, delivery signatures, and tracking consent.',
      'Configure the offline sync: when offline, writes go to a local collection; on reconnect, a Power Automate flow syncs the collection to Dataverse.',
      'Build the push notification registration (Power Apps Notifications connector) so the crew receives schedule and assignment alerts.',
      'Test the canvas app on iOS and Android via the Power Apps mobile app.',
    ] },
  { n: 5, name: 'Financial Hub (AFP + CVR)', icon: Receipt, weeks: 6, color: '#ef4444', deps: [3, 4],
    summary: 'Rebuild the AFP and CVR builders as a canvas + model-driven hybrid — the hardest parity proof. Dual-side tables, rate-card matching, dispute workflow, auto-population.',
    steps: [
      'Build the gc_afp table: job_id, period_start, period_end, status (draft/submitted/agreed/paid), total_claimed, agreed_total, vat, type (lump_sum/ewr).',
      'Build the gc_afplineitem table: afp_id, job_id, sheet_name (measured_works/variations/ewr_rotary_drilling/ewr_cp_drilling/ewr_rotary_dayworks/ewr_cp_dayworks/ewr_enabling_crew/ewr_accommodation/ewr_misc/ewr_hires/ewr_mileage/materials/compensation_item), category, item_ref, item, unit, unit_price, qty, rate, amount, qty_complete, gross_applied, previous_applied, applied_in_period, assessed_qty, gross_assessed, previous_assessed, assessed_in_period, balance_qty, balance_value, vo_ref, vo_date, time_impact, time_impact_days, dispute_status, dispute_note, original_amount, agreed_amount, dispute_history (JSON), week_breakdown (JSON), source, source_id, is_manual, is_variation_breakdown, sort_order.',
      'Build the AFP Builder canvas app: the dual-side claim/assessment table (editable grid), the sheet tabs (Measured Works, Variations, EWR Drilling, EWR Dayworks, Enabling Crew, Accommodation, Misc, Hires, Mileage, Materials), the totals strip, and the submit-to-client action.',
      'Build the Variation Summary tab + the per-Ref breakdown tab system (each VO Ref spawns a dedicated breakdown sub-grid).',
      'Build the rate-card matching engine as a Power Automate flow: on AFP line create, fuzzy-match the item description against gc_ratecarditem and stamp the unit_price + rate. Flag low-confidence matches for review.',
      'Build the dispute workflow: line item dispute_status state machine (none → disputed → counter_offered → agreed/rejected) with a dispute history JSON column and a dispute note editor.',
      'Build the auto-populate-from-field-data flow: a scheduled Power Automate flow that reads approved InvestigationLog + Timesheet + DeliveryLog + SubcontractorLog records for the AFP period and creates/updates gc_afplineitem records (source = driller_log / timesheet / delivery / subcontractor).',
      'Build the CVR builder (gc_cvr + gc_cvrlineitem) with the same line-item structure, the AFP → CVR push flow, and the CVR export-to-Excel flow.',
      'Build the billing rules engine (gc_billingrule) and the charge calculator as a Power Automate flow invoked from the canvas app.',
      'Build the invoice generation flow: from an agreed AFP, create a gc_invoice record with the line items, VAT, and totals, and generate a PDF via the Word template connector.',
      'Build the aged-debtors dashboard as a Power BI report embedded in the Financial Hub model-driven app.',
      'Build the AFP/CVR Excel export flows (exportAFPToExcel, exportCVRToExcel) using the Excel connector + a template workbook in SharePoint.',
      'Sign off: prove that a full AFP can be built, populated, disputed, agreed, and invoiced end-to-end with 1:1 parity.',
    ] },
  { n: 6, name: 'Rota Builder', icon: Calendar, weeks: 4, color: '#ec4899', deps: [3, 4],
    summary: 'Recreate the Weekly Rota Builder as a canvas app with drag-and-drop crew-to-rig assignment, crew pairings, conflict detection, smart-fill, and publish.',
    steps: [
      'Build the Rota Builder canvas app: week navigator, staff grid (grouped by main job), day columns, and the assignment cards.',
      'Implement drag-and-drop crew-to-rig assignment using the Power Apps draggable gallery pattern (or a reorderable gallery + a "move to" dialog for touch devices).',
      'Build the crew-pairing logic: Lead Driller + Second Man assigned to the same rig on the same date share a crew_pairing_id. Build a Crew-Rig Assignment modal that creates both RotaAssignment records atomically.',
      'Build the conflict detection: a flow that flags double-booked staff (assigned to a job AND yard/depot on the same day, or two jobs) and stamps has_conflict + conflict_note.',
      'Build the smart-fill (copy last week) and the template week copy (copy forward N weeks) as Power Automate flows invoked by buttons.',
      'Build the permanent-crew recurring pattern: a scheduled flow that generates gc_rotaassignment rows from the Job.permanent_crew array for each working day in the pattern.',
      'Build the leave/absence overlay: show approved absences, recurring absences, bank holidays, and shutdown periods as coloured banners on the rota cells.',
      'Build the publish workflow: a Power Automate flow that emails each assigned staff member their personal schedule (Outlook connector + branded HTML template), sets the RotaWeek status to published, and activates any jobs that move to in_progress.',
      'Build the rota PDF export as a Power Automate flow (generate Rota PDF via the Word/Excel template connector or a Power BI paginated report).',
      'Replace the real-time subscription model: instead of push updates, use Power Automate push notifications on rota change + a "refresh on open" pattern in the canvas app.',
      'Build the compliance-block modal: on publish, a flow checks for compliance violations (expired training, missing certificates) and blocks publication with a force-override option.',
      'Build the staff swap modal and the per-staff rota manager (edit dates, shift by days, remove from job).',
    ] },
  { n: 7, name: 'Investigation & Borehole Data', icon: FlaskConical, weeks: 4, color: '#6366f1', deps: [3],
    summary: 'Recreate the Investigation Hub — borehole cards, AGS import, KeyLogBook webhook, driller remarks professionalisation, and the site log review queue.',
    steps: [
      'Build the Investigation Hub model-driven app: borehole cards grouped by job, the borehole drill-down (depth, strata, SPT, samples, groundwater), and the site log timeline.',
      'Build the AGS import flow: a Power Automate flow (HTTP trigger or file-upload trigger from SharePoint) that parses the AGS file (text parsing in Power Automate expressions or an Azure Function wrapped as a custom connector — note: pure Power Automate AGS parsing is complex; see Risk Register) and writes gc_investigationlog + gc_sample records.',
      'Build the KeyLogBook webhook receiver: a Power Automate flow with an HTTP trigger (When an HTTP request is received) that validates the bearer token / HMAC signature, parses the AGS payload, and writes borehole + remark records. Store the webhook URL in KeyLogBookConfig.',
      'Build the driller remarks professionalisation: an AI Builder flow (or Azure OpenAI connector) that takes the raw driller remark text and returns a professionalised, report-ready description. Store both raw_remarks and description.',
      'Build the site log review queue: a model-driven view of gc_investigationlog where manager_review_status = pending, with approve/query actions that stamp the reviewer, timestamp, and note.',
      'Build the geotech QC dashboards as Power BI reports: borehole completion status, SPT N-value distribution, strata summary, sample chain-of-custody.',
      'Build the auto-pricing flow: on InvestigationLog create, match the log_type + description against gc_billingrule and stamp charge_amount + billing_rule_id.',
      'Build the auto-timesheet generation: on approved keylogbook_remarks logs, create a gc_timesheet record for the driller with the activity duration.',
      'Build the OpenGround export flow (syncOpenGround) as a Power Automate flow that writes AGS-formatted data to an OpenGround endpoint.',
      'Build the borehole completion status fallback (Dates + Depth first, Data coverage fallback) as a calculated column + a flow.',
    ] },
  { n: 8, name: 'Integration Replacement (Power Automate)', icon: Workflow, weeks: 6, color: '#0d9488', deps: [1, 2],
    summary: 'Map all 200+ Base44 backend functions to Power Automate flows — scheduled, instant, and HTTP-triggered. Replace the Base44 SDK with Dataverse connector actions.',
    steps: [
      'Create a master flow inventory (Excel in SharePoint): one row per Base44 function → Power Automate flow name, trigger type (scheduled/instant/HTTP), connectors used, Dataverse tables touched, and the phase that consumes it.',
      'Build the scheduled flows (recurrence triggers): checkComplianceExpiry (daily), checkVehicleMaintenance (daily), checkSiteWeatherAlerts (daily), checkBillingReadiness (daily), checkOverdueInvoices (daily), sendDailyReminders (daily), sendWeeklyProgressReport (weekly), generateMonthlyStatements (monthly), runPayrollAutopilot (monthly), runTrainingCompliance (weekly), runWeatherRostering (daily), runScheduledBackups (daily), syncBankHolidays (yearly), autoBuildDailyTimesheets (daily), sendDailyTimesheetSummary (daily), sendDailyStandup (daily).',
      'Build the instant flows (manual button / Dataverse trigger): approveDelayLog, approveKeyLogBookLogs, publishRotaWeek, submitAFPToClient, generateJobReport, generateJobPack, exportAFPToExcel, exportCVRToExcel, exportCVRPack, exportPayroll, generateRotaPDF, calculateJobFinancials, optimizeDailyRoute, suggestCrewAllocation, repriceAFPFromRateCard, recalculateCVR, refreshAllDraftAFPs, populateAFPFromFieldData, lockPOAPrice, redeemReward, cloneJob, splitMultiSiteJobs, geocodeJobAddress, reGeocodeAllJobs.',
      'Build the HTTP-trigger flows (When an HTTP request is received): geotabWebhook, assetPandaWebhook, holmanWebhook, receiveMittiData, importAGS, bobWebhook, whatsappWebhook, stripeWebhook, zapierWebhook, accountingWebhook, receivePhoneGps, recordStaffLocation. Store the generated URLs in the relevant config tables and update the third-party dashboards.',
      'Build the pull-sync flows (scheduled + HTTP connector): syncKeyLogBook, syncGeotabFleet, syncGeotabTimesheets, syncAssetPanda, syncHolmanFleet, syncConcurExpenses, syncBobAbsences, syncMetOfficeWeather, syncMitti, syncOpenGround, syncPowerBI, syncAccounting.',
      'Build the notification flows (instant + Outlook / Teams / WhatsApp connector): sendAssignmentNotification, sendScheduleEmail, sendStaffInvite, sendWelcomeEmail, sendBrandedInvite, sendCrewWhatsApp, notifyNewJob, notifyJobStatusChange, notifyTimesheetSubmitted, notifyTrainingBooking, notifyMaintenanceBooking, notifyAbsenceRequest, pushMilestoneToClient, sendScheduledReports, sendClientWeeklyReport, generateWeeklyOpsDigest.',
      'Build the AI flows (AI Builder / Azure OpenAI connector): generateDelayLogFromRemarks, runDelayPrediction, suggestCrewAllocation, classifyTrainingCertificates, predictMaintenance, resolveLogPricing, autoCreateBillingFromRemarks.',
      'Build the data-maintenance flows: cleanupDuplicateAssignments, deduplicateStaff, migrateCrews, migrateJobDisciplines, migrateJobTeamTypes, migrateToDivisions, backfillDivisionTags, backfillKlbDurations, reclassifyGhostJobs, purgeCompletedJobs, incrementalImport, batchProcessImport, csvBulkImport, importPlannerSpreadsheet, importLegacyArchive, importPrehistoricSnapshot, importConcurReconciliation, importEWRApplicationData, importInternalCostRates, processStaffUpload, processRateCardUpload, processMasterPriceListUpload, processSORUpload, processEWRRateCardUpload, commitAFPParse, commitCVRParse, commitTrainingImport, commitGoodsIn, commitConsumableUsage, commitBasketSignOut.',
      'Build the asset/vehicle flows: bookAssetToStaff, processAssetReturn, resolveAssetByQR, resolveConsumableByBarcode, refreshScannedAsset, confirmAssetPandaLink, confirmPandaScanLink, pushAllToAssetPanda, pushAssetPhotoToPanda, pushAssetUpdateToPanda, pushSignOutToPanda, testAssetPandaConnection, getAssetPandaObject, getAssetPandaImages, getAssetPandaGroupFields, getAssetPandaLinkReview, syncAssetCompliance, updateAssetComplianceOnMaintenance, stampRigOnSiteFromDelivery, redirectRigToJob, validateRigAssignments, validateRigTooling, syncVehicleOperator, getVehicleLocationHistory, getVehicleSafetyEvents, getVehicleUtilisation, checkDriverSafety, checkIdleVehicles, checkMileageDiscrepancies, checkVehicleMaintenance, autoBookMaintenance, predictMaintenance, checkPredictiveMaintenance.',
      'Build the compliance/safety flows: checkAllJobsAssetCompliance, checkAssetCompliance, checkComplianceExpiry, checkSiteReadiness, checkGeofencePresence, checkGeotechAlerts, checkFloodRisk, checkSiteWeatherAlerts, checkInventoryAlerts, runTrainingCompliance, checkSubconMargin, checkRetentionStatus, checkMilestoneTriggers, checkBOQVariations, checkJobBudgetAlerts, checkBillingReadiness, checkInvoiceDiscrepancies, checkOverdueInvoices, chaseOverdueInvoices, autoCreateAFPFromMilestone, autoBillAssetOnSite, autoGenerateInvoice, autoMatchVendorInvoice, autoGenerateTransferLegs, activateBillingContract, releaseRetention, recordFinancialAudit, logSystemAudit, logBriefingAsTask, logDailyWeather, calculateHolidayAccruals, calculateShiftDifferentials, calculateWeeklyIncentives, detectAutoBreaks, greenPathApproveTimesheet, submitDailyTimesheet, mergeWeeklyTimesheet, createDeliveryTimesheetEntry, processSiteCollection, processOffHire, startDecommissioning, completeDecommissioning, resetAssignmentBriefing, confirmHomeLocation, ensureMyStaffProfile, getMyStaffProfile, updateMyAssignment, updateMyOnboarding, updateMyEmailPreference, uploadProfilePhoto, requestStaffTraining, acknowledgeSchedule, replaceShiftsWithLeave, retryAssetReturnSync, syncPermanentCrew, syncPortalFeedbackToJobStatus, syncStaffDivisionFromTeam, syncStaffUserRoles, syncBillableItemToAFP, pushAFPToCVR, pushAbsenceToBob, stampBillingCharge, calculateCharge, resolveLogPricing, recalculateDepreciation, recalculateUsageMaintenance, recalculateCVR, autoPopulateNewAFP, refreshScannedAsset, redeemReward, getCrewEarnings, getRigProfitability, runRigProfitabilityCheck, runCashFlowForecast, getJobWeatherStatus, getPortalBranding, getJobByPortalToken, addPortalComment, approvePortalDocument, getStaffICalFeed, getConfigListUsage, getUnlinkedUsers, getSettingsHubStats, getDivisionScopedData, getEnterpriseStats, validateCompaniesHouse, verifyCIS, resetDatabase, seedDemoData, restoreDivision, backupDivision, generateJobAGSExport, generateJobReport, generateJobPack, generateRotaPDF, generateMonthlyStatements, generateWeeklyOpsDigest, generateDelayLogFromRemarks, autoCreateBillingFromRemarks, sendScheduledReports, sendClientWeeklyReport.',
      'Replace every Base44 SDK entity call (base44.entities.X.create/update/filter/list) in the migrated logic with the Dataverse connector (Add a new row / Update a row / List rows).',
      'Set up the flow-run monitoring: create a Power BI dashboard on the Power Automate flow-run analytics data to catch failures.',
    ] },
  { n: 9, name: 'Dashboards, Reports & Power BI', icon: BarChart3, weeks: 3, color: '#3b82f6', deps: [5, 6, 7],
    summary: 'Replace the custom React dashboard widgets with Power BI dashboards embedded in the model-driven apps. Recreate the report builder and scheduled reports.',
    steps: [
      'Create the "GC Mission Control Dashboards" Power BI workspace and a semantic model connected to Dataverse (DirectQuery or import with scheduled refresh).',
      'Build the Rig Performance dashboard: rig leaderboard, metres drilled, earnings, utilisation, on-site status.',
      'Build the Rig Profitability dashboard: revenue vs cost per rig, margin %, drilling efficiency.',
      'Build the Crew Utilisation dashboard: hours per crew member, overtime, billable vs non-billable.',
      'Build the Cash-Flow Forecast dashboard: invoiced vs received, aged debtors, forecast by job.',
      'Build the Compliance Overview dashboard: expiring certificates, training gaps, compliance score.',
      'Build the Billing Readiness dashboard: AFPs in draft, disputed, agreed, invoiced, paid.',
      'Build the Project Health dashboard: job status, budget vs actual, meterage vs target, delays.',
      'Embed each Power BI dashboard in the relevant model-driven app (Overview, Financial Hub, Compliance Hub, Reports Hub) using the Power BI embedded control.',
      'Build the custom report builder as a Power BI report library: a set of parameterised paginated reports (Rig Performance, Crew Performance, Job Report, Rota PDF, AFP Excel, CVR Excel) that the user runs from the Reports Hub.',
      'Build the scheduled-report emailer: Power Automate flows that export a Power BI report as a PDF/Excel attachment and email it to a recipient list on a schedule (sendScheduledReports).',
      'Build the Power BI export-to-Excel flow for the AFP and CVR builders.',
      'Configure row-level security in the Power BI semantic model so division-scoped users only see their division data.',
    ] },
  { n: 10, name: 'Automation & Notifications', icon: Bell, weeks: 2, color: '#a855f7', deps: [8],
    summary: 'Recreate all scheduled automations, the email alert template system, and the push-notification system for the mobile crew app.',
    steps: [
      'Recreate the daily reminder flow (sendDailyReminders): for each staff member with a rota assignment today, send a push notification + email with their schedule.',
      'Recreate the weekly progress report flow (sendWeeklyProgressReport): email each staff member their week completed shifts, meterage, and timesheets.',
      'Recreate the monthly statement flow (generateMonthlyStatements): generate a PDF statement per client and email to the client contact.',
      'Recreate the payroll autopilot flow (runPayrollAutopilot): collate approved timesheets, calculate pay, export a payroll CSV.',
      'Recreate the training compliance flow (runTrainingCompliance): check expiring certificates, auto-book refresher courses, notify staff + managers.',
      'Recreate the weather rostering flow (runWeatherRostering): pull the weather forecast, flag jobs at risk, suggest schedule changes.',
      'Build the EmailAlertSetting template system: a gc_emailalertsetting table with subject, intro_message, template, accent_color, banner_title, recipient_emails. A generic "Send Branded Email" flow reads the template and sends via the Outlook connector with the Ground Control branded HTML wrapper.',
      'Build the push-notification system: a "Send Crew Notification" flow that sends a Power Apps notification to a staff member device (title, content, action_label, action_url).',
      'Build the WhatsApp notification flow (sendCrewWhatsApp) using the Twilio WhatsApp connector or the Power Automate WhatsApp Business connector.',
      'Build the autopilot toast/banner system: when an automation runs, it stamps an AutopilotControl record that the canvas app surfaces as a toast.',
    ] },
  { n: 11, name: 'Data Cutover & Decommission', icon: GitMerge, weeks: 2, color: '#dc2626', deps: [3, 4, 5, 6, 7, 8, 9, 10],
    summary: 'Run the final data migration, validate, switch DNS, cut over webhooks, run in parallel, then decommission Base44.',
    steps: [
      'Run the final delta migration from Base44 to Dataverse: export all records modified since the last sync, import to Dataverse, validate record counts and financial totals (AFP totals, invoice totals, timesheet hours) against the Base44 source.',
      'Switch the custom domain DNS to the Power Apps portal (Power Pages for the client portal, the model-driven app URL for the admin hub, the canvas app URL for the field crew).',
      'Cut over the external webhook endpoints: update KeyLogBook, Geotab, Asset Panda, Holman, Mitti, Bob HR, Concur, Stripe, WhatsApp dashboards to point at the new Power Automate HTTP trigger URLs.',
      'Run both systems in parallel for a defined period (recommended 2-4 weeks): keep Base44 read-only, write new records to Dataverse only, and reconcile daily.',
      'Train the office staff on the model-driven admin hubs and the field crew on the canvas app.',
      'Decommission the Base44 app: unpublish, archive the data export, and cancel the Base44 subscription.',
      'Post-go-live hypercare: a 2-week period with daily check-ins to catch and fix any parity gaps.',
    ] },
];

const PARITY_MATRIX = [
  ['Authentication', 'Microsoft Entra ID SSO', 'Native — Entra is the Power Platform identity provider', '0'],
  ['Staff Directory', 'gc_staff Dataverse table + model-driven app', 'Native', '2-3'],
  ['Permission Groups', 'Dataverse security roles', 'Native — replaces custom permission_group_id logic', '2'],
  ['Jobs / Projects Hub', 'gc_job + model-driven app', 'Native', '3'],
  ['Rota Builder (drag-drop)', 'Canvas app + Dataverse', 'Reorderable gallery — touch drag is less smooth than web DnD', '6'],
  ['Crew-Rig Assignment', 'Canvas app + flow', 'Native', '6'],
  ['Rota Publish + Email', 'Power Automate flow + Outlook connector', 'Native', '6'],
  ['Real-time rota updates', 'Push notifications + refresh-on-open', 'Native equivalent — no true push to the grid', '6'],
  ['Field Crew Mobile App', 'Canvas app (Power Apps Mobile)', 'Native', '4'],
  ['GPS Tracking (background)', 'Power Apps Geolocation sensor', 'NATIVE EQUIVALENT — foreground only; no true background tracking (see Risk Register)', '4'],
  ['Offline Sync', 'Power Apps Mobile offline profile', 'Native', '4'],
  ['Barcode Scanning', 'BarcodeScanner control', 'Native', '4'],
  ['Signature Capture', 'PenInput control', 'Native', '4'],
  ['Camera / Photos', 'Camera control', 'Native', '4'],
  ['Shift Wizard', 'Canvas app screens', 'Native', '4'],
  ['AFP Builder (dual-side)', 'Canvas app + Dataverse', 'Native — complex but achievable', '5'],
  ['CVR Builder', 'Canvas app + Dataverse', 'Native', '5'],
  ['Rate-Card Matching', 'Power Automate flow', 'Native — fuzzy match via expressions', '5'],
  ['Invoice Generation', 'Power Automate + Word template', 'Native', '5'],
  ['Aged Debtors', 'Power BI dashboard', 'Native', '5-9'],
  ['Investigation Hub', 'Model-driven app + Power BI', 'Native', '7'],
  ['AGS File Parsing', 'Power Automate flow (text parsing) or custom connector', 'NATIVE EQUIVALENT — complex AGS parsing in pure Power Automate is hard (see Risk Register)', '7'],
  ['KeyLogBook Webhook', 'Power Automate HTTP trigger flow', 'Native', '7'],
  ['Driller Remarks AI', 'AI Builder / Azure OpenAI connector', 'Native', '7'],
  ['Site Log Review', 'Model-driven view + flows', 'Native', '7'],
  ['Assets Hub', 'Model-driven app', 'Native', '3'],
  ['Fleet Hub', 'Model-driven app', 'Native', '3'],
  ['Compliance Hub', 'Model-driven app', 'Native', '3'],
  ['Training Matrix', 'Model-driven app + Power BI', 'Native', '3-9'],
  ['Delivery Dashboard', 'Canvas app + Dataverse', 'Native', '4'],
  ['Route Optimisation', 'Power Automate + Bing Maps connector', 'Native — replaces Google Maps Directions', '8'],
  ['Geotab Sync', 'Power Automate scheduled flow + HTTP connector', 'Native', '8'],
  ['Asset Panda Sync', 'Power Automate scheduled flow + HTTP connector', 'Native', '8'],
  ['Holman Sync', 'Power Automate scheduled flow + HTTP connector', 'Native', '8'],
  ['Mitti Webhook', 'Power Automate HTTP trigger flow', 'Native', '8'],
  ['Bob HR Sync', 'Power Automate scheduled flow + HTTP connector', 'Native', '8'],
  ['Concur Sync', 'Power Automate scheduled flow + HTTP connector', 'Native', '8'],
  ['HMRC CIS Verification', 'Power Automate flow + HTTP connector', 'Native', '8'],
  ['Stripe Payments', 'Power Automate HTTP trigger flow', 'Native', '8'],
  ['WhatsApp Notifications', 'Twilio WhatsApp connector', 'Native', '10'],
  ['Email Alerts (branded)', 'Power Automate + Outlook connector + HTML template', 'Native', '10'],
  ['Push Notifications', 'Power Apps Notifications connector', 'Native', '10'],
  ['Dashboard Widgets', 'Power BI embedded dashboards', 'Native — replaces custom React widgets', '9'],
  ['Custom Report Builder', 'Power BI report library', 'Native', '9'],
  ['Scheduled Reports', 'Power Automate + Power BI export', 'Native', '9'],
  ['Client Portal', 'Power Pages site', 'Native', '3-9'],
  ['System Audit Log', 'Dataverse auditing + plugin', 'Native', '3'],
  ['Division RLS', 'Dataverse security roles + row filters', 'Native', '1-2'],
  ['ConfigList Dropdowns', 'Dataverse Option Sets + gc_configlist', 'Native', '3'],
  ['Help Guides', 'gc_helptopic + Power Pages', 'Native', '3'],
];

const RISKS = [
  { feature: 'Background GPS Tracking', current: 'Custom webview + Capacitor wrapper + external GPS app webhook for true background tracking', powerApps: 'Power Apps Geolocation sensor only tracks while the app is in the foreground', impact: 'High', mitigation: 'Use the existing external GPS app webhook strategy (receivePhoneGps flow) for true background tracking; the canvas app geolocation is a foreground supplement.' },
  { feature: 'Real-time Rota Updates', current: 'Base44 entity subscriptions push updates to the open rota grid instantly', powerApps: 'No equivalent push-to-grid; must use refresh-on-open + push notifications', impact: 'Medium', mitigation: 'Refresh the rota grid on screen focus + send a push notification when a manager publishes a change. Accept a few seconds of staleness.' },
  { feature: 'AGS File Parsing Fidelity', current: 'Custom TypeScript AGS parser handles all AGS groups (LOCA, GEOL, SAMP, SPT, CORE, TREM, WSTG, SHFT, DLOG, HDIA, PTIM, HDPH, DREM, HORN)', powerApps: 'Pure Power Automate text parsing is limited; complex multi-group AGS parsing may need a custom connector wrapping an Azure Function', impact: 'High', mitigation: 'Wrap the existing AGS parser as an Azure Function exposed via a custom connector. This is the one acceptable external dependency — it stays inside the Microsoft ecosystem.' },
  { feature: 'Custom Borehole Visualisations', current: 'Custom React borehole drill-down with depth scale, strata column, SPT chart, groundwater marker', powerApps: 'Canvas apps cannot render custom SVG depth columns; Power BI can render them but not inline in a form', impact: 'Medium', mitigation: 'Render the borehole visualisation as a Power BI report embedded in the Investigation Hub model-driven app. Slightly less integrated but visually equivalent.' },
  { feature: 'Custom PDF Generation', current: 'jsPDF generates branded Rota PDFs, AFP Excel exports, CVR packs, ID cards, accommodation PDFs', powerApps: 'Power Automate Word/Excel templates + Power BI paginated reports cover most cases but are less flexible', impact: 'Medium', mitigation: 'Use Word templates for branded documents (Rota, ID card, accommodation) and Excel templates for AFP/CVR. Accept minor layout differences.' },
  { feature: 'Drag-and-Drop Rota on Touch', current: '@hello-pangea/dnd works on both desktop and touch', powerApps: 'Canvas app reorderable galleries are less smooth on touch for cross-row drag', impact: 'Medium', mitigation: 'Use a "tap to select → tap target cell to move" pattern on mobile, and a drag gallery on desktop. Slightly different UX but same outcome.' },
  { feature: 'Flow Run Limits', current: 'Base44 backend functions run without per-run limits', powerApps: 'Power Automate has per-user/per-month flow run limits depending on licence tier', impact: 'Medium', mitigation: 'Consolidate high-frequency flows (e.g. GPS logging) into batch flows, and budget for the Premium tier. Monitor flow-run consumption.' },
  { feature: 'LLM Cost Control', current: 'InvokeLLM with model selection controls cost per call', powerApps: 'AI Builder credits are consumed per call; Azure OpenAI connector bills per token', impact: 'Low', mitigation: 'Use AI Builder for high-volume structured tasks (remarks professionalisation) and Azure OpenAI for complex reasoning. Monitor credit burn.' },
];

const LICENSING = [
  { item: 'Power Apps Per User Plan', qty: '50 users (30 office + 20 field)', unit: '£16.60/user/month', total: '£830/mo' },
  { item: 'Power Apps Per App Plan (field crew)', qty: '20 field crew (alt to Per User)', unit: '£4.50/user/app/month', total: '£90/mo (if eligible)' },
  { item: 'Power Automate Per User Plan', qty: '50 users', unit: '£11.30/user/month', total: '£565/mo' },
  { item: 'Power Automate Per Flow Plan (unattended flows)', qty: '5 flows (high-volume scheduled)', unit: '£442/flow/month', total: '£2,210/mo' },
  { item: 'Power BI Pro', qty: '50 users', unit: '£7.80/user/month', total: '£390/mo' },
  { item: 'Power BI Premium Per User', qty: 'Optional — for paginated reports', unit: '£16.90/user/month', total: '£845/mo (optional)' },
  { item: 'AI Builder Credits', qty: '~50,000 credits/mo (remarks, delay prediction)', unit: 'Pay-as-you-go or add-on', total: '~£200/mo' },
  { item: 'Azure OpenAI (alt to AI Builder)', qty: 'Token-based', unit: '~£0.01-0.03 per remark', total: '~£100/mo' },
  { item: 'Twilio WhatsApp Business API', qty: '~15 crew + managers', unit: 'Per-message', total: '~£50/mo' },
  { item: 'Dataverse Storage', qty: 'Included up to capacity; ~10GB est.', unit: 'Included / £7.50/GB over', total: 'Minimal' },
  { item: 'Power Pages (Client Portal)', qty: 'Per-logged-in-user or per-page-view', unit: '£75/100 users/mo or PAYG', total: '~£75/mo' },
  { item: 'Custom Connector / Azure Function (AGS parser)', qty: '1 function app', unit: 'Consumption plan', total: '~£20/mo' },
];

const TOTAL_WEEKS = PHASES.reduce((s, p) => Math.max(s, p.weeks + (p.deps.length ? Math.max(...p.deps.map(d => PHASES.find(x => x.n === d)?.weeks || 0)) : 0)), 0);

export default function PowerAppsMigrationRoadmap() {
  const [checked, setChecked] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pa-migration-checked') || '{}'); } catch { return {}; }
  });
  const toggle = (key) => {
    const next = { ...checked, [key]: !checked[key] };
    setChecked(next);
    localStorage.setItem('pa-migration-checked', JSON.stringify(next));
  };
  const totalSteps = PHASES.reduce((s, p) => s + p.steps.length, 0);
  const doneSteps = Object.values(checked).filter(Boolean).length;
  const pct = Math.round((doneSteps / totalSteps) * 100);

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Screen header — hidden on print */}
      <div className="print:hidden sticky top-0 z-20 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Link to="/admin" className="inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-900 text-sm font-medium">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <div className="h-5 w-px bg-slate-200" />
          <h1 className="text-base font-bold text-slate-900">Power Apps Migration Roadmap</h1>
          <span className="hidden sm:inline text-xs text-slate-500">{pct}% complete ({doneSteps}/{totalSteps} steps)</span>
        </div>
        <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#2E5A1A] text-white rounded-lg text-sm font-semibold hover:bg-[#1c4a12] transition">
          <Printer className="w-4 h-4" /> Print / Save as PDF
        </button>
      </div>

      {/* A3 landscape print area */}
      <div className="powerapps-roadmap-print-area bg-white mx-auto" style={{ maxWidth: '1170px' }}>
        {/* === PAGE 1: Executive Summary + Architecture + Gantt === */}
        <section className="print-page px-8 py-6" style={{ width: '1170px', minHeight: '827px' }}>
          {/* Title banner */}
          <div className="rounded-2xl overflow-hidden mb-5" style={{ background: `linear-gradient(135deg, ${BRAND_DARK} 0%, #1c4a12 55%, ${BRAND_LEAF} 100%)` }}>
            <div className="px-7 py-5 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-white/70 font-semibold">GC Mission Control</p>
                  <h1 className="text-3xl font-extrabold tracking-tight mt-0.5">Microsoft Power Apps Migration Roadmap</h1>
                  <p className="text-sm text-white/80 mt-1">Like-for-like capability parity · Hybrid (model-driven + canvas) · Native equivalents · A3 landscape</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-white/60">Estimated duration</p>
                  <p className="text-2xl font-extrabold">{TOTAL_WEEKS} weeks</p>
                  <p className="text-xs text-white/60 mt-0.5">{PHASES.length} phases · {totalSteps} steps</p>
                </div>
              </div>
            </div>
          </div>

          {/* Executive summary */}
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
              <h2 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-1.5"><Layers className="w-4 h-4" style={{ color: BRAND_DARK }} /> Hybrid Architecture</h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                <strong>Model-driven apps</strong> for the data-heavy admin CRUD screens (Staff, Jobs, Assets, Fleet, Compliance, Settings) — auto-generated forms and views over Dataverse tables, fast to build, standardised UI.
              </p>
              <p className="text-xs text-slate-600 leading-relaxed mt-2">
                <strong>Canvas apps</strong> for the custom-UX field crew mobile experience (Shift Wizard, Scanner, Deliveries) and the complex builders (Rota, AFP, CVR) — hand-built screens with Power Fx, full control over layout.
              </p>
              <p className="text-xs text-slate-600 leading-relaxed mt-2">
                <strong>Power Automate</strong> replaces all 200+ Base44 backend functions. <strong>Power BI</strong> replaces the custom React dashboards. <strong>Power Pages</strong> hosts the client portal.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
              <h2 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-1.5"><Zap className="w-4 h-4" style={{ color: BRAND_DARK }} /> Sequencing Strategy</h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Phases are sequenced to <strong>prove parity on the hardest modules first</strong> (AFP in Phase 5, Rota in Phase 6) so that if a gap is found early, the plan can adapt before the easier modules are built.
              </p>
              <p className="text-xs text-slate-600 leading-relaxed mt-2">
                The foundation (Phases 0-2) and the canvas field app (Phase 4) run in parallel with the admin hubs (Phase 3) to compress the timeline. Integrations (Phase 8) run alongside the module builds.
              </p>
              <p className="text-xs text-slate-600 leading-relaxed mt-2">
                <strong>Goal:</strong> zero dependency on Base44. Everything inside the Microsoft Power Platform.
              </p>
            </div>
          </div>

          {/* Architecture diagram (CSS) */}
          <div className="rounded-xl border border-slate-200 p-4 mb-5">
            <h2 className="text-sm font-bold text-slate-800 mb-3">Architecture Map</h2>
            <div className="grid grid-cols-5 gap-2 text-center text-[10px]">
              <div className="rounded-lg p-2 text-white font-bold flex flex-col items-center justify-center" style={{ background: BRAND_DARK }}>
                <Users className="w-4 h-4 mb-1" /> Entra ID SSO
              </div>
              <div className="rounded-lg p-2 bg-slate-700 text-white font-bold flex flex-col items-center justify-center">
                <Database className="w-4 h-4 mb-1" /> Dataverse
              </div>
              <div className="rounded-lg p-2 text-white font-bold flex flex-col items-center justify-center" style={{ background: BRAND_LEAF, color: '#1c4a12' }}>
                <LayoutGrid className="w-4 h-4 mb-1" /> Model-Driven Apps
              </div>
              <div className="rounded-lg p-2 text-white font-bold flex flex-col items-center justify-center" style={{ background: BRAND_LEAF, color: '#1c4a12' }}>
                <Smartphone className="w-4 h-4 mb-1" /> Canvas Apps
              </div>
              <div className="rounded-lg p-2 bg-slate-700 text-white font-bold flex flex-col items-center justify-center">
                <Workflow className="w-4 h-4 mb-1" /> Power Automate
              </div>
            </div>
            <div className="grid grid-cols-5 gap-2 text-center text-[10px] mt-2">
              <div className="rounded-lg p-2 bg-slate-700 text-white font-bold flex flex-col items-center justify-center">
                <BarChart3 className="w-4 h-4 mb-1" /> Power BI
              </div>
              <div className="rounded-lg p-2 bg-slate-700 text-white font-bold flex flex-col items-center justify-center">
                <Globe className="w-4 h-4 mb-1" /> Power Pages
              </div>
              <div className="rounded-lg p-2 bg-slate-700 text-white font-bold flex flex-col items-center justify-center">
                <FlaskConical className="w-4 h-4 mb-1" /> AI Builder
              </div>
              <div className="rounded-lg p-2 bg-slate-700 text-white font-bold flex flex-col items-center justify-center">
                <Bell className="w-4 h-4 mb-1" /> Outlook / Teams
              </div>
              <div className="rounded-lg p-2 text-white font-bold flex flex-col items-center justify-center" style={{ background: BRAND_DARK }}>
                <Workflow className="w-4 h-4 mb-1" /> 200+ Flows
              </div>
            </div>
          </div>

          {/* Gantt chart */}
          <div className="rounded-xl border border-slate-200 p-4">
            <h2 className="text-sm font-bold text-slate-800 mb-3">Phased Timeline (Gantt)</h2>
            <div className="space-y-1.5">
              {PHASES.map(p => {
                const startWeek = p.deps.length ? Math.max(...p.deps.map(d => {
                  const dep = PHASES.find(x => x.n === d);
                  return dep ? dep.weeks + (dep.deps.length ? Math.max(...dep.deps.map(dd => PHASES.find(x => x.n === dd)?.weeks || 0)) : 0) : 0;
                })) : 0;
                return (
                  <div key={p.n} className="flex items-center gap-2">
                    <div className="w-48 flex-shrink-0 text-[10px] font-semibold text-slate-700 truncate">
                      P{p.n} · {p.name}
                    </div>
                    <div className="flex-1 relative h-5 bg-slate-100 rounded">
                      <div className="absolute top-0 bottom-0 rounded flex items-center px-2 text-[9px] font-bold text-white"
                        style={{ left: `${(startWeek / TOTAL_WEEKS) * 100}%`, width: `${(p.weeks / TOTAL_WEEKS) * 100}%`, background: p.color }}>
                        {p.weeks}w
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-2 text-[9px] text-slate-400 px-48">
              {Array.from({ length: Math.ceil(TOTAL_WEEKS / 4) + 1 }).map((_, i) => (
                <span key={i}>{i * 4}w</span>
              ))}
            </div>
          </div>
        </section>

        {/* === PAGES 2-N: Phase detail pages (2 phases per A3 page) === */}
        {PHASES.map((p, idx) => {
          const showOnPage = idx % 2 === 0;
          if (!showOnPage) return null;
          const p1 = p;
          const p2 = PHASES[idx + 1];
          return (
            <section key={p.n} className="print-page px-8 py-6" style={{ width: '1170px', minHeight: '827px', pageBreakBefore: idx > 0 }}>
              <div className="grid grid-cols-2 gap-5 h-full">
                {[p1, p2].filter(Boolean).map(phase => {
                  const Icon = phase.icon;
                  return (
                    <div key={phase.n} className="flex flex-col">
                      {/* Phase banner */}
                      <div className="rounded-xl overflow-hidden mb-3" style={{ background: phase.color }}>
                        <div className="px-4 py-2.5 text-white flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] uppercase tracking-wide text-white/70 font-semibold">Phase {phase.n} · {phase.weeks} weeks</p>
                            <h3 className="text-sm font-bold truncate">{phase.name}</h3>
                          </div>
                          {phase.deps.length > 0 && (
                            <span className="text-[9px] bg-white/20 px-1.5 py-0.5 rounded">Depends on P{phase.deps.join(', P')}</span>
                          )}
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-600 mb-3 leading-relaxed">{phase.summary}</p>

                      {/* Step checklist */}
                      <div className="space-y-1.5 flex-1">
                        {phase.steps.map((step, si) => {
                          const key = `${phase.n}-${si}`;
                          const isChecked = !!checked[key];
                          return (
                            <label key={si} className="flex items-start gap-2 cursor-pointer group">
                              <span
                                onClick={(e) => { e.preventDefault(); toggle(key); }}
                                className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition ${isChecked ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-slate-300 group-hover:border-emerald-400'}`}
                              >
                                {isChecked && <CheckCircle2 className="w-3 h-3 text-white" />}
                              </span>
                              <span className={`text-[10.5px] leading-snug ${isChecked ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                                {step}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}

        {/* === Parity Matrix page === */}
        <section className="print-page px-8 py-6" style={{ width: '1170px', minHeight: '827px', pageBreakBefore: true }}>
          <div className="rounded-xl px-4 py-2.5 mb-4 text-white" style={{ background: BRAND_DARK }}>
            <h2 className="text-base font-bold">Feature Parity Matrix</h2>
            <p className="text-xs text-white/70">Every current Base44 feature → its Power Apps replacement → native-equivalent note → phase</p>
          </div>
          <table className="w-full text-[10px] border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700">
                <th className="text-left px-2 py-1.5 font-bold border border-slate-200 w-1/4">Current Feature (Base44)</th>
                <th className="text-left px-2 py-1.5 font-bold border border-slate-200 w-1/4">Power Apps Replacement</th>
                <th className="text-left px-2 py-1.5 font-bold border border-slate-200 w-2/5">Native-Equivalent Note</th>
                <th className="text-center px-2 py-1.5 font-bold border border-slate-200 w-[10%]">Phase</th>
              </tr>
            </thead>
            <tbody>
              {PARITY_MATRIX.map((row, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                  <td className="px-2 py-1 border border-slate-200 font-medium text-slate-800">{row[0]}</td>
                  <td className="px-2 py-1 border border-slate-200 text-slate-600">{row[1]}</td>
                  <td className="px-2 py-1 border border-slate-200 text-slate-500">{row[2]}</td>
                  <td className="px-2 py-1 border border-slate-200 text-center font-semibold" style={{ color: BRAND_DARK }}>{row[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* === Risk Register page === */}
        <section className="print-page px-8 py-6" style={{ width: '1170px', minHeight: '827px', pageBreakBefore: true }}>
          <div className="rounded-xl px-4 py-2.5 mb-4 text-white" style={{ background: '#dc2626' }}>
            <h2 className="text-base font-bold flex items-center gap-2"><AlertTriangle className="w-5 h-5" /> Risk Register</h2>
            <p className="text-xs text-white/70">Features that will work differently under Power Apps native equivalents — read before starting</p>
          </div>
          <div className="space-y-2.5">
            {RISKS.map((r, i) => (
              <div key={i} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <h3 className="text-sm font-bold text-slate-800">{r.feature}</h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${r.impact === 'High' ? 'bg-red-100 text-red-700' : r.impact === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {r.impact} impact
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-[10.5px]">
                  <div>
                    <p className="font-semibold text-slate-500 uppercase text-[9px] tracking-wide mb-0.5">Current (Base44)</p>
                    <p className="text-slate-700">{r.current}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-500 uppercase text-[9px] tracking-wide mb-0.5">Power Apps</p>
                    <p className="text-slate-700">{r.powerApps}</p>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-100">
                  <p className="font-semibold text-slate-500 uppercase text-[9px] tracking-wide mb-0.5">Mitigation</p>
                  <p className="text-[10.5px] text-slate-700">{r.mitigation}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* === Licensing page === */}
        <section className="print-page px-8 py-6" style={{ width: '1170px', minHeight: '827px', pageBreakBefore: true }}>
          <div className="rounded-xl px-4 py-2.5 mb-4 text-white" style={{ background: BRAND_DARK }}>
            <h2 className="text-base font-bold flex items-center gap-2"><DollarSign className="w-5 h-5" /> Resource & Licensing Estimate</h2>
            <p className="text-xs text-white/70">Indicative monthly cost for 50 users (30 office + 20 field) — confirm with your Microsoft reseller</p>
          </div>
          <table className="w-full text-[11px] border-collapse mb-4">
            <thead>
              <tr className="bg-slate-100 text-slate-700">
                <th className="text-left px-3 py-2 font-bold border border-slate-200">Item</th>
                <th className="text-left px-3 py-2 font-bold border border-slate-200">Quantity</th>
                <th className="text-left px-3 py-2 font-bold border border-slate-200">Unit Price</th>
                <th className="text-right px-3 py-2 font-bold border border-slate-200">Est. Monthly</th>
              </tr>
            </thead>
            <tbody>
              {LICENSING.map((l, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                  <td className="px-3 py-1.5 border border-slate-200 font-medium text-slate-800">{l.item}</td>
                  <td className="px-3 py-1.5 border border-slate-200 text-slate-600">{l.qty}</td>
                  <td className="px-3 py-1.5 border border-slate-200 text-slate-600">{l.unit}</td>
                  <td className="px-3 py-1.5 border border-slate-200 text-right font-semibold text-slate-800">{l.total}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-bold">
                <td colSpan={3} className="px-3 py-2 border border-slate-200 text-right text-slate-700">Estimated total (core stack)</td>
                <td className="px-3 py-2 border border-slate-200 text-right text-slate-900">~£4,275/mo</td>
              </tr>
            </tfoot>
          </table>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
              <h3 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-1.5"><Clock className="w-4 h-4" style={{ color: BRAND_DARK }} /> Effort Estimate</h3>
              <ul className="text-[11px] text-slate-600 space-y-1">
                <li>• Total duration: <strong>{TOTAL_WEEKS} weeks</strong> (~{Math.ceil(TOTAL_WEEKS / 4)} months)</li>
                <li>• {PHASES.length} phases · {totalSteps} steps</li>
                <li>• Team: 1 Power Platform lead + 2 makers + 1 Power BI developer</li>
                <li>• Parallel running: 2-4 weeks at the end</li>
                <li>• Hypercare: 2 weeks post go-live</li>
              </ul>
            </div>
            <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
              <h3 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-1.5"><ShieldCheck className="w-4 h-4" style={{ color: BRAND_DARK }} /> Acceptance Criteria</h3>
              <ul className="text-[11px] text-slate-600 space-y-1">
                <li>• All {PHASES.length} phases signed off</li>
                <li>• Record counts match Base44 source</li>
                <li>• Financial totals reconcile to the penny</li>
                <li>• Field crew app tested on iOS + Android</li>
                <li>• All webhook endpoints cut over</li>
                <li>• Base44 app decommissioned</li>
              </ul>
            </div>
          </div>

          <div className="mt-4 text-center text-[10px] text-slate-400">
            GC Mission Control · Microsoft Power Apps Migration Roadmap · Generated {new Date().toLocaleDateString('en-GB')} · Print on A3 landscape
          </div>
        </section>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          @page { size: A3 landscape; margin: 8mm; }
          body { background: white !important; }
          .print:hidden { display: none !important; }
          .powerapps-roadmap-print-area { max-width: none !important; margin: 0 !important; }
          .print-page { page-break-after: always; break-after: page; width: 100% !important; min-height: auto !important; padding: 4mm !important; }
          .print-page:last-child { page-break-after: auto; }
        }
      `}</style>
    </div>
  );
}