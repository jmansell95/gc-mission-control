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

function triggerConfig(name) {
  const cat = flowCategory(name);
  if (cat === 'scheduled') {
    return {
      type: 'Recurrence',
      interval: 1,
      frequency: 'Day',
      startTime: '2026-01-01T06:00:00Z',
      notes: 'Scheduled daily at 06:00 UTC. Adjust frequency per the function description.'
    };
  }
  if (cat === 'webhook') {
    return {
      type: 'When an HTTP request is received (Request trigger)',
      method: 'POST',
      url: 'Generated on save — copy this URL into the external service webhook config',
      notes: 'HTTP trigger. The external service (KeyLogBook, Geotab, Stripe, etc.) POSTs to this URL.'
    };
  }
  return {
    type: 'Manually (Power Apps / Power Automate button)',
    notes: 'Instant flow — triggered from a canvas app button or a manual run. Accepts input parameters.'
  };
}

function actionSteps(name) {
  const cat = logicCategory(name);
  const table = inferTable(name);
  const tableRef = table ? `Dataverse: ${table}` : 'Dataverse (inferred from function logic)';

  switch (cat) {
    case 'check':
      return [
        `1. **Trigger:** Recurrence (daily 06:00)`,
        `2. **List rows** — ${tableRef}: filter records where the relevant date/status field meets the check condition`,
        `3. **Apply to each** — iterate the matching records`,
        `4. **Condition** — evaluate the check logic (e.g. expiry date < today + 30 days)`,
        `   - True branch: **Send an email (V2)** — Office 365 Outlook to the responsible person`,
        `   - True branch: **Update a row** — ${tableRef}: set a flag field (e.g. alert_sent = true)`,
        `   - False branch: no action`,
        `5. **Compose** — build a summary of all flagged records`,
        `6. **Send an email (V2)** — summary email to admin group`,
      ];
    case 'sync':
      return [
        `1. **Trigger:** Recurrence (per the sync interval — see function description)`,
        `2. **HTTP** — call the external API endpoint (Geotab, Holman, Asset Panda, Bob HR, etc.)`,
        `   - Method: GET`,
        `   - URI: the external API base URL + endpoint path`,
        `   - Headers: Authorization: Bearer <token> (stored in Dataverse config table or Azure Key Vault)`,
        `3. **Parse JSON** — parse the API response body against the known schema`,
        `4. **Apply to each** — iterate each record from the external system`,
        `5. **List rows** — ${tableRef}: check if a matching record already exists (by external ID)`,
        `6. **Condition** — exists?`,
        `   - True: **Update a row** — ${tableRef} with the external data`,
        `   - False: **Add a new row** — ${tableRef} with the external data`,
        `7. **Update a row** — AppSetting: set last_sync_at = utcNow()`,
      ];
    case 'notify':
      return [
        `1. **Trigger:** Power Apps (V2) or manual`,
        `2. **Input parameters:** the record ID and context`,
        `3. **Get a row by ID** — ${tableRef}: fetch the related record`,
        `4. **Get a row by ID** — Staff: fetch the recipient`,
        `5. **Compose** — build the notification message body`,
        `6. **Send an email (V2)** — Office 365 Outlook to the staff member`,
        `   - Subject: dynamic content from the record`,
        `   - Body: the composed message with the record details`,
        `7. **Update a row** — ${tableRef}: set notification_sent_at = utcNow()`,
      ];
    case 'import':
      return [
        `1. **Trigger:** Power Apps (V2) — accepts a file attachment or file URL`,
        `2. **Input parameters:** file content (base64) or file URL, target job ID`,
        `3. **Parse JSON / Extract data** — parse the file content (CSV, Excel, AGS, PDF)`,
        `   - For Excel: use the Excel Online (Business) connector — Add rows from a table`,
        `   - For CSV: use the Data Operations → Parse CSV action or a Power Automate script`,
        `   - For AGS: use an Azure Function or inline expression to parse the AGS format`,
        `4. **Apply to each** — iterate each parsed row`,
        `5. **Add a new row** — ${tableRef}: insert the record`,
        `6. **Compose** — build a summary (rows imported, errors)`,
        `7. **Respond to a Power App or flow** — return the summary JSON`,
      ];
    case 'export':
      return [
        `1. **Trigger:** Power Apps (V2) or manual`,
        `2. **List rows** — ${tableRef}: query the records to export (with OData filter)`,
        `3. **Select** — pick the columns to export`,
        `4. **Create CSV / Create Excel** — use the Data Operations or Excel Online connector`,
        `5. **Create file** — OneDrive for Business or SharePoint: save the exported file`,
        `6. **Get file link** — generate a sharing link`,
        `7. **Respond to a Power App or flow** — return the download URL`,
      ];
    case 'approve':
      return [
        `1. **Trigger:** Power Apps (V2) — accepts the record ID and approval decision`,
        `2. **Input parameters:** recordId, decision (approved/queried), note`,
        `3. **Update a row** — ${tableRef}: set review_status = decision, reviewed_by = currentUser(), reviewed_at = utcNow()`,
        `4. **Condition** — decision = 'approved'?`,
        `   - True: **Update a row** — trigger downstream actions (e.g. create timesheet, generate AFP line)`,
        `   - False: **Send an email (V2)** — notify the submitter of the query/rejection`,
        `5. **Respond to a Power App or flow** — return success`,
      ];
    case 'get':
      return [
        `1. **Trigger:** Power Apps (V2)`,
        `2. **Input parameters:** the query parameters (filters, IDs)`,
        `3. **List rows / Get row by ID** — ${tableRef}: fetch the data`,
        `4. **Compose** — shape the response JSON`,
        `5. **Respond to a Power App or flow** — return the data as JSON`,
      ];
    case 'auto':
      return [
        `1. **Trigger:** Recurrence or Power Apps (V2)`,
        `2. **List rows** — ${tableRef}: query records needing auto-processing`,
        `3. **Apply to each** — iterate matching records`,
        `4. **Condition / Compose** — apply the auto-logic (e.g. generate timesheet from GPS, create AFP from milestone)`,
        `5. **Add a new row / Update a row** — write the result to the target table`,
        `6. **Respond** — return summary`,
      ];
    case 'push':
      return [
        `1. **Trigger:** Power Apps (V2) or instant`,
        `2. **Input parameters:** record ID`,
        `3. **Get a row by ID** — ${tableRef}: fetch the record`,
        `4. **HTTP** — POST/PUT to the external API (Asset Panda, Bob HR, etc.)`,
        `   - Headers: Authorization + Content-Type`,
        `   - Body: the record data mapped to the external API schema`,
        `5. **Parse JSON** — parse the response`,
        `6. **Update a row** — ${tableRef}: store the external ID / sync status`,
        `7. **Respond** — return success/failure`,
      ];
    case 'validate':
      return [
        `1. **Trigger:** Power Apps (V2)`,
        `2. **Input parameters:** the data to validate`,
        `3. **HTTP** — call the validation API (HMRC CIS, Companies House, etc.)`,
        `4. **Parse JSON** — parse the validation response`,
        `5. **Condition** — valid?`,
        `   - True: **Update a row** — mark as verified`,
        `   - False: **Send an email** — alert admin of the validation failure`,
        `6. **Respond** — return the validation result`,
      ];
    case 'webhook':
      return [
        `1. **Trigger:** When an HTTP request is received (Request trigger)`,
        `2. **Parse JSON** — parse the incoming webhook payload against the known schema`,
        `3. **Condition** — validate the authentication (bearer token / HMAC signature / basic auth)`,
        `   - Invalid: **Respond** — 401 Unauthorized, stop flow`,
        `   - Valid: continue`,
        `4. **Switch** — branch on the event type (e.g. hole_created, hole_updated, hole_deleted)`,
        `5. **For each event type:**`,
        `   - **List rows** — find the matching job by project number / reference`,
        `   - **Add a new row / Update a row / Delete a row** — ${tableRef}: apply the change`,
        `6. **Add a new row** — webhook log table: record the event, outcome, summary`,
        `7. **Respond** — 200 OK with the processing summary`,
      ];
    default:
      return [
        `1. **Trigger:** ${flowCategory(name) === 'scheduled' ? 'Recurrence' : 'Power Apps (V2)'}`,
        `2. **Input parameters:** per the function spec`,
        `3. **List rows / Get row** — ${tableRef}: fetch relevant data`,
        `4. **Apply to each / Condition** — apply the business logic`,
        `5. **Add/Update/Delete row** — ${tableRef}: write results`,
        `6. **Respond** — return the result`,
      ];
  }
}

