// Generates a Power Automate flow definition for each backend function.
// Categorizes by name pattern to produce the right trigger, actions, and logic.
// Produces both an importable flow JSON spec and a human-readable build document.

import { SCHEDULED_FLOWS, INSTANT_FLOWS, WEBHOOK_FLOWS, ALL_FLOWS } from './flowManifest';

const flowCategory = (name) => {
  if (WEBHOOK_FLOWS.includes(name)) return 'webhook';
  if (SCHEDULED_FLOWS.includes(name)) return 'scheduled';
  return 'instant';
};

const logicCategory = (name) => {
  if (name.startsWith('check')) return 'check';
  if (name.startsWith('sync')) return 'sync';
  if (name.startsWith('send') || name.startsWith('notify')) return 'notify';
  if (name.startsWith('import') || name.startsWith('parse') || name.startsWith('process') || name.startsWith('commit')) return 'import';
  if (name.startsWith('export') || name.startsWith('generate')) return 'export';
  if (name.startsWith('approve')) return 'approve';
  if (name.startsWith('get') || name.startsWith('resolve')) return 'get';
  if (name.startsWith('auto')) return 'auto';
  if (name.startsWith('migrate') || name.startsWith('backfill') || name.startsWith('reclassify')) return 'migrate';
  if (name.startsWith('recalculate') || name.startsWith('calculate') || name.startsWith('detect')) return 'calculate';
  if (name.startsWith('push')) return 'push';
  if (name.startsWith('validate') || name.startsWith('verify')) return 'validate';
  return 'custom';
};

// Infer the primary Dataverse table from the function name
const inferTable = (name) => {
  const map = {
    Staff: /staff|crew|people|user/i, Job: /job|project/i,
    RotaAssignment: /rota|assignment|shift|schedule/i,
    InvestigationLog: /log|investigation|ags|keylog/i,
    SiteAsset: /asset|rig|equipment/i, Vehicle: /vehicle|fleet|geotab|holman/i,
    DeliveryLog: /delivery|route|goods/i, Timesheet: /timesheet|payroll/i,
    AFP: /afp/i, CVR: /cvr/i, ComplianceItem: /compliance|training|cert/i,
    Invoice: /invoice|billing|charge/i, Supplier: /supplier|concur/i,
    VehicleMaintenanceBooking: /maintenance|mot|service/i,
    SafetyReport: /safety|mitti|incident/i, StaffLocationLog: /location|gps|geofence/i,
  };
  for (const [entity, pattern] of Object.entries(map)) {
    if (pattern.test(name)) return entity;
  }
  return null;
};

// Generate a human-readable description of what the flow does
function flowDescription(name) {
  const cat = logicCategory(name);
  const table = inferTable(name);
  const tableRef = table ? 'the `' + table + '` table' : 'the relevant Dataverse table';

  const descriptions = {
    check: 'Queries ' + tableRef + ' for records meeting a check condition (e.g. expiry dates, overdue statuses) and sends alert emails + updates flag fields.',
    sync: 'Pulls data from an external API (Geotab, Holman, Asset Panda, Bob HR, etc.) and upserts matching records in ' + tableRef + '.',
    notify: 'Sends an email or notification to a staff member about a record event (assignment, training, maintenance, etc.) in ' + tableRef + '.',
    import: 'Parses an uploaded file (CSV, Excel, AGS, PDF) and creates records in ' + tableRef + '.',
    export: 'Queries ' + tableRef + ' and generates a downloadable file (Excel, PDF, CSV) saved to OneDrive/SharePoint.',
    approve: 'Processes a manager approval/rejection on a record in ' + tableRef + ', stamps the reviewer, and triggers downstream actions.',
    get: 'Fetches data from ' + tableRef + ' based on input parameters and returns it as JSON to the calling canvas app.',
    auto: 'Automatically processes records in ' + tableRef + ' (e.g. generates timesheets from GPS, creates AFPs from milestones).',
    migrate: 'One-time migration script that transforms and updates records in ' + tableRef + '.',
    calculate: 'Performs a calculation (financial, depreciation, incentives) on records in ' + tableRef + ' and stamps the result.',
    push: 'Pushes data from ' + tableRef + ' to an external API (Asset Panda, Bob HR, etc.) and stores the external ID.',
    validate: 'Validates data against an external API (HMRC CIS, Companies House) and stamps the verification result.',
    webhook: 'Receives an HTTP webhook from an external service, validates auth, parses the payload, and upserts records in ' + tableRef + '.',
    custom: 'Custom business logic operating on ' + tableRef + '.',
  };
  return descriptions[cat] || descriptions.custom;
}

