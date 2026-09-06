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
const BUILD_ORDER = [
  {
    phase: 0,
    title: 'Foundation & Environment Setup',
    tool: 'Power Platform Admin Center + Entra ID',
    steps: [
      'Provision a Production + a Dev/Sandbox Power Platform environment (region = UK South).',
      'Create the Dataverse database in both environments.',
      'Register an Entra ID app registration for Power Apps SSO (canvas + model-driven redirect URIs).',
      'Create the unmanaged solution "GC Mission Control" in Dev; managed in Prod.',
      'Create maker security groups (Makers, Admins, Field App Users) and assign Power Apps licences.',
      'Configure environment-level DLP policies (allow Dataverse, Outlook, SharePoint, Power BI; block consumer connectors).',
      'Provision the Power BI workspace for embedded dashboards.',
    ],
  },
  {
    phase: 1,
    title: 'Core Data Schema Migration (Dataverse)',
    tool: 'make.powerapps.com → Solutions → Tables',
    steps: [
      'Create every table listed in the Dataverse Schema Pack (Volume 2 below), in dependency order: parent tables first (Staff, Job, Division, Supplier, Client, Team), then child tables with Lookups.',
      'For each table, add every custom column with the exact Schema Name and Dataverse Type listed.',
      'Create all global Option Sets (Choices) BEFORE adding the columns that reference them.',
      'Build all 1:N and N:N relationships exactly as listed.',
      'Enable Dataverse auditing on every table (Table properties → Auditing).',
      'Run a test data migration (CSV → Power Query Dataflow) and validate record counts.',
    ],
  },
  {
    phase: 2,
    title: 'Staff & Permission Model',
    tool: 'Dataverse security roles + Entra ID + Power Automate',
    steps: [
      'Create the four security roles: Super Admin, Admin, Office, Field — with the per-hub none/read/write privilege matrix.',
      'Map each hub privilege to Dataverse table privileges (e.g. Billing write = Append/Write on gc_afp + gc_afplineitem + gc_invoice).',
      'Create Entra ID security groups mirroring the four roles and assign the Dataverse roles to them.',
      'Build a Power Automate flow on Entra ID sign-in: look up the user email in gc_staff, set system_role + division; route unknown users to a "pending access" screen.',
      'Migrate all existing Staff records, preserving the crew_parent_id hierarchy.',
    ],
  },
  {
    phase: 3,
    title: 'Model-Driven Admin Hubs',
    tool: 'make.powerapps.com → Model-driven apps',
    steps: [
      'Build the "GC Staff Hub" model-driven app: Staff form + views + Crew/Contacts/Training sub-grids.',
      'Build the "GC Jobs Hub" model-driven app: Job form (multi-discipline child table), views, detail tabs as sub-grids.',
      'Build the "GC Assets Hub", "GC Fleet Hub", "GC Compliance Hub", and "GC Settings" model-driven apps.',
      'Recreate the ConfigList dropdown system as global Option Sets + a gc_configlist table.',
      'Build the sitemap mirroring the admin sidebar (Overview, Jobs, Scheduling, Staff, Logistics, Assets, Fleet, Investigation, Compliance, Billing, Reports, Settings).',
      'Configure business process flows for the Job lifecycle and Staff onboarding.',
    ],
  },
  {
    phase: 4,
    title: 'Canvas Field-Crew Mobile App',
    tool: 'make.powerapps.com → Canvas apps (Power Apps Studio)',
    steps: [
      'Create the "GC Field Crew" canvas app (tablet layout, mobile-first).',
      'Configure the Power Apps Mobile offline profile (download Staff, RotaAssignment, Job, SiteAsset for the current user).',
      'Build the screens using the Power Fx source in Volume 4 below: My Schedule, My Profile, Deliveries, Scanner, Shift Wizard.',
      'Use native controls: Geolocation sensor, Camera, PenInput (signature), BarcodeScanner.',
      'Configure offline sync: offline writes go to a local collection; on reconnect a Power Automate flow syncs to Dataverse.',
      'Register push notifications via the Power Apps Notifications connector.',
      'Test on iOS and Android via the Power Apps mobile app.',
    ],
  },
  {
    phase: 5,
    title: 'Financial Hub (AFP + CVR)',
    tool: 'Canvas app + Dataverse + Power Automate',
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
  },
  {
    phase: 6,
    title: 'Rota Builder',
    tool: 'Canvas app + Power Automate',
    steps: [
      'Build the Rota Builder canvas app: week navigator, staff grid, day columns, assignment cards.',
      'Implement crew-to-rig assignment (Lead Driller + Second Man share a crew_pairing_id).',
      'Build conflict detection, smart-fill (copy last week), and template week copy flows.',
      'Build the permanent-crew recurring pattern scheduled flow.',
      'Build the leave/absence overlay and the publish workflow (Outlook branded email + RotaWeek status).',
      'Build the compliance-block modal (expired training blocks publication with force-override).',
    ],
  },
  {
    phase: 7,
    title: 'Investigation & Borehole Data',
    tool: 'Model-driven app + Power Automate + AI Builder',
    steps: [
      'Build the Investigation Hub model-driven app: borehole cards, drill-down, site log timeline.',
      'Build the AGS import flow (HTTP trigger or SharePoint file trigger) — wrap the parser as an Azure Function custom connector if pure Power Automate parsing is too complex.',
      'Build the KeyLogBook webhook receiver flow (HTTP trigger, bearer/HMAC validation).',
      'Build the driller remarks professionalisation flow (AI Builder or Azure OpenAI).',
      'Build the site log review queue view + approve/query actions.',
      'Build the geotech QC Power BI dashboards and the auto-pricing + auto-timesheet flows.',
    ],
  },
  {
    phase: 8,
    title: 'Integration Replacement (Power Automate)',
    tool: 'Power Automate',
    steps: [
      'Work through the Power Automate Flow Pack (Volume 3 below) flow by flow.',
      'Build the scheduled flows (recurrence triggers), instant flows (manual/Dataverse triggers), and HTTP-trigger flows (webhook receivers).',
      'Store generated webhook URLs in the relevant config tables and update the third-party dashboards.',
      'Replace every Base44 SDK entity call with the Dataverse connector (Add/Update/List rows).',
      'Set up a Power BI dashboard on flow-run analytics to catch failures.',
    ],
  },
  {
    phase: 9,
    title: 'Dashboards, Reports & Power BI',
    tool: 'Power BI Desktop + Power BI Service',
    steps: [
      'Create the "GC Mission Control Dashboards" Power BI workspace + a semantic model connected to Dataverse.',
      'Build the Rig Performance, Rig Profitability, Crew Utilisation, Cash-Flow, Compliance, Billing Readiness, and Project Health dashboards.',
      'Embed each dashboard in the relevant model-driven app using the Power BI embedded control.',
      'Build the scheduled-report emailer flows (export Power BI report → email attachment).',
      'Configure row-level security in the semantic model for division-scoped users.',
    ],
  },
  {
    phase: 10,
    title: 'Automation & Notifications',
    tool: 'Power Automate + Outlook + Power Apps Notifications',
    steps: [
      'Recreate the daily reminder, weekly progress report, monthly statement, payroll autopilot, training compliance, and weather rostering flows.',
      'Build the EmailAlertSetting template system (gc_emailalertsetting + a generic "Send Branded Email" flow).',
      'Build the push-notification and WhatsApp notification flows.',
    ],
  },
  {
    phase: 11,
    title: 'Data Cutover & Decommission',
    tool: 'Power Automate + DNS + Base44',
    steps: [
      'Run the final delta migration from Base44 to Dataverse; validate record counts and financial totals.',
      'Switch the custom domain DNS to the Power Apps portal / model-driven / canvas URLs.',
      'Cut over all external webhook endpoints to the new Power Automate HTTP trigger URLs.',
      'Run both systems in parallel for 2-4 weeks (Base44 read-only), reconciling daily.',
      'Train office staff on the model-driven hubs and field crew on the canvas app.',
      'Decommission the Base44 app: unpublish, archive the data export, cancel the subscription.',
      'Run a 2-week post-go-live hypercare.',
    ],
  },
];

function buildOrderSection() {
  let out = '';
  out += '# 1. Build Order — Follow These Steps In Sequence\n\n';
  out += '> This is the master checklist. Complete each phase in order before starting the next. Every phase references a Volume below for the exact schemas, flow JSON, and Power Fx to paste in.\n\n';
  for (const p of BUILD_ORDER) {
    out += `## Phase ${p.phase} — ${p.title}\n\n`;
    out += `**Build in:** ${p.tool}\n\n`;
    p.steps.forEach((s, i) => {
      out += `${i + 1}. ${s}\n`;
    });
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

  out += '## How Claude Should Use This Document\n\n';
  out += '1. Read **Section 1 (Build Order)** top to bottom — it is the master sequence.\n';
  out += '2. For each phase, open the matching **Volume** below and paste the schemas / flow JSON / Power Fx into the named Power Platform tool.\n';
  out += '3. These are **build manuals**, not auto-import files: copy each table definition into Dataverse, each flow JSON into Power Automate, and each Power Fx block into Power Apps Studio. Power Platform has no single "upload and build everything" import.\n';
  out += '4. Validate after each phase (record counts, test run) before proceeding.\n\n';
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