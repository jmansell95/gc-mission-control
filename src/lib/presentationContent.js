// ============================================================
// Presentation Pack content — all talking points, script sections,
// ROI figures and section data. Pure data, no rendering logic.
// Kept here so the PDF builder and any future slides stay in sync.
// ============================================================

export const coverStats = [
  { label: 'SafetyCulture sync', value: 'Every 30 min', tone: '#8DC63F' },
  { label: 'Dashboard', value: 'Per-user', tone: '#2E5A1A' },
  { label: 'AGS export', value: 'One click', tone: '#2E5A1A' },
  { label: 'Billing leakage', value: 'Eliminated', tone: '#1d4ed8' },
];

export const safetyOutcomes = [
  'SafetyCulture is the single source of truth — syncs every 30 minutes',
  'Red alert banner on every page when critical issues are open',
  'GPS-tagged hazard map for every service encountered',
  'Manager review on every field log — same day, not month-end',
  'One-click, legally-defensible audit pack for HSE or client',
];

export const financeOutcomes = [
  'Every drilled metre matched to an agreed rate — no leakage',
  'Timesheets generated from verified site activity, not estimates',
  'AGS export in seconds — cash cycle shortened',
  'Real-time cost vs budget visibility before overrun',
];

export const safetyPoints = [
  {
    title: 'Live hazard mapping',
    body: 'Every underground service encounter — gas, water, electric, drainage — is GPS-tagged at the point of excavation and plotted on the site hazard map. We can prove we identified and managed a hazard before it became an incident, and the record is permanent.',
    proof: 'Shown on the Site Hazard Map widget — coordinates captured at the borehole, not re-entered at the office.',
  },
  {
    title: 'Instant compliance verification',
    body: 'Rig, machinery, trailer and lifting-gear compliance status is synced live from the GC Compliance Manager. Assets that are expired, expiring or marked "needs service" are automatically deactivated and cannot be added to a job. The block happens at the yard, not after the asset has reached site.',
    proof: 'Compliance tiles on the dashboard update on every sync — no manual status entry required.',
  },
  {
    title: 'Review-first culture',
    body: 'The Log Quality Control dashboard requires a manager review on every field entry before it is finalised. Ground conditions, pit stability, SPT values and water strikes are checked, queried or approved — with anomalies flagged automatically by the system rather than spotted by chance.',
    proof: 'Anomaly detection catches missing photos, out-of-range depths and SPT mismatches on the day they are logged.',
  },
  {
    title: 'Audit-ready in seconds',
    body: 'Every briefing sign-off, service check, signature and review note is time-stamped, attributed and stored against the job. A complete, legally-defensible pack can be exported in one click if an audit or claim occurs — no reconstructing events from memory weeks later.',
    proof: 'Three-tier signature trail: crew sign-off, manager approval, weekly official lock.',
  },
  {
    title: 'Subcontractor accountability',
    body: 'Subcontractor and enabling-crew logs are flagged with a distinct badge in Log QC, so managers apply the correct review and billing path. Audits submitted from SafetyCulture are auto-linked to the contractor record by email, keeping the safety evidence chain intact across third parties.',
    proof: 'No more "who logged this?" — crew type and origin are visible on every record.',
  },
];