function triggerConfig(name) {
  const cat = flowCategory(name);
  if (cat === 'scheduled') {
    return {
      type: 'Recurrence',
      interval: 1,
      frequency: 'Day',
      startTime: '2026-01-01T06:00:00Z',
      notes: 'Scheduled daily at 06:00 UTC. Adjust frequency per the function description.',
      powerAutomateConfig: 'Trigger: Recurrence. Set Frequency = Day, Interval = 1, Start time = 2026-01-01T06:00:00Z. For weekly flows, set Frequency = Week, Interval = 1. For monthly, Frequency = Month.',
    };
  }
  if (cat === 'webhook') {
    return {
      type: 'When an HTTP request is received (Request trigger)',
      method: 'POST',
      url: 'Generated on save — copy this URL into the external service webhook config',
      notes: 'HTTP trigger. The external service (KeyLogBook, Geotab, Stripe, etc.) POSTs to this URL.',
      powerAutomateConfig: 'Trigger: When an HTTP request is received. Method: POST. After saving the flow, copy the generated URL and paste it into the external service\'s webhook configuration. Add a Response action at the end to return HTTP 200.',
    };
  }
  return {
    type: 'Manually (Power Apps / Power Automate button)',
    notes: 'Instant flow — triggered from a canvas app button or a manual run. Accepts input parameters.',
    powerAutomateConfig: 'Trigger: Power Apps (V2). Add input parameters matching the function signature. The canvas app calls this flow via \'flowName\'.Run(param1, param2).',
  };
}

// Generate specific OData filter expressions based on the function name
function odataFilter(name) {
  const cat = logicCategory(name);

  if (name === 'checkComplianceExpiry') {
    return 'Filter: gc_expiry_date le @{addDays(utcNow(), 30)} and gc_status ne \'expired\'';
  }
  if (name === 'checkVehicleMaintenance') {
    return 'Filter: gc_next_service_date le @{utcNow()} and gc_is_active eq true';
  }
  if (name === 'checkOverdueInvoices') {
    return 'Filter: gc_status eq \'sent\' and gc_due_date lt @{utcNow()}';
  }
  if (name === 'checkSiteWeatherAlerts') {
    return 'Filter: gc_status eq \'in_progress\' and gc_site_lat ne null';
  }
  if (name === 'checkBillingReadiness') {
    return 'Filter: gc_status eq \'draft\'';
  }
  if (name === 'checkJobBudgetAlerts') {
    return 'Filter: gc_status eq \'in_progress\' and gc_budget_amount ne null';
  }
  if (name === 'checkIdleVehicles') {
    return 'Filter: gc_is_active eq true and gc_last_location_at lt @{addHours(utcNow(), -24)}';
  }
  if (name === 'checkMileageDiscrepancies') {
    return 'Filter: gc_last_odometer_reading ne null';
  }
  if (name === 'checkGeofencePresence') {
    return 'Filter: gc_assigned_date eq @{formatDateTime(utcNow(), \'yyyy-MM-dd\')} and gc_status eq \'started\'';
  }
  if (cat === 'check') {
    return 'Filter: (define the check condition based on the function name — e.g. date fields, status fields)';
  }
  if (cat === 'sync') {
    return 'No Dataverse filter — the flow pulls from an external API first, then queries Dataverse by external ID to check if the record exists.';
  }
  if (cat === 'notify') {
    return 'Filter: gc_id eq @{triggerBody()?.recordId} (fetch the specific record that triggered the notification)';
  }
  if (cat === 'get') {
    return 'Filter: (based on the input parameters from the Power Apps trigger — e.g. gc_job_id eq @{triggerBody()?.jobId})';
  }
  return 'Filter: (define based on the function logic)';
}