function generateFlowJSON(name) {
  const cat = flowCategory(name);
  const trigger = triggerConfig(name);
  const table = inferTable(name);

  const definition = {
    name: `GC_${name}`,
    description: `Power Automate flow recreating the Base44 backend function: ${name}`,
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
  };

  return definition;
}

export function generateFlowDocument(name) {
  const cat = flowCategory(name);
  const trigger = triggerConfig(name);
  const steps = actionSteps(name);
  const table = inferTable(name);

  let doc = '';
  doc += `## Flow: ${name}\n\n`;
  doc += `**Category:** ${cat} (${logicCategory(name)})\n`;
  doc += `**Primary Dataverse Table:** ${table || 'Inferred from logic'}\n\n`;
  doc += `### Trigger Configuration\n\n`;
  doc += `- **Type:** ${trigger.type}\n`;
  if (trigger.frequency) doc += `- **Frequency:** ${trigger.frequency} (every ${trigger.interval} ${trigger.frequency.toLowerCase()})\n`;
  if (trigger.method) doc += `- **Method:** ${trigger.method}\n`;
  if (trigger.url) doc += `- **URL:** ${trigger.url}\n`;
  doc += `- **Notes:** ${trigger.notes}\n\n`;
  doc += `### Action Steps\n\n`;
  steps.forEach(s => { doc += `${s}\n\n`; });
  doc += `### Import Instructions\n\n`;
  doc += `1. Go to make.powerautomate.com → Create → Automated cloud flow (or Scheduled/Instant per the trigger type above).\n`;
  doc += `2. Set the trigger per the configuration above.\n`;
  doc += `3. Add each action step in order. Use the Dataverse connector for all database operations.\n`;
  doc += `4. For HTTP actions, use the HTTP connector with the external API URL and auth headers.\n`;
  doc += `5. For email actions, use the Office 365 Outlook connector.\n`;
  doc += `6. Save and test the flow.\n\n`;
  doc += `---\n\n`;
  return doc;
}