export const financePoints = [
  {
    title: 'Automated charge accuracy',
    body: 'Every metre drilled and unit installed is matched to an agreed rate from the Master Schedule of Rates at the point of logging. Work that is not logged cannot happen, and work that is logged is always priced — so billing leakage from undercharged or forgotten activity is eliminated.',
    proof: 'Billing rules run automatically against the task description — charge is calculated, not guessed.',
  },
  {
    title: 'Audit-proof timesheets',
    body: 'Timesheet entries are generated from professionalised, manager-approved log data rather than self-reported hours. We pay staff for verified site activity, and client charges are calculated from the same source — so payroll and billing can never disagree.',
    proof: 'One approved log feeds payroll, the client charge and the AGS export simultaneously.',
  },
  {
    title: 'Faster cash collection',
    body: 'One-click AGS export to OpenGround removes the manual formatting bottleneck that sits between site completion and invoicing. We move from work-completed to client-invoiced significantly faster, shortening the cash conversion cycle on every job.',
    proof: 'Approved logs export straight to OpenGround with manager review comments attached for the Senior Engineer.',
  },
  {
    title: 'Real-time cost visibility',
    body: 'Daily site snapshots show meterage progress, days logged and activity costs as they happen — not at month-end. Managers can spot a budget overrun while there is still time to act, rather than explaining it after the invoice has been raised.',
    proof: 'Job dashboard surfaces cost-vs-budget the moment logs are approved.',
  },
  {
    title: 'Margin protection on every job',
    body: 'Because crew day rates, plant hire and material costs are all pulled from the same rate card, the internal cost and the client charge are calculated on identical data. There is no second spreadsheet where margin quietly erodes — the markup is applied once, consistently, and is visible on the job at all times.',
    proof: 'Single source of truth across rate card, cost items and invoices.',
  },
];

export const aiPoints = [
  {
    title: 'Staff Assistant — conversational ops copilot',
    body: 'Every manager and crew member has an AI assistant inside the app that answers operational questions in plain English: "Who is on site today?", "What rig needs servicing?", "Show me overdue compliance." No digging through menus — ask and get the answer in seconds.',
    proof: "Runs on the app's live data — the assistant queries the database in real time, it does not hallucinate.",
  },
  {
    title: 'Drilling Intelligence — hazard & log analysis',
    body: 'A dedicated AI agent that analyses drilling logs for ground condition patterns, flags anomalous SPT values, identifies refusal trends across sites, and surfaces geotechnical risks before they become costly delays. It reads the logs so the engineer does not have to.',
    proof: 'Cross-references strata descriptors, refusal encounters and fluid loss across all boreholes on a job.',
  },
  {
    title: 'Scheduling Assistant — rota automation',
    body: 'An AI scheduling assistant that can suggest crew assignments based on qualifications, availability and job type. It checks for qualification gaps, travel time and crew compatibility — work that takes a scheduler 20 minutes per job takes the assistant seconds.',
    proof: 'Validates staff qualifications against crew requirements before suggesting an assignment.',
  },
  {
    title: 'Daily Stand-up Digest — automated morning brief',
    body: 'Every weekday at 7 AM, the system emails every admin a plain-English digest: how many crew are on site, which rigs need maintenance, what critical safety actions are open, and which vehicles have alerts. The 30-minute morning phone round-robin is replaced by a 2-minute read.',
    proof: 'Runs automatically — 5 days a week, 52 weeks a year. No one has to remember to send it.',
  },
  {
    title: 'Milestone Auto-Push — client transparency on autopilot',
    body: 'When a manager approves an investigation log, the system automatically posts a "Verified Milestone" update to the client portal and emails the project manager. Clients see real-time, verified progress without anyone picking up the phone or writing a progress email.',
    proof: 'Triggered by the approval action itself — zero manual steps between log approval and client notification.',
  },
  {
    title: 'Real-time AFP auto-population',
    body: 'Every Application for Payment is populated automatically and continuously from live field data — deliveries, collections, hired equipment, driller logs, subcontractor logs, daily costs, approved timesheets and BOQ variations. The moment a field record is created or a delivery is signed off, the matching AFP line item is upserted. No manual "Refresh from Field Data" — the AFP is always current, always complete, and always ready to submit before the deadline.',
    proof: 'Nine entity automations wire every billable source to the AFP in real time; upserts are idempotent and only touch draft AFPs.',
  },
  {
    title: 'Automated training bookings from compliance expiry',
    body: 'When a staff compliance certificate enters its 30-day expiry window, the system automatically creates a training booking — finding a matching scheduled course or creating a placeholder renewal course — so renewals are booked before they lapse. No one has to remember to chase expiring cards; the system books the refresher and flags it for the manager to confirm the date.',
    proof: 'The nightly compliance expiry check auto-creates TrainingBooking records linked to the expiring ComplianceItem, preventing duplicate bookings.',
  },
  {
    title: 'Weather-aware rota flags',
    body: 'The rota builder shows a live weather flag on every job card — temperature and condition icon, colour-coded for safety. Sites with dangerous wind, thunderstorms or freezing rain show a red "do not work" indicator so managers can re-plan crews before they arrive at an unsafe site, not after.',
    proof: 'Each card fetches live weather for the job coordinates (cached 10 min, deduplicated by location) and applies the same threshold logic as the site weather card.',
  },
];

