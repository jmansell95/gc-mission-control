// Generates a single consolidated "Claude Build Brief" — one AI-readable
// markdown file that contains the full migration plan (build order), every
// Dataverse schema, every Power Automate flow definition, the canvas app
// Power Fx source, and the integration setup guide.
//
// Hand this one file to Claude (or any AI assistant) and it can execute the
// entire Power Platform migration end-to-end without any other document.

import { generateDataverseSchemaDocument } from './dataverseConverter';
import { generateAllFlowsDocument } from './flowGenerator';
import { generatePowerFxDocument } from './powerFxSource';
import { generateIntegrationGuide } from './integrationGuideContent';
import { ENTITY_COUNT } from './entityManifest';
import { FLOW_COUNT } from './flowManifest';

// A condensed, numbered build order — the roadmap phases in a form Claude can
// follow step by step. (Kept self-contained here so the brief generator does
// not depend on the roadmap page component.)
export const BUILD_ORDER = [
  {
    phase: 0,
    title: 'Foundation & Environment Setup',
    tool: 'Power Platform Admin Center + Entra ID',
    pasteTarget: 'Power Platform Admin Center (admin.powerplatform.microsoft.com) + Entra ID (entra.microsoft.com)',
    steps: [
      'Provision a Production + a Dev/Sandbox Power Platform environment (region = UK South).',
      'Create the Dataverse database in both environments.',
      'Register an Entra ID app registration for Power Apps SSO (canvas + model-driven redirect URIs).',
      'Create the unmanaged solution "GC Mission Control" in Dev; managed in Prod.',
      'Create maker security groups (Makers, Admins, Field App Users) and assign Power Apps licences.',
      'Configure environment-level DLP policies (allow Dataverse, Outlook, SharePoint, Power BI; block consumer connectors).',
      'Provision the Power BI workspace for embedded dashboards.',
    ],
    validation: 'CHECKPOINT: Open make.powerapps.com and confirm you can see the "GC Mission Control" solution in Dev. Verify the Dataverse database is provisioned (Tables area loads without error). Confirm the Entra ID app registration has the correct redirect URIs.',
  },
  {
    phase: 1,
    title: 'Core Data Schema Migration (Dataverse)',
    tool: 'make.powerapps.com → Solutions → Tables',
    pasteTarget: 'make.powerapps.com → Solutions → GC Mission Control → New table. Use the Dataverse Schema CSV (Volume 2) as the column-by-column reference.',
    steps: [
      'Create every table listed in the Dataverse Schema Pack (Volume 2 below), in dependency order: parent tables first (Staff, Job, Division, Supplier, Client, Team), then child tables with Lookups.',
      'For each table, add every custom column with the exact Schema Name and Dataverse Type listed.',
      'Create all global Option Sets (Choices) BEFORE adding the columns that reference them.',
      'Build all 1:N and N:N relationships exactly as listed.',
      'Enable Dataverse auditing on every table (Table properties → Auditing).',
      'Run a test data migration (CSV → Power Query Dataflow) and validate record counts.',
    ],
    validation: 'CHECKPOINT: Count the tables in the solution — must match the ENTITY_COUNT in Volume 2. Spot-check 5 tables: confirm every column from the CSV exists with the correct type. Run a test List rows query in Power Automate against gc_staff and confirm rows return.',
  },
  {
    phase: 2,
    title: 'Staff & Permission Model',
    tool: 'Dataverse security roles + Entra ID + Power Automate',
    pasteTarget: 'make.powerapps.com → Security roles + Entra ID (Groups) + Power Automate (flow for sign-in auto-matching).',
    steps: [
      'Create the four security roles: Super Admin, Admin, Office, Field — with the per-hub none/read/write privilege matrix.',
      'Map each hub privilege to Dataverse table privileges (e.g. Billing write = Append/Write on gc_afp + gc_afplineitem + gc_invoice).',
      'Create Entra ID security groups mirroring the four roles and assign the Dataverse roles to them.',
      'Build a Power Automate flow on Entra ID sign-in: look up the user email in gc_staff, set system_role + division; route unknown users to a "pending access" screen.',
      'Migrate all existing Staff records, preserving the crew_parent_id hierarchy.',
    ],
    validation: 'CHECKPOINT: Create a test user in each Entra ID group. Log in as each and confirm they see only their permitted hubs. Verify a Field user cannot access Billing. Verify the sign-in auto-matching flow populates system_role on first login.',
  },
  {
    phase: 3,
    title: 'Model-Driven Admin Hubs',
    tool: 'make.powerapps.com → Model-driven apps',
    pasteTarget: 'make.powerapps.com → Create → Model-driven app. One app per hub (Staff, Jobs, Assets, Fleet, Compliance, Settings).',
    steps: [
      'Build the "GC Staff Hub" model-driven app: Staff form + views + Crew/Contacts/Training sub-grids.',
      'Build the "GC Jobs Hub" model-driven app: Job form (multi-discipline child table), views, detail tabs as sub-grids.',
      'Build the "GC Assets Hub", "GC Fleet Hub", "GC Compliance Hub", and "GC Settings" model-driven apps.',
      'Recreate the ConfigList dropdown system as global Option Sets + a gc_configlist table.',
      'Build the sitemap mirroring the admin sidebar (Overview, Jobs, Scheduling, Staff, Logistics, Assets, Fleet, Investigation, Compliance, Billing, Reports, Settings).',
      'Configure business process flows for the Job lifecycle and Staff onboarding.',
    ],
    validation: 'CHECKPOINT: Open each model-driven app in the app designer. Confirm every form, view, and sub-grid renders without errors. Create a test Staff record and a test Job record end-to-end. Verify the sitemap matches the admin sidebar.',
  },
  {
    phase: 4,
    title: 'Canvas Field-Crew Mobile App',
    tool: 'make.powerapps.com → Canvas apps (Power Apps Studio)',
    pasteTarget: 'make.powerapps.com → Create → Canvas app → Phone layout. Follow the Setup Checklist in Volume 4 before pasting any Power Fx.',
    steps: [
      'Create the "GC Field Crew" canvas app (tablet layout, mobile-first).',
      'Configure the Power Apps Mobile offline profile (download Staff, RotaAssignment, Job, SiteAsset for the current user).',
      'Build the screens using the Power Fx source in Volume 4 below: My Schedule, My Profile, Deliveries, Scanner, Shift Wizard.',
      'Use native controls: Geolocation sensor, Camera, PenInput (signature), BarcodeScanner.',
      'Configure offline sync: offline writes go to a local collection; on reconnect a Power Automate flow syncs to Dataverse.',
      'Register push notifications via the Power Apps Notifications connector.',
      'Test on iOS and Android via the Power Apps mobile app.',
    ],
    validation: 'CHECKPOINT: Open the app in Power Apps Studio — no error indicators on any screen. Test on iOS and Android via the Power Apps mobile app: log in, view schedule, start a shift, log an activity, sign a briefing, complete the shift. Verify offline mode: turn off network, log an activity, reconnect, confirm it syncs.',
  },
  {
    phase: 5,
    title: 'Financial Hub (AFP + CVR)',
    tool: 'Canvas app + Dataverse + Power Automate',
    pasteTarget: 'Canvas app (AFP Builder screen in Volume 4) + Power Automate (rate-card matching, auto-populate, invoice flows in Volume 3).',
    steps: [
      'Build the gc_afp and gc_afplineitem tables (schemas in Volume 2).',
      'Build the AFP Builder canvas app: dual-side claim/assessment grid, sheet tabs, totals strip, submit-to-client action.',
      'Build the Variation Summary + per-Ref breakdown tab system.',
      'Build the rate-card matching flow (fuzzy match item description → gc_ratecarditem).',
      'Build the dispute workflow (state machine + dispute history JSON).',
      'Build the auto-populate-from-field-data scheduled flow (InvestigationLog + Timesheet + DeliveryLog → AFPLineItem).',
      'Build the CVR builder, invoice generation flow, and AFP/CVR Excel export flows.',
      'Sign off: prove a full AFP can be built, populated, disputed, agreed, and invoiced end-to-end.',
    ],
    validation: 'CHECKPOINT: Create a test AFP, populate it from field data, dispute a line item, resolve the dispute, submit to client, generate an invoice. Confirm the total_claimed and agreed_total reconcile to the penny against the line item sums. This is the hardest parity proof — do not proceed until it passes.',
  },
  {
    phase: 6,
    title: 'Rota Builder',
    tool: 'Canvas app + Power Automate',
    pasteTarget: 'Canvas app (RotaBuilderScreen in Volume 4) + Power Automate (publishRotaWeek, conflict detection, smart-fill flows in Volume 3).',
    steps: [
      'Build the Rota Builder canvas app: week navigator, staff grid, day columns, assignment cards.',
      'Implement crew-to-rig assignment (Lead Driller + Second Man share a crew_pairing_id).',
      'Build conflict detection, smart-fill (copy last week), and template week copy flows.',
      'Build the permanent-crew recurring pattern scheduled flow.',
      'Build the leave/absence overlay and the publish workflow (Outlook branded email + RotaWeek status).',
      'Build the compliance-block modal (expired training blocks publication with force-override).',
    ],
    validation: 'CHECKPOINT: Build a test week rota. Assign a crew to a rig. Publish the week. Confirm each assigned staff member receives an email. Try to publish with an expired-training staff member — confirm the compliance block fires. Use smart-fill to copy the week forward.',
  },
  {
    phase: 7,
    title: 'Investigation & Borehole Data',
    tool: 'Model-driven app + Power Automate + AI Builder',
    pasteTarget: 'Model-driven app (Investigation Hub) + Power Automate (importAGS, KeyLogBook webhook, remarks AI flows in Volume 3) + AI Builder/Azure OpenAI connector.',
    steps: [
      'Build the Investigation Hub model-driven app: borehole cards, drill-down, site log timeline.',
      'Build the AGS import flow (HTTP trigger or SharePoint file trigger) — wrap the parser as an Azure Function custom connector if pure Power Automate parsing is too complex.',
      'Build the KeyLogBook webhook receiver flow (HTTP trigger, bearer/HMAC validation).',
      'Build the driller remarks professionalisation flow (AI Builder or Azure OpenAI).',
      'Build the site log review queue view + approve/query actions.',
      'Build the geotech QC Power BI dashboards and the auto-pricing + auto-timesheet flows.',
    ],
    validation: 'CHECKPOINT: Upload a test AGS file via the importAGS flow. Confirm borehole records appear in the Investigation Hub. Send a test KeyLogBook webhook payload and confirm it is received and processed. Run the remarks professionalisation on a sample raw remark and confirm the output is clean English.',
  },
  {
    phase: 8,
    title: 'Integration Replacement (Power Automate)',
    tool: 'Power Automate',
    pasteTarget: 'make.powerautomate.com → Create flow. Use the Flow Bundles (Volume 3) — scheduled, instant, and webhook bundles are separated. Paste each flow definition into a new flow.',
    steps: [
      'Work through the Power Automate Flow Pack (Volume 3 below) flow by flow.',
      'Build the scheduled flows (recurrence triggers), instant flows (manual/Dataverse triggers), and HTTP-trigger flows (webhook receivers).',
      'Store generated webhook URLs in the relevant config tables and update the third-party dashboards.',
      'Replace every Base44 SDK entity call with the Dataverse connector (Add/Update/List rows).',
      'Set up a Power BI dashboard on flow-run analytics to catch failures.',
    ],
    validation: 'CHECKPOINT: Build 5 representative flows (one scheduled, one instant, one webhook, one sync, one notify). Test-run each. Confirm the scheduled flow fires at the right time, the instant flow responds to a canvas app button, and the webhook flow returns HTTP 200. Check the flow-run analytics dashboard for failures.',
  },
  {
    phase: 9,
    title: 'Dashboards, Reports & Power BI',
    tool: 'Power BI Desktop + Power BI Service',
    pasteTarget: 'Power BI Desktop (semantic model + reports) → publish to Power BI Service → embed in model-driven apps via the Power BI embedded control.',
    steps: [
      'Create the "GC Mission Control Dashboards" Power BI workspace + a semantic model connected to Dataverse.',
      'Build the Rig Performance, Rig Profitability, Crew Utilisation, Cash-Flow, Compliance, Billing Readiness, and Project Health dashboards.',
      'Embed each dashboard in the relevant model-driven app using the Power BI embedded control.',
      'Build the scheduled-report emailer flows (export Power BI report → email attachment).',
      'Configure row-level security in the semantic model for division-scoped users.',
    ],
    validation: 'CHECKPOINT: Open each embedded dashboard in its model-driven app. Confirm data loads (not blank). Apply a division RLS filter and confirm a division-scoped user only sees their division. Trigger a scheduled report and confirm the email arrives with the attachment.',
  },
  {
    phase: 10,
    title: 'Automation & Notifications',
    tool: 'Power Automate + Outlook + Power Apps Notifications',
    pasteTarget: 'Power Automate (scheduled + instant flows from Volume 3) + Outlook connector (branded emails) + Power Apps Notifications connector (push).',
    steps: [
      'Recreate the daily reminder, weekly progress report, monthly statement, payroll autopilot, training compliance, and weather rostering flows.',
      'Build the EmailAlertSetting template system (gc_emailalertsetting + a generic "Send Branded Email" flow).',
      'Build the push-notification and WhatsApp notification flows.',
    ],
    validation: 'CHECKPOINT: Trigger the daily reminder flow and confirm a test user receives a push notification + email. Send a weekly progress report and confirm the email body renders the branded template. Run the training compliance flow and confirm expiring certificates are flagged.',
  },
  {
    phase: 11,
    title: 'Data Cutover & Decommission',
    tool: 'Power Automate + DNS + Base44',
    pasteTarget: 'Power Automate (delta migration flow) + DNS provider (domain switch) + Base44 (unpublish + export).',
    steps: [
      'Run the final delta migration from Base44 to Dataverse; validate record counts and financial totals.',
      'Switch the custom domain DNS to the Power Apps portal / model-driven / canvas URLs.',
      'Cut over all external webhook endpoints to the new Power Automate HTTP trigger URLs.',
      'Run both systems in parallel for 2-4 weeks (Base44 read-only), reconciling daily.',
      'Train office staff on the model-driven hubs and field crew on the canvas app.',
      'Decommission the Base44 app: unpublish, archive the data export, cancel the subscription.',
      'Run a 2-week post-go-live hypercare.',
    ],
    validation: 'CHECKPOINT: Final migration — record counts in Dataverse must match Base44 source for every table. Financial totals (AFP, invoice, timesheet hours) must reconcile to the penny. All webhook endpoints must return HTTP 200 when tested from the provider dashboards. After 2 weeks of parallel running with zero reconciliation gaps, decommission Base44.',
  },
];

