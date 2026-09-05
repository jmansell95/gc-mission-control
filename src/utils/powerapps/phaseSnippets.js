// Per-phase code snippets for the Power Apps Migration A4 booklet.
// Each phase maps to a Power Fx excerpt, a compact Dataverse table schema,
// a representative Power Automate flow, and build tips to pad short pages.
// The flow JSON is generated from the existing flowGenerator (single source of truth).

import { generateAllFlowJSONs } from './flowGenerator';

// Build the full flow map once (memoised) — generateAllFlowJSONs is the only
// exported entry point, so we look individual flows up from its result.
let _allFlows = null;
function allFlows() {
  if (!_allFlows) {
    try {
      _allFlows = generateAllFlowJSONs();
    } catch (e) {
      _allFlows = {};
    }
  }
  return _allFlows;
}

// Produce a compact, readable JSON snippet for a flow (trigger + key fields only)
export function getCompactFlow(name) {
  if (!name) return '// (no flow for this phase)';
  try {
    const f = allFlows()[name];
    if (!f) return '// flow: ' + name;
    return JSON.stringify({
      name: f.name,
      description: f.description,
      trigger: f.trigger,
      dataverseTable: f.dataverseTable,
      category: f.category,
      odataFilter: f.odataFilter,
    }, null, 2);
  } catch (e) {
    return '// flow: ' + name;
  }
}