export const dashboardPoints = [
  {
    title: 'Customisable, drag-and-drop dashboard',
    body: 'Every manager can build their own dashboard — drag widgets to rearrange, toggle which ones are visible, and resize each widget from small to large. The layout saves automatically and follows the user across every login and every device, so the dashboard they see is always the dashboard they built.',
    proof: 'Layout stored per-user in the DashboardLayout entity — not just in browser localStorage. Log in on a new phone, your layout is there.',
  },
  {
    title: 'Two-tier widget system',
    body: 'Widgets are grouped into "At a Glance" (live operational pulse — site readiness, mission control, yard status) and "Insights & Analysis" (AI predictions, benchmarks, geotechnical risk). Start with the six essential widgets and enable deeper analytics as needed — no clutter, just clarity.',
    proof: 'Six curated widgets visible by default; 16 more available via the Customise button.',
  },
  {
    title: 'Job-scoped dashboard',
    body: 'Filter the entire dashboard to a single job — all widgets, stats and site snapshots re-scope to that job instantly. Switch back to "All Jobs" for the company-wide view. One dashboard, two perspectives, zero page reloads.',
    proof: 'Job selector bar drives every widget via React context — no refetch, no flicker.',
  },
];

export const integrationsPoints = [
  {
    title: 'SafetyCulture — single source of truth for safety',
    body: 'All safety audits, incidents, toolbox talks and compliance checks are synced from SafetyCulture every 30 minutes. The Safety Hub shows critical alerts, open audits and overdue actions in one place — and every safety page links straight back to SafetyCulture for the full audit detail. Legacy compliance data has been archived; SafetyCulture is the only source.',
    proof: 'Automated 30-minute sync + webhook receiver + red alert banner on every page when critical issues are open.',
  },
  {
    title: 'SAP Concur — expense sync & reconciliation',
    body: 'Approved site expenses and subcontractor costs export to SAP Concur as Quick Expenses with GL codes mapped automatically, then lock to prevent audit mismatches. A reverse-sync pulls Concur report IDs and approval status back so finance can trace every expense to its report.',
    proof: 'Credentials stored securely in-app — no external secret manager dependency.',
  },
  {
    title: 'Bob HR (Hibob) — bidirectional time-off',
    body: 'Approved absences push to Bob HR the moment a manager signs them off, and approved time-off from Bob HR pulls back into the rota so the scheduler sees who is unavailable before assigning crews. The webhook receiver handles real-time updates from both directions.',
    proof: 'Real-time push on approval + nightly pull — no more "I thought they were on holiday" surprises.',
  },
  {
    title: 'HMRC CIS — subcontractor verification',
    body: 'One-click verification checks every subcontractor against HMRC CIS records, stamps the verification number, tax rate (gross or 30% net) and status onto the Contractor record, and prevents payment without a valid check. Keeps the business compliant with CIS deduction rules.',
    proof: 'Verification result and tax rate persist on the contractor record for audit.',
  },
  {
    title: 'OpenGround — AGS export & KeyLogBook import',
    body: 'Approved logs export to OpenGround in a single click with manager review comments attached. KeyLogBook driller remarks flow in via webhook and are professionalised into Site Logs that feed the timesheet on approval — closing the loop between the driller and the engineer.',
    proof: 'Detectors route KeyLogBook diary entries as Site Logs, not installation pipes.',
  },
  {
    title: 'AssetPanda — live asset & compliance sync',
    body: 'AssetPanda syncs asset and compliance status live so rig, machinery and lifting-gear data is always current — stock levels, warehouse locations and condition all pulled automatically. No manual re-keying between systems, and expired or needs-service items are auto-deactivated.',
    proof: 'Asset status arrives automatically — never manually attached.',
  },
];