// Generate specific Dataverse column mappings for Add/Update row actions
function columnMappings(name) {
  const table = inferTable(name);
  if (!table) return '(define column mappings based on the function logic)';

  const cat = logicCategory(name);

  if (cat === 'check') {
    return 'Update row on `' + table + '`:\n' +
           '- gc_alert_sent = true\n' +
           '- gc_alert_sent_at = @{utcNow()}\n' +
           '- gc_alert_type = (the check type, e.g. \'compliance_expiry\', \'maintenance_due\')';
  }
  if (cat === 'sync') {
    return 'Add/Update row on `' + table + '` (map external API fields → Dataverse columns):\n' +
           '- gc_external_id = @{items(\'Apply_to_each\')?[\'id\']}\n' +
           '- gc_name = @{items(\'Apply_to_each\')?[\'name\']}\n' +
           '- gc_updated_at = @{utcNow()}\n' +
           '- gc_sync_source = (the external system name)\n' +
           '- (map all other fields from the external API response to the matching Dataverse columns)';
  }
  if (cat === 'notify') {
    return 'Update row on `' + table + '`:\n' +
           '- gc_notification_sent_at = @{utcNow()}\n' +
           '- gc_notification_type = (the notification type)';
  }
  if (cat === 'approve') {
    return 'Update row on `' + table + '`:\n' +
           '- gc_manager_review_status = @{triggerBody()?.decision}\n' +
           '- gc_manager_reviewed_by = @{user().fullName}\n' +
           '- gc_manager_reviewed_at = @{utcNow()}\n' +
           '- gc_manager_review_note = @{triggerBody()?.note}';
  }
  if (cat === 'push') {
    return 'Update row on `' + table + '` (after external API response):\n' +
           '- gc_external_id = @{body(\'HTTP\')?[\'id\']}\n' +
           '- gc_sync_status = \'synced\'\n' +
           '- gc_last_synced_at = @{utcNow()}';
  }
  return 'Add/Update row on `' + table + '`:\n' +
         '- (map the input parameters and computed values to the matching Dataverse columns)';
}

// Generate specific email subject/body templates for notification flows
function emailTemplate(name) {
  const cat = logicCategory(name);
  if (cat !== 'notify' && cat !== 'check' && !name.startsWith('send')) {
    return null;
  }

  if (name === 'sendDailyReminders') {
    return {
      subject: 'Your schedule for @{formatDateTime(utcNow(), \'dddd dd MMM\')}',
      body: 'Hi @{triggerBody()?.staffName},\n\nYou have @{triggerBody()?.assignmentCount} assignment(s) today:\n\n@{triggerBody()?.assignmentSummary}\n\nOpen the GC Mission Control app to view details and start your shift.\n\nGC Mission Control',
    };
  }
  if (name === 'sendWeeklyProgressReport') {
    return {
      subject: 'Your weekly progress report — @{formatDateTime(addDays(utcNow(), -7), \'dd MMM\')} to @{formatDateTime(utcNow(), \'dd MMM\')}',
      body: 'Hi @{triggerBody()?.staffName},\n\nHere\'s your week in review:\n\nShifts completed: @{triggerBody()?.shiftsCompleted}\nMetres drilled: @{triggerBody()?.metresDrilled}\nHours worked: @{triggerBody()?.hoursWorked}\n\nSee the full breakdown in the GC Mission Control app.\n\nGC Mission Control',
    };
  }
  if (name === 'sendAssignmentNotification') {
    return {
      subject: 'New assignment: @{triggerBody()?.jobName} on @{formatDateTime(triggerBody()?.assignedDate, \'dd MMM\')}',
      body: 'Hi @{triggerBody()?.staffName},\n\nYou\'ve been assigned to:\n\nJob: @{triggerBody()?.jobName}\nDate: @{formatDateTime(triggerBody()?.assignedDate, \'dddd dd MMM yyyy\')}\nStart time: @{triggerBody()?.startTime}\nLocation: @{triggerBody()?.location}\n\nOpen the app to view the full briefing and start your shift.\n\nGC Mission Control',
    };
  }
  if (cat === 'check') {
    return {
      subject: 'Alert: ' + name.replace(/([A-Z])/g, ' $1').trim(),
      body: 'The automated check \'' + name + '\' has flagged the following records:\n\n@{body(\'Compose_summary\')}\n\nPlease review these in the GC Mission Control app.\n\nGC Mission Control',
    };
  }
  return {
    subject: 'GC Mission Control notification',
    body: 'A notification was triggered by the flow: ' + name + '.\n\nSee the GC Mission Control app for details.\n\nGC Mission Control',
  };
}