export const PHASE_SNIPPETS = {
  0: {
    dataverseTable: 'gc_division',
    powerFx: `App.OnStart =
    Set(varCurrentUser, LookUp(Staffs, gc_email = User().Email));
    Set(varLandingPage,
        Switch(varCurrentUser.gc_permission_group_id.Name,
            "Field", "ScheduleScreen",
            "AdminDashboardScreen"));
    Navigate(varLandingPage, ScreenTransition.None);`,
    dataverse: `{
  "table": "gc_division",
  "displayName": "Division",
  "primaryName": "gc_name",
  "columns": [
    { "name": "gc_name", "type": "Text", "max": 100 },
    { "name": "gc_code", "type": "Text", "max": 20 },
    { "name": "gc_brand_color", "type": "Text", "max": 20 },
    { "name": "gc_is_active", "type": "Yes/No", "default": true }
  ]
}`,
    flowName: 'syncBankHolidays',
    tips: [
      'Create the solution in a Dev environment first; export as managed to Prod.',
      'Set DLP policies before building flows to avoid connector rework.',
      'Assign Power Apps Per User licences to makers before importing the solution.',
    ],
  },
  1: {
    dataverseTable: 'gc_staff',
    powerFx: `// Reference Dataverse tables by their plural display name
ClearCollect(colStaff,
    Filter(Staffs, gc_is_active = true)
);
ClearCollect(colJobs,
    Filter(Jobs, gc_status = "in_progress")
);
// Lookup a single related record
Set(varJob, LookUp(Jobs, gc_jobid = ThisItem.gc_job_id));`,
    dataverse: `{
  "table": "gc_staff",
  "primaryName": "gc_name",
  "columns": [
    { "name": "gc_name", "type": "Text", "required": true },
    { "name": "gc_email", "type": "Text" },
    { "name": "gc_worker_type", "type": "Choice",
      "options": ["direct_employee","subcontractor","agency"] },
    { "name": "gc_division_id", "type": "Lookup", "target": "gc_division" },
    { "name": "gc_permission_group_id", "type": "Lookup", "target": "gc_permissiongroup" },
    { "name": "gc_is_active", "type": "Yes/No", "default": true }
  ]
}`,
    flowName: 'incrementalImport',
    tips: [
      'Create parent tables (Division, Staff, Job, Supplier) before child tables with lookups.',
      'Create global Option Sets before any column that references them.',
      'Enable Dataverse auditing on every table for the SystemAuditLog equivalent.',
    ],
  },
  2: {
    dataverseTable: 'gc_permissiongroup',
    powerFx: `// Route by permission group on startup
Set(varLandingPage,
    Switch(varCurrentUser.gc_permission_group_id.Name,
        "Super Admin", "AdminDashboardScreen",
        "Admin", "AdminDashboardScreen",
        "Office", "AdminDashboardScreen",
        "Field", "ScheduleScreen",
        "Read Only", "AdminDashboardScreen"
    )
);
Navigate(varLandingPage, ScreenTransition.None);`,
    dataverse: `{
  "table": "gc_permissiongroup",
  "primaryName": "gc_name",
  "columns": [
    { "name": "gc_name", "type": "Text", "required": true },
    { "name": "gc_is_read_only", "type": "Yes/No", "default": false },
    { "name": "gc_staff_type", "type": "Choice",
      "options": ["office","field","flexible"] },
    { "name": "gc_permissions", "type": "Multi-line", "max": 4000 }
  ]
}`,
    flowName: 'syncStaffUserRoles',
    tips: [
      'Create four Entra ID security groups mirroring the permission groups.',
      'Assign Dataverse security roles to the Entra groups, not individuals.',
      'Use a Power Automate flow to auto-match staff by email on first SSO login.',
    ],
  },
  3: {
    dataverseTable: 'gc_job',
    powerFx: `// AdminDashboardScreen — KPI tiles
lblActiveJobs.Text: CountRows(colActiveJobs)
lblCrewOnSite.Text: CountRows(Distinct(colTodayRotas, gc_staff_id))
lblShiftsToday.Text: CountRows(colTodayRotas)
// Auto-refresh every 5 minutes
timerRefresh.Duration: 300000
timerRefresh.OnTimerEnd: btnRefresh.OnSelect
timerRefresh.Repeat: true
timerRefresh.Start: true`,
    dataverse: `{
  "table": "gc_job",
  "primaryName": "gc_name",
  "columns": [
    { "name": "gc_name", "type": "Text", "required": true },
    { "name": "gc_job_reference", "type": "Text" },
    { "name": "gc_status", "type": "Choice",
      "options": ["planning","in_progress","decommissioning","completed","on_hold","cancelled"] },
    { "name": "gc_division_id", "type": "Lookup", "target": "gc_division" },
    { "name": "gc_start_date", "type": "Date Only" },
    { "name": "gc_end_date", "type": "Date Only" },
    { "name": "gc_budget_amount", "type": "Currency" }
  ]
}`,
    flowName: 'logSystemAudit',
    tips: [
      'Build model-driven apps for CRUD-heavy hubs — forms and views are auto-generated.',
      'Use business process flows for the Job lifecycle (Planning to Completed).',
      'Enable auditing on every table to replace the SystemAuditLog.',
    ],
  },
  4: {
    dataverseTable: 'gc_rotaassignment',
    powerFx: `ScheduleScreen.OnVisible =
    ClearCollect(colMyRota,
        Filter(RotaAssignments,
            gc_staff_id = varCurrentUser.gc_staffid &&
            gc_week_start = varWeekStart));
// Start shift from the assignment card
btnStartShift.OnSelect =
    'updateMyAssignment'.Run(ThisItem.gc_rotaassignmentid,
        JSON({status: "started", started_at: Text(Now())}));
    Navigate(ShiftWizardScreen, ScreenTransition.Fade,
        {varAssignmentId: ThisItem.gc_rotaassignmentid});`,
    dataverse: `{
  "table": "gc_rotaassignment",
  "primaryName": "gc_name",
  "columns": [
    { "name": "gc_staff_id", "type": "Lookup", "target": "gc_staff" },
    { "name": "gc_job_id", "type": "Lookup", "target": "gc_job" },
    { "name": "gc_assigned_date", "type": "Date Only", "required": true },
    { "name": "gc_week_start", "type": "Date Only", "required": true },
    { "name": "gc_status", "type": "Choice",
      "options": ["assigned","started","completed"] },
    { "name": "gc_rig_asset_id", "type": "Lookup", "target": "gc_siteasset" },
    { "name": "gc_crew_role", "type": "Choice",
      "options": ["lead_driller","second_man"] }
  ]
}`,
    flowName: 'updateMyAssignment',
    tips: [
      'Use the Power Apps Mobile offline profile to cache Staff, RotaAssignment, Job.',
      'Use native Geolocation, Camera, and PenInput controls for field capture.',
      'Gate the Shift Wizard steps with visible toggles on varStep.',
    ],
  },
  5: {
    dataverseTable: 'gc_afplineitem',
    powerFx: `AFPBuilderScreen.OnVisible =
    ClearCollect(colLineItems,
        Filter(AFPLineItems, gc_afp_id = varAFPId));
// Total claimed rolls up from line items
lblTotalClaimed.Text:
    "£" & Text(Sum(colLineItems, gc_applied_in_period), "#,##0.00")
// Submit AFP to client via flow
btnSubmitAFP.OnSelect:
    'submitAFPToClient'.Run(varAFPId);
    Notify("AFP submitted to client", NotificationType.Success);`,
    dataverse: `{
  "table": "gc_afplineitem",
  "primaryName": "gc_item",
  "columns": [
    { "name": "gc_afp_id", "type": "Lookup", "target": "gc_afp", "required": true },
    { "name": "gc_job_id", "type": "Lookup", "target": "gc_job", "required": true },
    { "name": "gc_sheet_name", "type": "Choice",
      "options": ["measured_works","variations","ewr_rotary_drilling","ewr_cp_drilling","materials"] },
    { "name": "gc_item", "type": "Text", "required": true },
    { "name": "gc_qty", "type": "Decimal" },
    { "name": "gc_rate", "type": "Currency" },
    { "name": "gc_applied_in_period", "type": "Currency" },
    { "name": "gc_dispute_status", "type": "Choice",
      "options": ["none","disputed","counter_offered","agreed","rejected"] }
  ]
}`,
    flowName: 'populateAFPFromFieldData',
    tips: [
      'Use an editable gallery for the dual-side claim/assessment table.',
      'Store dispute_history as a JSON multi-line column.',
      'Run a scheduled flow to auto-populate lines from approved field logs.',
    ],
  },
  6: {
    dataverseTable: 'gc_rotaassignment (crew pairing)',
    powerFx: `RotaBuilderScreen.OnVisible =
    ClearCollect(colStaff, Filter(Staffs, gc_is_active = true));
    ClearCollect(colRotas, Filter(RotaAssignments, gc_week_start = varSelectedWeek));
// Publish week — emails each crew member
btnPublishWeek.OnSelect =
    'publishRotaWeek'.Run(Text(varSelectedWeek, "yyyy-mm-dd"), false);
    Notify("Rota published — staff emailed", NotificationType.Success);
// Smart-fill from last week
btnSmartFill.OnSelect =
    Set(varLastWeek, DateAdd(varSelectedWeek, -7, Days));
    ClearCollect(colLast, Filter(RotaAssignments, gc_week_start = varLastWeek));`,
    dataverse: `{
  "table": "gc_rotaassignment (crew pairing)",
  "columns": [
    { "name": "gc_crew_pairing_id", "type": "Text",
      "note": "Shared ID linking Lead Driller + Second Man on the same rig" },
    { "name": "gc_crew_role", "type": "Choice",
      "options": ["lead_driller","second_man"] },
    { "name": "gc_rig_asset_id", "type": "Lookup", "target": "gc_siteasset" },
    { "name": "gc_has_conflict", "type": "Yes/No", "default": false },
    { "name": "gc_conflict_note", "type": "Text" },
    { "name": "gc_assignment_type", "type": "Choice",
      "options": ["job","annual_leave","sick","training","yard_depot"] }
  ]
}`,
    flowName: 'publishRotaWeek',
    tips: [
      'Use a reorderable gallery for drag-and-drop on desktop; tap-to-move on mobile.',
      'Stamp crew_pairing_id on both crew members so they move as a unit.',
      'Run a conflict-detection flow on publish; block if compliance violations exist.',
    ],
  },
  7: {
    dataverseTable: 'gc_investigationlog',
    powerFx: `LogActivityScreen.OnVisible =
    Set(varLog, Patch(Defaults(InvestigationLogs), {
        gc_job_id: varJobId,
        gc_staff_id: varCurrentUser.gc_staffid,
        gc_date: Today(),
        gc_source: "staff"
    }));
// Save log (online) or queue (offline)
btnSaveLog.OnSelect =
    If(Connection.Connected,
        Patch(InvestigationLogs, Defaults(InvestigationLogs), varLog);
        Notify("Log saved", NotificationType.Success),
        Collect(colOfflineLogs, varLog);
        Notify("Saved offline", NotificationType.Info)
    );`,
    dataverse: `{
  "table": "gc_investigationlog",
  "primaryName": "gc_description",
  "columns": [
    { "name": "gc_job_id", "type": "Lookup", "target": "gc_job", "required": true },
    { "name": "gc_staff_id", "type": "Lookup", "target": "gc_staff", "required": true },
    { "name": "gc_date", "type": "Date Only", "required": true },
    { "name": "gc_log_type", "type": "Choice",
      "options": ["borehole_progress","sample_collection","installation","grouting_works","other"] },
    { "name": "gc_borehole_ref", "type": "Text" },
    { "name": "gc_depth_from", "type": "Decimal" },
    { "name": "gc_depth_to", "type": "Decimal" },
    { "name": "gc_source", "type": "Choice",
      "options": ["staff","ags_import","keylogbook_remarks"] },
    { "name": "gc_manager_review_status", "type": "Choice",
      "options": ["pending","approved","queried"] }
  ]
}`,
    flowName: 'importAGS',
    tips: [
      'Wrap the AGS parser as an Azure Function exposed via a custom connector.',
      'Use AI Builder / Azure OpenAI to professionalise raw driller remarks.',
      'Store both raw_remarks and the cleaned description for audit.',
    ],
  },
  8: {
    dataverseTable: 'gc_appsetting',
    powerFx: `// Scanner screen calls a flow to resolve an asset by QR
btnScan.OnSelect =
    Set(varScanResult, ScanBarcode());
    Set(varAsset, 'resolveAssetByQR'.Run(varScanResult));
    Collect(colScanBasket, {
        id: varAsset.gc_siteassetid,
        name: varAsset.gc_name,
        type: varAsset.gc_asset_type
    });
// Sign out basket to a job
btnSignOut.OnSelect =
    'commitBasketSignOut'.Run(JSON(colScanBasket), cmbJob.Selected.gc_jobid);
    Clear(colScanBasket);`,
    dataverse: `{
  "table": "gc_appsetting",
  "primaryName": "gc_label",
  "columns": [
    { "name": "gc_key", "type": "Text", "required": true },
    { "name": "gc_division_id", "type": "Lookup", "target": "gc_division" },
    { "name": "gc_label", "type": "Text" },
    { "name": "gc_value", "type": "Multi-line", "max": 4000,
      "note": "JSON config for integration credentials" }
  ]
}`,
    flowName: 'syncGeotabFleet',
    tips: [
      'Store third-party API keys in gc_appsetting, not platform secrets.',
      'Use HTTP-trigger flows for webhooks; copy the URL into the provider dashboard.',
      'Build a flow-run monitoring Power BI dashboard to catch failures.',
    ],
  },
  9: {
    dataverseTable: 'gc_powerbidataset',
    powerFx: `// Embed a Power BI dashboard in a canvas app
pbDashboard.DashboardId: "your-dashboard-guid"
pbDashboard.WorkspaceId: "your-workspace-guid"
pbDashboard.Height: 600
// KPI tile driven by Dataverse
lblActiveJobs.Text: CountRows(colActiveJobs)
// Scheduled report emailer (flow)
btnEmailReport.OnSelect:
    'sendScheduledReports'.Run("rig-performance", "weekly");`,
    dataverse: `{
  "table": "gc_powerbidataset",
  "primaryName": "gc_name",
  "columns": [
    { "name": "gc_name", "type": "Text", "required": true },
    { "name": "gc_workspace_id", "type": "Text" },
    { "name": "gc_dataset_id", "type": "Text" },
    { "name": "gc_refresh_schedule", "type": "Text" },
    { "name": "gc_rls_role", "type": "Text",
      "note": "Dataverse security role for row-level security" }
  ]
}`,
    flowName: 'syncPowerBI',
    tips: [
      'Use DirectQuery for real-time dashboards; import mode for large history.',
      'Configure RLS in the semantic model so divisions only see their data.',
      'Use Power BI paginated reports for the Rota PDF and AFP Excel exports.',
    ],
  },
  10: {
    dataverseTable: 'gc_emailalertsetting',
    powerFx: `// Trigger a branded email from a canvas button
btnNotify.OnSelect =
    'sendAssignmentNotification'.Run(
        varCurrentUser.gc_staffid,
        varJob.gc_jobid,
        Text(varAssignedDate, "yyyy-mm-dd"));
    Notify("Notification sent", NotificationType.Success);
// Push notification to a crew device
btnPush.OnSelect =
    'sendCrewWhatsApp'.Run(varStaff.gc_staffid, "Your shift starts at 07:00");`,
    dataverse: `{
  "table": "gc_emailalertsetting",
  "primaryName": "gc_alert_key",
  "columns": [
    { "name": "gc_alert_key", "type": "Text", "required": true },
    { "name": "gc_enabled", "type": "Yes/No", "default": true },
    { "name": "gc_subject", "type": "Text" },
    { "name": "gc_template", "type": "Multi-line", "max": 4000 },
    { "name": "gc_accent_color", "type": "Text", "default": "#2E5A1A" },
    { "name": "gc_recipient_emails", "type": "Text",
      "note": "Comma-separated; blank = all admins" }
  ]
}`,
    flowName: 'sendDailyReminders',
    tips: [
      'Use a generic Send Branded Email flow reading gc_emailalertsetting templates.',
      'Use the Power Apps Notifications connector for crew push notifications.',
      'Stamp AutopilotControl records so the canvas app can surface automation toasts.',
    ],
  },
  11: {
    dataverseTable: 'gc_systemauditlog',
    powerFx: `// Final cutover — redirect users to the new app
App.OnStart =
    If(varIsDecommissioned,
        Launch("https://apps.powerapps.com/e/your-env/a/your-canvas-app"),
        Navigate(varLandingPage, ScreenTransition.None)
    );
// One-click purge of completed Base44 jobs (run once)
btnPurge.OnSelect =
    'purgeCompletedJobs'.Run();
    Notify("Completed jobs purged", NotificationType.Success);`,
    dataverse: `{
  "table": "gc_systemauditlog",
  "primaryName": "gc_action",
  "columns": [
    { "name": "gc_action", "type": "Text", "required": true },
    { "name": "gc_entity_name", "type": "Text" },
    { "name": "gc_record_id", "type": "Text" },
    { "name": "gc_user_name", "type": "Text" },
    { "name": "gc_timestamp", "type": "Date and Time" },
    { "name": "gc_old_value", "type": "Multi-line", "max": 4000 },
    { "name": "gc_new_value", "type": "Multi-line", "max": 4000 }
  ]
}`,
    flowName: 'purgeCompletedJobs',
    tips: [
      'Run a delta migration and validate record + financial totals against Base44.',
      'Run both systems in parallel for 2-4 weeks before decommissioning.',
      'Keep Base44 read-only during parallel running; write only to Dataverse.',
    ],
  },
};