export const fieldCrewPoints = [
  {
    title: 'Mobile-first, offline-capable',
    body: 'Crews log from their phone on site — even with no signal. Entries sync automatically once they are back online. No paper, no lost notes, no "I will write it up tonight and forget".',
    proof: 'Offline flag stamped on every record that synced later.',
  },
  {
    title: 'Daily workflow in four steps',
    body: 'Arrive on site → sign the briefing → log activity as you go → submit timesheet from your phone. The app generates the timesheet from the logs, so the crew enters less, not more.',
    proof: 'Timesheet built from approved daily summary — not self-reported hours.',
  },
  {
    title: 'Early-leave & delay capture',
    body: 'Early departures and job delays are captured with a reason at the point they happen, routed to the manager, and fed into the delay log automatically. No chasing people weeks later for an explanation.',
    proof: 'Delay log generated from driller remarks — not a separate form.',
  },
];

export const clientPortalPoints = [
  {
    title: 'Real-time verified progress',
    body: 'Clients get a branded portal link showing verified milestones, progress photos, documents and comments — all pushed automatically as work is approved. No progress calls, no status emails, no "I will send something over later".',
    proof: 'Milestones auto-post on log approval — zero manual steps.',
  },
  {
    title: 'Controlled visibility',
    body: 'Admins choose which sections each client sees — progress, schedule, photos, documents, team, billing. Sensitive commercial data stays internal; the client sees what builds trust.',
    proof: 'Per-section toggle on every job, stored against the portal token.',
  },
];

export const auditTrailPoints = [
  {
    title: 'Tamper-evident financial audit log',
    body: 'Every create, update and delete on locked financial entities — rate cards, billing rules, contracts, GL mappings — is captured with field-level before/after diffs, the actor, and a human-readable summary. The trail is admin-only and cannot be edited.',
    proof: 'Field-level diffs + actor attribution on every mutation.',
  },
  {
    title: 'One-click Job Packs',
    body: 'For any job, the system assembles a complete audit pack — logs, signatures, compliance records, personnel, equipment, delay logs, billing — in one click. Hand it to HSE, a client or an insurer without a morning in the filing cabinet.',
    proof: 'Job Pack view compiles every record linked to the job automatically.',
  },
];

export const competitivePoints = [
  {
    title: 'Built for ground investigation, not generic construction',
    body: 'Every feature — borehole tracking, SPT capture, AGS export, meterage billing — is designed for how this industry actually works. Off-the-shelf field apps force you to adapt to them; this adapts to you.',
    proof: 'AGS / KeyLogBook ingestion and OpenGround export are first-class, not bolt-ons.',
  },
  {
    title: 'One platform, not five',
    body: 'Rota, compliance, billing, payroll, client portal, audit trail and AI — all in one place, all sharing the same data. No integrations between disjointed tools, no reconciliation spreadsheets, no single source of truth that nobody trusts.',
    proof: 'Rate card, timesheet, invoice and AGS export all read from the same approved logs.',
  },
  {
    title: 'AI that reads your data, not the internet',
    body: 'The assistants query your live database — they do not guess. Ask "which rig needs service next?" and get the answer from your asset records, not a hallucination.',
    proof: 'Agents have scoped entity permissions — they only see and say what is real.',
  },
];