export function generateAllFlowsDocument() {
  let doc = '';
  doc += `# GC Mission Control — Power Automate Flow Pack\n\n`;
  doc += `**Volume 2 of 5 — Business Logic Build Manual**\n\n`;
  doc += `This document defines every Power Automate flow needed to recreate the 200+ backend functions.\n\n`;
  doc += `## Overview\n\n`;
  doc += `- **Total flows:** ${ALL_FLOWS.length}\n`;
  doc += `- **Scheduled flows:** ${SCHEDULED_FLOWS.length}\n`;
  doc += `- **Instant flows:** ${INSTANT_FLOWS.length}\n`;
  doc += `- **Webhook flows:** ${WEBHOOK_FLOWS.length}\n\n`;
  doc += `## Connector Prerequisites\n\n`;
  doc += `Before building these flows, add these connectors to your Power Automate environment:\n`;
  doc += `- **Dataverse** (built-in) — all database operations\n`;
  doc += `- **Office 365 Outlook** — all email notifications\n`;
  doc += `- **HTTP** — external API calls (Geotab, Holman, Asset Panda, etc.)\n`;
  doc += `- **Excel Online (Business)** — file import/export\n`;
  doc += `- **OneDrive for Business** — file storage for exports\n`;
  doc += `- **Power Apps (V2)** — instant flow triggers from canvas apps\n`;
  doc += `- **Azure Key Vault** — storing API keys/secrets (or use Dataverse config tables)\n\n`;
  doc += `---\n\n`;

  doc += `## A. Scheduled Flows (${SCHEDULED_FLOWS.length})\n\n`;
  SCHEDULED_FLOWS.forEach(f => { doc += generateFlowDocument(f); });

  doc += `## B. Instant Flows (${INSTANT_FLOWS.length})\n\n`;
  INSTANT_FLOWS.forEach(f => { doc += generateFlowDocument(f); });

  doc += `## C. Webhook Flows (${WEBHOOK_FLOWS.length})\n\n`;
  WEBHOOK_FLOWS.forEach(f => { doc += generateFlowDocument(f); });

  return doc;
}

export function generateAllFlowJSONs() {
  const all = {};
  for (const name of ALL_FLOWS) {
    all[name] = generateFlowJSON(name);
  }
  return all;
}