// Generate specific HTTP endpoint info for sync/push/webhook flows
function httpEndpointInfo(name) {
  const endpoints = {
    syncGeotabFleet: { method: 'POST', url: 'https://api.geotab.com/JSONP', auth: 'Session token from Geotab authentication flow', notes: 'Call Geotab Authenticate first to get a session token, then call GetVersion/Get with the token.' },
    syncHolmanFleet: { method: 'GET', url: 'https://api.holman.co.uk/v1/fleet', auth: 'Bearer token in Authorization header', notes: 'Store the Holman API key in Azure Key Vault or a Dataverse config table.' },
    syncAssetPanda: { method: 'GET', url: 'https://api.assetpanda.com/v3/assets', auth: 'Bearer token in Authorization header', notes: 'Asset Panda API key stored in AppSetting table.' },
    syncBobAbsences: { method: 'GET', url: 'https://api.hibob.com/v1/timeoff/changes', auth: 'Bearer token in Authorization header', notes: 'Bob HR API key stored in AppSetting table.' },
    syncConcurExpenses: { method: 'GET', url: 'https://api.concursolutions.com/v4/expensereports', auth: 'OAuth 2.0 bearer token', notes: 'Concur uses OAuth — implement a token refresh flow.' },
    syncMetOfficeWeather: { method: 'GET', url: 'https://api.metoffice.gov.uk/data/v1/point/hourly', auth: 'API key in X-IBM-Client-Id header', notes: 'Met Office DataPoint API key stored in AppSetting.' },
    syncKeyLogBook: { method: 'GET', url: '(from KeyLogBookConfig.api_base_url)', auth: 'Bearer token from KeyLogBookConfig.api_key', notes: 'Read the API URL and key from the gc_keylogbookconfig table.' },
    verifyCIS: { method: 'GET', url: 'https://api.tax.service.gov.uk/cis/v1/verification', auth: 'OAuth 2.0 (HMRC)', notes: 'HMRC CIS API uses OAuth — implement token refresh.' },
    validateCompaniesHouse: { method: 'GET', url: 'https://api.company-information.service.gov.uk/company/{companyNumber}', auth: 'Basic Auth (API key as username, empty password)', notes: 'Companies House API key stored in AppSetting.' },
    importAGS: { method: 'POST', url: '(HTTP trigger URL)', auth: 'Bearer token or HMAC signature', notes: 'KeyLogBook POSTs the AGS file to this flow\'s HTTP trigger URL.' },
    geotabWebhook: { method: 'POST', url: '(HTTP trigger URL)', auth: 'Geotab webhook signature', notes: 'Geotab POSTs status changes to this flow\'s HTTP trigger URL.' },
    stripeWebhook: { method: 'POST', url: '(HTTP trigger URL)', auth: 'Stripe-Signature header (HMAC)', notes: 'Stripe POSTs payment events to this flow\'s HTTP trigger URL.' },
    receiveMittiData: { method: 'POST', url: '(HTTP trigger URL)', auth: 'Bearer token from MittiConfig.webhook_secret', notes: 'Mitti POSTs audit data to this flow\'s HTTP trigger URL.' },
    receivePhoneGps: { method: 'POST', url: '(HTTP trigger URL)', auth: 'Bearer token', notes: 'External GPS app POSTs location pings to this flow\'s HTTP trigger URL.' },
  };

  return endpoints[name] || null;
}