export const maintPoints = [
  {
    title: 'Engine hours, not calendar dates',
    body: "The system automatically calculates engine hours from approved InvestigationLog records — every drilling activity adds to the rig's running total. Servicing is triggered when a rig actually needs it, not when a calendar says it might.",
    proof: 'The recalculateUsageMaintenance automation runs daily, summing drilling minutes per rig since its last service.',
  },
  {
    title: 'Rig-Tooling Lockdown',
    body: 'A rig cannot be assigned to a job if any of its linked gear (slings, shackles, bits, rods) has expired compliance or is inactive. The validation runs at the point of assignment — the block happens at the yard, not after the gear has reached site.',
    proof: "The validateRigTooling function checks every linked asset's compliance_status before allowing assignment.",
  },
  {
    title: 'Geotechnical Risk Heatmap',
    body: 'The dashboard ranks sites by geotechnical risk — aggregating approved delay logs (ground conditions, utility clashes, boulder refusals) into a heat score. Managers see which sites are likely to cause problems before the rig gets there.',
    proof: 'Derived from real historical delay data, not guesses. High-risk sites get more resources, not more surprises.',
  },
  {
    title: 'Auto-booked maintenance',
    body: 'When a rig crosses its usage threshold, the system automatically books a maintenance slot and notifies the responsible person — no one has to remember to schedule it. The fitter sees the booking, the rig manager sees the alert, the yard sees the status change.',
    proof: 'The autoBookMaintenance function creates the booking record and fires the notification in one step.',
  },
];

export const finAssurance = [
  {
    title: 'Unbilled WIP dashboard',
    body: 'A live widget aggregates every JobCostItem that has been logged but not yet invoiced, giving finance leaders immediate visibility into the "earned but unbilled" position. No more waiting for month-end to discover £40,000 of work that was done but never billed.',
    proof: 'Updates in real time as logs are approved and invoices are raised — the number is always current.',
  },
  {
    title: 'Realisation % tracking',
    body: 'The system tracks what percentage of logged work has actually been invoiced. A dropping realisation rate is the earliest warning sign of billing leakage — and it is visible on the dashboard, not buried in a spreadsheet.',
    proof: 'Invoiced ÷ earned, calculated live across all active jobs.',
  },
  {
    title: 'Automated charge calculation',
    body: 'Every investigation log and timesheet entry is automatically matched to a billing rule at the point of approval. The charge is calculated, not estimated. The client invoice and the internal cost come from the same data — they can never disagree.',
    proof: 'The calculateCharge function runs on every approved log and every submitted timesheet.',
  },
  {
    title: 'Invoice generation in one click',
    body: 'When a job is ready to invoice, the system assembles every chargeable line — cost items, hotel bookings, chargeable deliveries, approved timesheets, meterage revenue — into a formatted invoice with a single click. No manual line-item assembly, no missed charges.',
    proof: 'The autoGenerateInvoice function builds the full line-item list from live data.',
  },
  {
    title: 'AFP auto-population from all field data',
    body: 'Every AFP is continuously populated from live field records — deliveries, collections, equipment hires, driller logs, subcontractor logs, daily costs, approved timesheets and BOQ variations. A delivery signed off on site appears on the AFP within seconds. The billing team never has to re-key field data into the AFP, and nothing is missed because the system watches every source automatically.',
    proof: 'Nine entity automations upsert AFP line items in real time; the AFP is always a complete, current picture of earned revenue.',
  },
];

export const payrollPoints = [
  {
    title: 'One-click payroll export',
    body: 'Approved weekly timesheets export to CSV, Xero or Sage in one click — standard hours, overtime hours, and pay elements all pre-calculated. Records lock on export to prevent duplicate or modified pay runs.',
    proof: 'Export ID and timestamp stamped on every exported timesheet.',
  },
  {
    title: 'CIS-aware subcontractor pay',
    body: 'Because HMRC CIS verification stamps the tax rate on each contractor, payroll knows whether to deduct 30%, the higher rate, or pay gross — automatically. No manual cross-checking between the CIS register and the pay run.',
    proof: 'CIS tax rate read from the contractor record at export time.',
  },
  {
    title: 'Budget overrun alerts',
    body: 'A nightly automation checks every active job against configurable thresholds — budget overrun, margin drop, negative profit — and emails a digest to the people who need to know. Problems surface in hours, not at month-end.',
    proof: 'checkJobBudgetAlerts runs every night and emails a prioritised digest.',
  },
];