function buildOrderSection() {
  let out = '';
  out += '# 1. Build Order — Follow These Steps In Sequence\n\n';
  out += '> This is the master checklist. Complete each phase in order before starting the next. Every phase references a Volume below for the exact schemas, flow JSON, and Power Fx to paste in. Each phase ends with a VALIDATION CHECKPOINT — do not proceed until it passes.\n\n';
  for (const p of BUILD_ORDER) {
    out += `## Phase ${p.phase} — ${p.title}\n\n`;
    out += `**Build in:** ${p.tool}\n`;
    if (p.pasteTarget) out += `**Paste target:** ${p.pasteTarget}\n`;
    out += '\n### Steps\n\n';
    p.steps.forEach((s, i) => {
      out += `${i + 1}. ${s}\n`;
    });
    if (p.validation) {
      out += `\n### ✅ Validation Checkpoint\n\n> ${p.validation}\n`;
    }
    out += '\n';
  }
  return out;
}

export function generateClaudeBuildBrief(schemaList) {
  const date = new Date().toISOString().split('T')[0];
  let out = '';

  out += '# GC Mission Control — Claude Build Brief\n\n';
  out += '> **Single-source build document for the Microsoft Power Platform migration.**\n';
  out += '> Hand this entire file to Claude (or any AI assistant). It contains the full build order, every Dataverse table schema, every Power Automate flow definition, the complete canvas app Power Fx source, and the integration setup guide — enough to execute the whole migration end-to-end without any other document.\n\n';
  out += `**Generated:** ${date}\n`;
  out += `**Scope:** ${ENTITY_COUNT} Dataverse tables · ${FLOW_COUNT} Power Automate flows · 1 canvas app · full integration suite\n\n`;
  out += '---\n\n';

  out += '## START HERE — How Claude Should Use This Document\n\n';
  out += 'You are an expert Microsoft Power Platform developer. You have been given this single file containing everything needed to migrate the GC Mission Control platform from Base44 to the Microsoft Power Platform (Dataverse + model-driven apps + canvas apps + Power Automate + Power BI).\n\n';
  out += '### Your Mission\n\n';
  out += 'Build the entire platform, phase by phase, following Section 1 (Build Order) in strict sequence. For each phase:\n\n';
  out += '1. Read the phase steps and the **Paste target** — this tells you which Power Platform tool to open.\n';
  out += '2. Open the matching **Volume** (Sections 2-5 below) for the exact schemas, flow definitions, and Power Fx code.\n';
  out += '3. Produce the exact table definitions, flow JSON, and Power Fx blocks for that phase.\n';
  out += '4. Give the human step-by-step paste instructions (which tool, which screen, which property, what to name each control).\n';
  out += '5. Run the **Validation Checkpoint** at the end of the phase before proceeding to the next.\n\n';
  out += '### Important Notes\n\n';
  out += '- These are **build manuals**, not auto-import files. Power Platform has no single "upload and build everything" import. A human does the final paste into the Power Platform web UIs.\n';
  out += '- Every Dataverse table, column, and Option Set name uses the `gc_` prefix. Match them exactly.\n';
  out += '- Every Power Automate flow references Dataverse connector actions (Add/Update/List rows) with the exact schema names from Volume 2.\n';
  out += '- Every canvas app Power Fx block in Volume 4 has a **Paste Target** telling you which screen and which control property to paste it into.\n';
  out += '- Validate after each phase. Do not skip the Validation Checkpoints — they catch errors before they compound.\n\n';
  out += '---\n\n';

  out += buildOrderSection();
  out += '---\n\n';

  out += '# 2. Dataverse Schema Pack\n\n';
  out += '> Paste each table into make.powerapps.com → Solutions → New table. Create global Option Sets before the columns that reference them. Create parent tables before child tables with Lookups.\n\n';
  try {
    out += generateDataverseSchemaDocument(schemaList);
  } catch (e) {
    out += `_(Schema generation error: ${e.message})_\n\n`;
  }
  out += '\n---\n\n';

  out += '# 3. Power Automate Flow Pack\n\n';
  out += '> For each flow, create a new flow in make.powerautomate.com with the listed trigger, then add the Dataverse connector actions described. HTTP-trigger flows produce a URL to register in the third-party dashboard.\n\n';
  try {
    out += generateAllFlowsDocument();
  } catch (e) {
    out += `_(Flow generation error: ${e.message})_\n\n`;
  }
  out += '\n---\n\n';

  out += '# 4. Canvas App Power Fx Source\n\n';
  out += '> Create the "GC Field Crew" canvas app in Power Apps Studio, then paste each screen\'s Power Fx into the matching screen. Follow the deployment steps at the end of this volume.\n\n';
  try {
    out += generatePowerFxDocument();
  } catch (e) {
    out += `_(Power Fx generation error: ${e.message})_\n\n`;
  }
  out += '\n---\n\n';

  out += '# 5. Integration & Connector Setup Guide\n\n';
  out += '> Configure each external integration (Geotab, Asset Panda, Holman, Mitti, Bob HR, Concur, KeyLogBook, Stripe, WhatsApp, Met Office, Azure OpenAI, Power BI) per the steps below. Register webhook URLs in the provider dashboards.\n\n';
  try {
    out += generateIntegrationGuide();
  } catch (e) {
    out += `_(Integration guide error: ${e.message})_\n\n`;
  }

  out += '\n---\n\n';
  out += '## End of Build Brief\n\n';
  out += 'Once every phase in Section 1 is complete and validated, the GC Mission Control platform is fully migrated to the Microsoft Power Platform with zero dependency on Base44.\n';

  return out;
}