function actionSteps(name) {
  const cat = logicCategory(name);
  const table = inferTable(name);
  const tableRef = table ? 'Dataverse: `' + table + '` (schema: `gc_' + table.toLowerCase() + '`)' : 'Dataverse (inferred from function logic)';
  const filter = odataFilter(name);
  const mappings = columnMappings(name);
  const endpoint = httpEndpointInfo(name);
  const email = emailTemplate(name);

  switch (cat) {
    case 'check':
      return [
        '1. **Trigger:** Recurrence (daily 06:00 UTC)',
        '2. **List rows** — Dataverse connector, table `' + table + '`:',
        '   - ' + filter,
        '3. **Apply to each** — iterate the matching records',
        '4. **Condition** — evaluate the check logic (e.g. expiry date < today + 30 days)',
        '   - True branch: **Send an email (V2)** — Office 365 Outlook:',
        email ? '     - Subject: `' + email.subject + '`' : '     - Subject: (define based on the check)',
        email ? '     - Body: `' + email.body + '`' : '     - Body: (define based on the check)',
        '   - True branch: **Update a row** — Dataverse `' + table + '`:',
        '     - ' + mappings.split('\n').slice(1).join('\n     - '),
        '   - False branch: no action',
        '5. **Compose** — build a summary of all flagged records (concatenate record names + IDs)',
        '6. **Send an email (V2)** — summary email to admin group:',
        '   - Subject: `' + (email ? email.subject : 'Alert: ' + name) + '`',
        '   - Body: the composed summary',
        '7. **Update a row** — Dataverse `gc_appsetting`: set `gc_last_check_run_at` = utcNow()',
      ];
    case 'sync':
      return [
        '1. **Trigger:** Recurrence (per the sync interval — see function description)',
        endpoint ? '2. **HTTP** — call the external API:' : '2. **HTTP** — call the external API endpoint:',
        endpoint ? '   - Method: ' + endpoint.method : '   - Method: GET',
        endpoint ? '   - URI: ' + endpoint.url : '   - URI: the external API base URL + endpoint path',
        endpoint ? '   - Auth: ' + endpoint.auth : '   - Headers: Authorization: Bearer <token> (stored in Dataverse config table or Azure Key Vault)',
        endpoint ? '   - Notes: ' + endpoint.notes : '',
        '3. **Parse JSON** — parse the API response body against the known schema (define the JSON schema from the API docs)',
        '4. **Apply to each** — iterate each record from the external system',
        '5. **List rows** — Dataverse `' + table + '`: check if a matching record already exists',
        '   - Filter: `gc_external_id eq @{items(\'Apply_to_each\')?[\'id\']}`',
        '6. **Condition** — exists?',
        '   - True: **Update a row** — Dataverse `' + table + '`:',
        '   - False: **Add a new row** — Dataverse `' + table + '`:',
        '   - ' + mappings.split('\n').join('\n   - '),
        '7. **Update a row** — Dataverse `gc_appsetting`: set `gc_last_sync_at` = utcNow(), `gc_last_sync_status` = \'success\'',
        '8. **Respond** — return a summary (records synced, errors)',
      ];
    case 'notify':
      return [
        '1. **Trigger:** Power Apps (V2) or manual',
        '2. **Input parameters:** the record ID and context (staffId, recordId, notificationType)',
        '3. **Get a row by ID** — Dataverse `' + table + '`: fetch the related record',
        '4. **Get a row by ID** — Dataverse `Staff`: fetch the recipient (by `gc_staff_id`)',
        '5. **Compose** — build the notification message body:',
        email ? '   - Subject: `' + email.subject + '`' : '   - Subject: (define based on the notification type)',
        email ? '   - Body: `' + email.body + '`' : '   - Body: (define based on the notification type)',
        '6. **Send an email (V2)** — Office 365 Outlook to the staff member:',
        '   - To: @{body(\'Get_staff\')?[\'gc_email\']}',
        '   - Subject: the composed subject',
        '   - Body: the composed body (HTML format)',
        '7. **Update a row** — Dataverse `' + table + '`:',
        '   - ' + mappings.split('\n').slice(1).join('\n   - '),
      ];
    case 'import':
      return [
        '1. **Trigger:** Power Apps (V2) — accepts a file attachment or file URL',
        '2. **Input parameters:** file content (base64) or file URL, target job ID',
        '3. **Parse JSON / Extract data** — parse the file content:',
        '   - For Excel: use the Excel Online (Business) connector — Add rows from a table',
        '   - For CSV: use the Data Operations → Parse CSV action or a Power Automate script',
        '   - For AGS: use an Azure Function (custom connector) to parse the AGS format — pure Power Automate text parsing is too limited for multi-group AGS files',
        '4. **Apply to each** — iterate each parsed row',
        '5. **Add a new row** — Dataverse `' + table + '`:',
        '   - ' + mappings.split('\n').join('\n   - '),
        '6. **Compose** — build a summary (rows imported, errors)',
        '7. **Respond to a Power App or flow** — return the summary JSON',
      ];
    case 'export':
      return [
        '1. **Trigger:** Power Apps (V2) or manual',
        '2. **Input parameters:** the filter parameters (job ID, date range, etc.)',
        '3. **List rows** — Dataverse `' + table + '`: query the records to export',
        '   - ' + filter,
        '4. **Select** — pick the columns to export (map Dataverse column names to export column names)',
        '5. **Create CSV / Create Excel** — use the Data Operations or Excel Online connector',
        '6. **Create file** — OneDrive for Business or SharePoint: save the exported file',
        '7. **Get file link** — generate a sharing link',
        '8. **Respond to a Power App or flow** — return the download URL',
      ];
    case 'approve':
      return [
        '1. **Trigger:** Power Apps (V2) — accepts the record ID and approval decision',
        '2. **Input parameters:** recordId, decision (approved/queried), note',
        '3. **Update a row** — Dataverse `' + table + '`:',
        '   - ' + mappings.split('\n').join('\n   - '),
        '4. **Condition** — decision = \'approved\'?',
        '   - True: **Update a row** — trigger downstream actions:',
        '     - If approving a timesheet: **Add a new row** — Dataverse `Timesheet` with the approved hours',
        '     - If approving an AFP: **Update a row** — Dataverse `AFP` status = \'submitted\'',
        '     - If approving a log: **Add a new row** — Dataverse `AFPLineItem` with the billing charge',
        '   - False: **Send an email (V2)** — notify the submitter of the query/rejection',
        '5. **Respond to a Power App or flow** — return success',
      ];
    case 'get':
      return [
        '1. **Trigger:** Power Apps (V2)',
        '2. **Input parameters:** the query parameters (filters, IDs)',
        '3. **List rows / Get row by ID** — Dataverse `' + table + '`: fetch the data',
        '   - ' + filter,
        '4. **Compose** — shape the response JSON (select the fields to return)',
        '5. **Respond to a Power App or flow** — return the data as JSON',
      ];
    case 'auto':
      return [
        '1. **Trigger:** Recurrence or Power Apps (V2)',
        '2. **List rows** — Dataverse `' + table + '`: query records needing auto-processing',
        '   - ' + filter,
        '3. **Apply to each** — iterate matching records',
        '4. **Condition / Compose** — apply the auto-logic:',
        '   - For autoBuildDailyTimesheets: calculate hours from GPS geofence events',
        '   - For autoCreateAFPFromMilestone: check if the milestone date = today, then create an AFP',
        '   - For autoGenerateInvoice: check if AFP status = \'agreed\', then create an Invoice',
        '5. **Add a new row / Update a row** — Dataverse (target table): write the result',
        '   - ' + mappings.split('\n').join('\n   - '),
        '6. **Respond** — return summary',
      ];
    case 'push':
      return [
        '1. **Trigger:** Power Apps (V2) or instant',
        '2. **Input parameters:** record ID',
        '3. **Get a row by ID** — Dataverse `' + table + '`: fetch the record',
        endpoint ? '4. **HTTP** — POST/PUT to the external API:' : '4. **HTTP** — POST/PUT to the external API (Asset Panda, Bob HR, etc.):',
        endpoint ? '   - Method: ' + endpoint.method : '   - Method: POST',
        endpoint ? '   - URI: ' + endpoint.url : '   - URI: the external API endpoint',
        endpoint ? '   - Auth: ' + endpoint.auth : '   - Headers: Authorization + Content-Type',
        endpoint ? '   - Notes: ' + endpoint.notes : '   - Body: the record data mapped to the external API schema',
        '5. **Parse JSON** — parse the response',
        '6. **Update a row** — Dataverse `' + table + '`:',
        '   - ' + mappings.split('\n').join('\n   - '),
        '7. **Respond** — return success/failure',
      ];
    case 'validate':
      return [
        '1. **Trigger:** Power Apps (V2)',
        '2. **Input parameters:** the data to validate (e.g. company number, CIS details)',
        endpoint ? '3. **HTTP** — call the validation API:' : '3. **HTTP** — call the validation API (HMRC CIS, Companies House, etc.):',
        endpoint ? '   - Method: ' + endpoint.method : '   - Method: GET',
        endpoint ? '   - URI: ' + endpoint.url : '   - URI: the validation API endpoint',
        endpoint ? '   - Auth: ' + endpoint.auth : '   - Headers: Authorization per the API spec',
        endpoint ? '   - Notes: ' + endpoint.notes : '',
        '4. **Parse JSON** — parse the validation response',
        '5. **Condition** — valid?',
        '   - True: **Update a row** — Dataverse `' + table + '`: mark as verified',
        '   - False: **Send an email** — alert admin of the validation failure',
        '6. **Respond** — return the validation result',
      ];
    case 'webhook':
      return [
        '1. **Trigger:** When an HTTP request is received (Request trigger)',
        '2. **Parse JSON** — parse the incoming webhook payload against the known schema',
        endpoint ? '   - Expected auth: ' + endpoint.auth : '   - Expected auth: Bearer token / HMAC signature',
        '3. **Condition** — validate the authentication:',
        '   - Invalid: **Respond** — 401 Unauthorized, stop flow',
        '   - Valid: continue',
        '4. **Switch** — branch on the event type (e.g. hole_created, hole_updated, hole_deleted for KeyLogBook)',
        '5. **For each event type:**',
        '   - **List rows** — Dataverse `' + table + '`: find the matching job by project number / reference',
        '   - **Add a new row / Update a row / Delete a row** — Dataverse `' + table + '`: apply the change',
        '   - ' + mappings.split('\n').join('\n   - '),
        '6. **Add a new row** — Dataverse `gc_keylogbookwebhooklog` (or the relevant webhook log table): record the event, outcome, summary',
        '7. **Respond** — HTTP 200 OK with the processing summary',
      ];
    default:
      return [
        '1. **Trigger:** ' + (flowCategory(name) === 'scheduled' ? 'Recurrence' : 'Power Apps (V2)'),
        '2. **Input parameters:** per the function spec',
        '3. **List rows / Get row** — Dataverse `' + table + '`: fetch relevant data',
        '   - ' + filter,
        '4. **Apply to each / Condition** — apply the business logic',
        '5. **Add/Update/Delete row** — Dataverse `' + table + '`: write results',
        '   - ' + mappings.split('\n').join('\n   - '),
        '6. **Respond** — return the result',
      ];
  }
}