export const taskData = [
  { label: 'Compliance checking', manual: 8, automated: 0.5 },
  { label: 'Timesheet collation', manual: 6, automated: 1 },
  { label: 'AGS / report formatting', manual: 5, automated: 0.2 },
  { label: 'Client progress updates', manual: 4, automated: 0.5 },
  { label: 'Morning stand-up calls', manual: 3, automated: 0.1 },
  { label: 'Rig maintenance scheduling', manual: 4, automated: 0.5 },
  { label: 'AFP line-item assembly', manual: 5, automated: 0.2 },
  { label: 'Training renewal booking', manual: 2, automated: 0.1 },
];

export const roiPoints = [
  {
    title: '1. Time recovered',
    body: '25+ hours of management admin eliminated every week — compliance checking, timesheet collation, report formatting, progress chasing. That is 1,300+ hours per year of skilled time redirected from paperwork to operations.',
    value: '£58,500/yr',
  },
  {
    title: '2. Revenue protected',
    body: 'Every drilled metre and every unit of work is matched to an agreed rate at the point of logging. Work that is not logged cannot be billed — but work that IS logged is always priced. Billing leakage from undercharged or forgotten activity is eliminated entirely.',
    value: '3-5% revenue uplift',
  },
  {
    title: '3. Fines avoided',
    body: 'Automated LOLER, PUWER and PAT compliance tracking with expiry alerts means expired equipment never reaches site. A single LOLER breach can cost £20,000+ in fines and reputational damage. The system makes that outcome structurally impossible.',
    value: '£20k+ per avoided incident',
  },
  {
    title: '4. Faster cash collection',
    body: 'One-click AGS export and automated invoicing means work-completed to client-invoiced happens in days, not weeks. A 10-day reduction in the cash conversion cycle on £2m of WIP is worth £55,000 in improved cash flow at any given moment.',
    value: '10 days faster',
  },
];

// 45-minute timed agenda — the order to cover things in the meeting
export const agenda = [
  { step: '01', title: 'Opening & Executive Summary', mins: '5 min', body: 'Set the scene: why we built this, what changes for the business. Read the two-outcome summary (safety + margin) and state the ask up front so the room knows where this is going.' },
  { step: '02', title: 'Integrations & Ecosystem', mins: '4 min', body: 'Show the connected system — SAP Concur, Bob HR, HMRC CIS, OpenGround, SafetyCulture, AssetPanda. Frame it as one platform replacing five disjointed tools and the reconciliation spreadsheets between them.' },
  { step: '02b', title: 'Customisable Dashboard', mins: '3 min', body: 'Show the Customise button — drag a widget, resize it, toggle one on. Emphasise: the layout saves per-user and follows them across devices. Every manager gets their own dashboard.' },
  { step: '03', title: 'Safety & Compliance Demo', mins: '8 min', body: 'Open the Safety Hub — critical alerts, open audits, overdue actions, all synced from SafetyCulture. Show the red alert banner. Then Log QC dashboard, an anomaly flag and a bulk approve. End on the hazard map.' },
  { step: '04', title: 'Field Crew Experience', mins: '4 min', body: 'Show the mobile daily workflow on a phone view — arrive, sign briefing, log, submit. Emphasise: the crew enters LESS, not more. The app removes admin, it does not add it.' },
  { step: '05', title: 'Financial Performance Demo', mins: '8 min', body: 'Open a drilling job → Site Logs (days logged + meterage) → Billing tab (calculated charge from the rate card). Run the one-click AGS export live. Connect site activity straight to the P&L.' },
  { step: '06', title: 'AI & Automation', mins: '6 min', body: 'Demo the Staff Assistant answering a live question. Mention the Drilling Intelligence and Scheduling agents, the automated stand-up digest and milestone auto-push. Position AI as the reading/checking/chasing layer, not a replacement for the engineer.' },
  { step: '07', title: 'Client Portal & Audit Trail', mins: '4 min', body: 'Open a client portal link — verified milestones, photos, documents. Then show the one-click Job Pack and the tamper-evident financial audit log. This is the "we can prove everything" slide.' },
  { step: '08', title: 'ROI & Time Savings', mins: '4 min', body: 'Walk through the time-savings chart and the four ROI mechanisms. Land the net annual return figure. Make the business case concrete — this pays for itself in the first quarter.' },
  { step: '09', title: 'Close & Commitments', mins: '2 min', body: 'Restate the two promises. Ask: "What would make you confident to roll this out across all crews?" Capture concerns, agree a follow-up date, name a pilot crew for next week. Leave with an owner and a date.' },
];

export const script = [
  {
    phase: 'Before you start (2 min)',
    items: [
      { tag: 'Setup', text: 'Open the app on the big screen, logged in to the admin dashboard. Pre-load a drilling job with approved logs in a tab so you do not search live.' },
      { tag: 'Check', text: 'Confirm the compliance tiles are fresh (run a sync if the last sync is older than a day). Stale data undermines the whole pitch.' },
      { tag: 'Say', text: '"Thanks for your time. I want to show you how we have turned site records from a paperwork problem into a safety and margin advantage. I will keep it to about 45 minutes and leave plenty of room for questions."' },
    ],
  },
  {
    phase: 'Section 1 — Safety & Compliance (8 min)',
    items: [
      { tag: 'Show', text: 'Compliance & Audit → Safety Hub. The critical alerts, open audits and overdue actions — all synced from SafetyCulture.' },
      { tag: 'Say', text: '"This is the Safety Hub. Every audit, incident and corrective action syncs from SafetyCulture every 30 minutes. If a critical issue is open, a red banner appears on every page in the app — no one can miss it. SafetyCulture is our single source of truth for safety."' },
      { tag: 'Show', text: 'Click through to the Incidents tab. Point at the near-miss and RIDDOR-reportable counts.' },
      { tag: 'Say', text: '"Every near-miss, accident and dangerous occurrence is tracked here, with AI-assisted root cause analysis and RIDDOR flagging built in."' },
      { tag: 'Show', text: 'Navigate to Assets & Fleet. The compliance tiles, then one expired or expiring asset card.' },
      { tag: 'Say', text: '"Every rig, machine, trailer and piece of lifting gear is synced live from AssetPanda. If something expires or needs service, it is deactivated here and cannot be added to a job. That block happens at the yard — not after the asset has reached site."' },
      { tag: 'Show', text: 'Click that asset → Asset Passport. The maintenance timeline, responsible person, service history.' },
      { tag: 'Say', text: '"This is the full audit trail for that asset — last service, next service, who is responsible. If HSE walk in tomorrow, this is what we hand them, in one click, not after a morning in the filing cabinet."' },
      { tag: 'Ask', text: '"Honestly — how long would it take us to pull that together for an auditor today?"' },
      { tag: 'Show', text: 'Log Quality Control dashboard. Point at the pending, approved and queried counts and the review progress bar.' },
      { tag: 'Say', text: '"Every entry from site — driller remarks, trial pit logs, samples — comes in here for manager review. The system flags missing photos, SPT anomalies and water level discrepancies the same day they are logged, not three weeks later when we are writing the report."' },
      { tag: 'Show', text: 'Open one Queried log. Point at the flagged issue and the manager note.' },
      { tag: 'Ask', text: '"How often do we only discover missing data after the crew has left site?"' },
    ],
  },
  {
    phase: 'Section 2 — Financial & Margin (8 min)',
    items: [
      { tag: 'Show', text: 'A drilling job → Site Logs tab. Point at the "Days Logged" counter and the driller activity list.' },
      { tag: 'Say', text: '"Every day logged here is tied to a rate in our Schedule of Rates. If a metre is not logged, it did not happen — and we cannot bill what we cannot see. The crew cannot drill a metre that is not captured."' },
      { tag: 'Show', text: 'Billing tab for the same job — the calculated charge and the line items.' },
      { tag: 'Say', text: '"Because the logs are approved, the timesheets and the client charges come from the same data. One source of truth — no re-keying, no billing leakage, and payroll and invoicing can never disagree."' },
      { tag: 'Ask', text: '"Where do we currently lose money between site and invoice?"' },
      { tag: 'Show', text: 'Run the one-click AGS export live, then open the downloaded file.' },
      { tag: 'Say', text: '"That is our OpenGround file, with manager review comments attached for the Senior Engineer. Done. That used to be hours of manual formatting — it is now seconds."' },
    ],
  },
  {
    phase: 'Section 2b — Customisable Dashboard (3 min)',
    items: [
      { tag: 'Show', text: 'Click the Customise button on the dashboard. Drag a widget to a new position. Click the size button to make it full-width.' },
      { tag: 'Say', text: '"Every manager builds their own dashboard. Drag widgets around, resize them, show or hide the ones you use. It saves automatically — log in on your phone tomorrow and your layout is there. No two managers need to see the same thing."' },
      { tag: 'Ask', text: '"How much time do you spend every morning opening different screens to get the information you need?"' },
    ],
  },
  {
    phase: 'Section 3 — Integrations & AI (10 min)',
    items: [
      { tag: 'Show', text: 'Settings → SAP Concur Sync, Bob HR Sync, CIS Verification. Point at the "Connected" status on each.' },
      { tag: 'Say', text: '"This is not a standalone app — it is connected to the systems we already pay for. SafetyCulture syncs every 30 minutes, expenses sync to Concur, holidays sync to Bob HR, subcontractors are verified against HMRC, logs export to OpenGround. One platform, not five."' },
      { tag: 'Show', text: 'Open the Staff Assistant chat. Ask it a live question: "Which rigs need service next?"' },
      { tag: 'Say', text: '"That answer came from our live asset data — it did not guess. The AI does the reading and the checking so the engineer can do the engineering."' },
      { tag: 'Ask', text: '"How much time do we spend every week just gathering information to make a decision?"' },
    ],
  },
  {
    phase: 'Close & commitments (2 min)',
    items: [
      { tag: 'Say', text: '"So two promises: safer, audit-ready site records — and every metre we drill billed accurately and faster. The infrastructure is built and the integrations are live. What is left is adoption."' },
      { tag: 'Ask', text: '"What would make you confident to roll this out across all crews?"' },
      { tag: 'Capture', text: 'Write down every concern raised. Agree a follow-up date before you leave the room — an open concern with no owner will kill momentum.' },
      { tag: 'Commit', text: 'Name one job or crew to pilot on next week, and who will own getting them logging through the app.' },
    ],
  },
  {
    phase: 'Likely objections — ready answers',
    items: [
      { tag: 'If', text: '"The crew will not use it / it is too much admin for them." → The daily site log takes two minutes and auto-generates the timesheet, so it removes admin rather than adding it. The crew enters less, not more.' },
      { tag: 'If', text: '"We already track this on paper." → Paper cannot be queried, flagged or exported in one click. The cost is not the paper — it is the re-keying, the missing data and the audit risk.' },
      { tag: 'If', text: '"Will it slow the driller down?" → Logging happens in the natural gaps while drilling. The KeyLogBook sync can pull remarks automatically, so the driller does not even retype.' },
      { tag: 'If', text: '"What if it is wrong?" → That is exactly what Log QC is for. A queried log is a feature, not a failure — it means we caught it the same day.' },
      { tag: 'If', text: '"Is the AI safe?" → The assistants only query our own database with scoped permissions. They cannot see the internet, they cannot edit financial records, and they cite the records behind every answer.' },
    ],
  },
];

export const pullQuotes = {
  dashboard: 'Every manager sees a different dashboard — the one they built. It saves automatically and follows them across every login and every device. No two managers need to see the same thing.',
  safety: 'Safety is no longer a folder of paper that gets audited once a year. It is a live, queryable record of every decision made on site — available the moment it is asked for.',
  finance: 'Margin is protected at the point of capture, not recovered at the point of invoice. We are billing what actually happened on site — every time.',
  ai: 'The AI does not replace the engineer — it does the reading, the checking and the chasing so the engineer can do the engineering.',
  maintenance: 'We service rigs when they need it, not when the wallchart says we might. That is less downtime, less waste, and fewer failures on site.',
  assurance: 'If we did the work, it is in the system. If it is in the system, it is on the invoice. That is the chain of custody for revenue.',
  integrations: 'One platform, connected to everything we already pay for. No more five tools and the spreadsheet that reconciles them.',
};