function generateFlowJSON(name) {
  const cat = flowCategory(name);
  const trigger = triggerConfig(name);
  const table = inferTable(name);

  const definition = {
    name: 'GC_' + name,
    description: flowDescription(name),
    trigger: {
      type: cat === 'scheduled' ? 'Recurrence' : cat === 'webhook' ? 'Request' : 'PowerAppV2',
      ...(cat === 'scheduled' ? { recurrence: { frequency: 'Day', interval: 1 } } : {}),
      ...(cat === 'webhook' ? { kind: 'Http' } : {}),
    },
    actions: actionSteps(name).map((step, i) => ({
      step: i + 1,
      description: step,
    })),
    dataverseTable: table,
    category: logicCategory(name),
    odataFilter: odataFilter(name),
    columnMappings: columnMappings(name),
    httpEndpoint: httpEndpointInfo(name),
    emailTemplate: emailTemplate(name),
  };

  return definition;
}

export function generateFlowDocument(name) {
  const cat = flowCategory(name);
  const trigger = triggerConfig(name);
  const steps = actionSteps(name);
  const table = inferTable(name);
  const desc = flowDescription(name);
  const filter = odataFilter(name);
  const mappings = columnMappings(name);
  const endpoint = httpEndpointInfo(name);
  const email = emailTemplate(name);

  let doc = '';
  doc += '## Flow: ' + name + '\n\n';
  doc += '**Description:** ' + desc + '\n\n';
  doc += '**Category:** ' + cat + ' (' + logicCategory(name) + ')\n';
  doc += '**Primary Dataverse Table:** ' + (table ? '`' + table + '` (schema: `gc_' + table.toLowerCase() + '`)' : 'Inferred from logic') + '\n\n';
  doc += '### Trigger Configuration\n\n';
  doc += '- **Type:** ' + trigger.type + '\n';
  if (trigger.frequency) doc += '- **Frequency:** ' + trigger.frequency + ' (every ' + trigger.interval + ' ' + trigger.frequency.toLowerCase() + ')\n';
  if (trigger.method) doc += '- **Method:** ' + trigger.method + '\n';
  if (trigger.url) doc += '- **URL:** ' + trigger.url + '\n';
  doc += '- **Notes:** ' + trigger.notes + '\n';
  doc += '- **Power Automate config:** ' + (trigger.powerAutomateConfig || '') + '\n\n';

  if (endpoint) {
    doc += '### External API Endpoint\n\n';
    doc += '- **Method:** ' + endpoint.method + '\n';
    doc += '- **URL:** ' + endpoint.url + '\n';
    doc += '- **Auth:** ' + endpoint.auth + '\n';
    doc += '- **Notes:** ' + endpoint.notes + '\n\n';
  }

  doc += '### OData Filter Expression\n\n';
  doc += '```odata\n' + filter + '\n```\n\n';

  doc += '### Dataverse Column Mappings\n\n';
  doc += '```\n' + mappings + '\n```\n\n';

  if (email) {
    doc += '### Email Template\n\n';
    doc += '**Subject:** ' + email.subject + '\n\n';
    doc += '**Body:**\n```\n' + email.body + '\n```\n\n';
  }

  doc += '### Action Steps\n\n';
  steps.forEach(s => { doc += s + '\n\n'; });

  doc += '### Import Instructions\n\n';
  doc += '1. Go to make.powerautomate.com → Create → ';
  doc += cat === 'scheduled' ? 'Scheduled cloud flow' : cat === 'webhook' ? 'Automated cloud flow (When an HTTP request is received)' : 'Instant cloud flow (Power Apps)';
  doc += '.\n';
  doc += '2. Set the trigger per the configuration above.\n';
  doc += '3. Add the Dataverse connector and add each action step in order.\n';
  doc += '4. For HTTP actions, use the HTTP connector with the external API URL and auth headers.\n';
  doc += '5. For email actions, use the Office 365 Outlook connector with the subject/body template above.\n';
  doc += '6. Use the OData filter expression above in the List rows action.\n';
  doc += '7. Map the Dataverse columns per the column mappings section.\n';
  doc += '8. Save and test the flow.\n\n';
  doc += '---\n\n';
  return doc;
}

export function generateAllFlowsDocument() {
  let doc = '';
  doc += '# GC Mission Control — Power Automate Flow Pack\n\n';
  doc += '**Volume 2 of 5 — Business Logic Build Manual**\n\n';
  doc += 'Generated: ' + new Date().toISOString() + '\n\n';
  doc += 'This document defines every Power Automate flow needed to recreate the ' + ALL_FLOWS.length + ' backend functions.\n\n';
  doc += '## Overview\n\n';
  doc += '- **Total flows:** ' + ALL_FLOWS.length + '\n';
  doc += '- **Scheduled flows:** ' + SCHEDULED_FLOWS.length + '\n';
  doc += '- **Instant flows:** ' + INSTANT_FLOWS.length + '\n';
  doc += '- **Webhook flows:** ' + WEBHOOK_FLOWS.length + '\n\n';
  doc += '## Connector Prerequisites\n\n';
  doc += 'Before building these flows, add these connectors to your Power Automate environment:\n';
  doc += '- **Dataverse** (built-in) — all database operations\n';
  doc += '- **Office 365 Outlook** — all email notifications\n';
  doc += '- **HTTP** — external API calls (Geotab, Holman, Asset Panda, etc.)\n';
  doc += '- **Excel Online (Business)** — file import/export\n';
  doc += '- **OneDrive for Business** — file storage for exports\n';
  doc += '- **Power Apps (V2)** — instant flow triggers from canvas apps\n';
  doc += '- **Azure Key Vault** — storing API keys/secrets (or use Dataverse config tables)\n';
  doc += '- **Word Online (Business)** — document generation for PDF exports\n';
  doc += '- **SharePoint** — file storage for generated documents\n\n';
  doc += '## How to Use This Document\n\n';
  doc += '1. Start with the **Scheduled flows** (Section A) — these run automatically and are the backbone of the automation.\n';
  doc += '2. Then build the **Instant flows** (Section B) — these are triggered from the canvas app.\n';
  doc += '3. Finally build the **Webhook flows** (Section C) — these receive data from external services.\n';
  doc += '4. For each flow, follow the Import Instructions at the bottom of its section.\n';
  doc += '5. Use the OData filter expressions and column mappings as written — they reference the exact Dataverse schema names from Volume 1.\n\n';
  doc += '---\n\n';

  doc += '## A. Scheduled Flows (' + SCHEDULED_FLOWS.length + ')\n\n';
  doc += 'These flows run on a recurrence schedule (daily, weekly, or monthly). Create them as **Scheduled cloud flows** in Power Automate.\n\n';
  SCHEDULED_FLOWS.forEach(f => { doc += generateFlowDocument(f); });

  doc += '## B. Instant Flows (' + INSTANT_FLOWS.length + ')\n\n';
  doc += 'These flows are triggered from the canvas app via a button or action. Create them as **Instant cloud flows** with the Power Apps (V2) trigger.\n\n';
  INSTANT_FLOWS.forEach(f => { doc += generateFlowDocument(f); });

  doc += '## C. Webhook Flows (' + WEBHOOK_FLOWS.length + ')\n\n';
  doc += 'These flows receive HTTP POSTs from external services. Create them as **Automated cloud flows** with the "When an HTTP request is received" trigger. After saving, copy the generated URL into the external service\'s webhook configuration.\n\n';
  WEBHOOK_FLOWS.forEach(f => { doc += generateFlowDocument(f); });

  doc += '## Summary\n\n';
  doc += '- **Total flows documented:** ' + ALL_FLOWS.length + '\n';
  doc += '- **Scheduled:** ' + SCHEDULED_FLOWS.length + '\n';
  doc += '- **Instant:** ' + INSTANT_FLOWS.length + '\n';
  doc += '- **Webhook:** ' + WEBHOOK_FLOWS.length + '\n\n';
  doc += '## Next Steps\n\n';
  doc += '1. Build the flows in the order above (scheduled first, then instant, then webhook).\n';
  doc += '2. Test each flow with a sample run before connecting it to the canvas app.\n';
  doc += '3. For webhook flows, update the external service dashboards with the generated HTTP trigger URLs.\n';
  doc += '4. Monitor flow runs in the Power Automate analytics dashboard.\n';

  return doc;
}

export function generateAllFlowJSONs() {
  const all = {};
  for (const name of ALL_FLOWS) {
    all[name] = generateFlowJSON(name);
  }
  return all;
}