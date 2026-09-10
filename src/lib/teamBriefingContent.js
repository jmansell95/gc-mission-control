// ============================================================
// Team Briefing Pack — Content
// All talking points, hub summaries, and deep-dive data for the
// team-briefing presentation pack. Pure data, no rendering logic.
// ============================================================

// ── Part 1: Why We Built This ──
export const whyBuilt = {
  title: 'Why We Built This Platform',
  subtitle: 'The problem we faced, the solution we built, what it changes',
  intro: 'Ground Control runs complex ground investigation and drilling operations across multiple sites, crews and rigs. For years, the data that proves what we did — drilled metres, trial pit observations, safety checks, compliance records — lived on paper, in spreadsheets, and across five or six disconnected software tools. This platform replaces all of that with one digital system that captures everything at source, connects to the tools we already pay for, and gives every manager real-time visibility into operations, safety and margin.',
  problems: [
    'Paper site records that could not be queried, flagged or exported — only filed',
    'Five disconnected tools (SafetyCulture, Concur, Bob HR, OpenGround, AssetPanda) with reconciliation spreadsheets between them',
    'Billing leakage — work done on site that was never matched to an agreed rate or invoiced',
    'Compliance gaps discovered at audit time, not at the point of capture',
    'No real-time visibility into which crew is where, what rig needs service, or what work is unbilled',
  ],
  solution: 'One platform — built specifically for ground investigation — that captures every field activity digitally, connects to every system we already use, and professionalises raw site data into manager-reviewed records that feed compliance, payroll and billing automatically.',
  outcomes: [
    { label: 'Safety', value: 'Live, queryable audit trail — every decision on site is captured and time-stamped' },
    { label: 'Margin', value: 'Every drilled metre matched to an agreed rate — billing leakage eliminated' },
    { label: 'Efficiency', value: '25+ hours of management admin eliminated every week through automation' },
    { label: 'Compliance', value: 'Expired equipment never reaches site — blocks happen at the yard, not on site' },
  ],
};

// ── Part 2: Platform Tour — Every Hub ──
export const hubTour = [
  {
    name: 'Enterprise Dashboard',
    icon: 'Building2',
    summary: 'The multi-hub command centre — a bird\'s-eye view of the entire business with real-time stats, cross-division resource boards, and drill-down into any business unit.',
    talkingPoints: [
      'Single screen showing active jobs, crew deployment, fleet status and financial health',
      'Multi-hub layout — each business stream (drilling, groundworks, geotech) has its own dashboard',
      'Cross-division resource board shows where crews and rigs are deployed across the whole company',
      'Real-time stats update as field data flows in — no refreshing, no stale numbers',
    ],
  },
  {
    name: 'People Hub',
    icon: 'Users',
    summary: 'People, crews, training and compliance in one place — from rota building to qualification tracking to holiday accrual.',
    talkingPoints: [
      'Unified rota builder — drag-and-drop crew assignments with conflict detection',
      'Training matrix — every qualification, expiry date and training gap visible per crew member',
      'Compliance wallet — CSCS, CPCS, NPORS cards stored digitally with expiry alerts',
      'Holiday pay accrual tracked automatically from approved timesheets',
      'Contacts tab for subcontractors and agencies with crew pairing and Market Dojo onboarding status',
    ],
  },
  {
    name: 'Fleet Hub',
    icon: 'Truck',
    summary: 'Vehicles, tracking, maintenance and driver safety — synced live from Geotab GPS, Holman fleet and DVLA.',
    talkingPoints: [
      'Live fleet map — every vehicle\'s current location, driver and job in real time',
      'DVLA sync pulls MOT, tax, fuel type and spec automatically — no manual data entry',
      'Driver safety scores from Geotab — harsh braking, speeding and cornering events tracked',
      'Maintenance booking with provider directory — Holman, tyre specialists, breakdown cover',
      'Mileage reconciliation between Geotab odometer and DVLA MOT history',
    ],
  },
  {
    name: 'Asset Hub',
    icon: 'Package',
    summary: 'Rigs, equipment, lifting gear and portable appliances — synced live from Asset Panda with compliance, depreciation and utilisation tracking.',
    talkingPoints: [
      'Every asset synced from Asset Panda — stock levels, warehouse locations, condition',
      'Compliance status auto-derived from inspection dates — expired items auto-deactivated',
      'Asset Passport — full maintenance timeline, service history and responsible person',
      'Depreciation tracking — straight-line, reducing balance or units-of-production per asset',
      'QR code scanning — book assets in and out by scanning printed labels',
      'PAT testing console for portable appliance compliance',
    ],
  },
  {
    name: 'Compliance Hub',
    icon: 'ShieldCheck',
    summary: 'Safety, audits, training gaps and site readiness — synced from SafetyCulture with hazard mapping and incident reporting.',
    talkingPoints: [
      'SafetyCulture sync every 30 minutes — single source of truth for all safety data',
      'Red alert banner on every page when critical safety issues are open',
      'GPS-tagged hazard map — every underground service encounter plotted on site',
      'Incident reporting with AI-assisted root cause analysis and RIDDOR flagging',
      'Training gap analysis — which crew members lack required qualifications for their team',
      'Toolbox talks and site readiness gates before crews can start work',
    ],
  },
  {
    name: 'Financial Hub',
    icon: 'PoundSterling',
    summary: 'Billing, AFPs, CVRs, invoicing and margin protection — from rate card to invoice in one connected pipeline.',
    talkingPoints: [
      'Master Price List (rate card) drives every charge — no manual pricing',
      'AFP (Application for Payment) auto-populated from live field data in real time',
      'CVR (Cost Value Reconciliation) tracks earned vs spent on every job',
      'One-click invoice generation — assembles every chargeable line automatically',
      'Unbilled WIP dashboard — live visibility into earned-but-unbilled revenue',
      'Subcontractor margin guard — CIS-aware billing with tax rate stamped from HMRC',
      'Financial audit log — tamper-evident, field-level diffs on every locked record',
    ],
  },
  {
    name: 'Logistics & Driver Hub',
    icon: 'Map',
    summary: 'Deliveries, collections, route optimisation and load planning — with GPS tracking and digital sign-off.',
    talkingPoints: [
      'Delivery board — pending, in-progress and completed deliveries across all jobs',
      'Route optimisation via Google Maps Directions API with waypoint optimisation',
      'Load planner — vehicle capacity checks with weight and volume tracking',
      'Digital sign-off with signature, photo and GPS coordinates at point of delivery',
      'Trailer assignment and towing safety checklist before departure',
      'Driver hub — mobile-first view for drivers with their day\'s route and stops',
      'Goods-in scanner — receive deliveries into the depot with QR scanning',
    ],
  },
  {
    name: 'Operations Hub',
    icon: 'ClipboardList',
    summary: 'Jobs, rota, scheduling and site activity — the operational backbone connecting crews to jobs to billing.',
    talkingPoints: [
      'Job management — from creation to completion with delays, site activity and client portal links',
      'Unified rota builder — weekly schedule with crew-rig assignment and conflict detection',
      'Site activity logs — driller remarks, trial pit logs, samples and borehole progress',
      'Weather-aware rota flags — dangerous conditions show red before crews arrive',
      'Crew availability heatmap — see who is free, who is on leave, who is double-booked',
      'Job packs — complete audit pack assembled in one click for HSE or client',
    ],
  },
  {
    name: 'Settings & Integrations',
    icon: 'Settings',
    summary: 'Every integration, access level and system configuration — one hub for connecting and controlling the whole platform.',
    talkingPoints: [
      'Integration hub — SafetyCulture, Concur, Bob HR, HMRC CIS, OpenGround, AssetPanda, Geotab, Holman',
      'Access levels — permission groups controlling what each staff member can see and do',
      'Coming Soon manager — grey out integrations that are not yet ready for use',
      'Email template builder — branded emails for schedules, reminders and reports',
      'Report template builder — custom report layouts for clients and internal use',
      'Backup and restore — division-level snapshots for disaster recovery',
    ],
  },
];

// ── Part 3: Deep-Dive — Recent Major Work ──
export const deepDive = [
  {
    name: 'Azure Migration — 13-Week Plan',
    icon: 'Cloud',
    summary: 'We are migrating the entire platform from Base44 to a sovereign, enterprise-owned Microsoft Azure stack — Azure SQL, Entra ID, Azure Functions — with 1:1 feature parity guaranteed.',
    talkingPoints: [
      '13-week continuous-phase migration timeline with a 1-week stabilization buffer',
      '90+ entities → Azure SQL tables with Row-Level Security via SESSION_CONTEXT',
      '180+ backend functions → Azure Functions (HTTP triggers for webhooks, Timer triggers for schedules)',
      'Auth moves from Base44 email/OTP to Microsoft Entra ID (MSAL) — same login experience',
      'All secrets move to Azure Key Vault; file storage to Azure Blob; realtime to SignalR',
      'Running cost ~£220–300/mo vs the current platform subscription — scales with usage',
      'Full data sovereignty: UK South region, GDPR-compliant, enterprise-owned and auditable',
    ],
  },
  {
    name: 'Multi-Hub Enterprise Dashboard',
    icon: 'Building2',
    summary: 'The Enterprise Dashboard has been restructured from a single screen into a multi-hub system — each operational domain (Staff, Fleet, Assets, Compliance, Financial, Operations) has its own dedicated hub with deep-dive views.',
    talkingPoints: [
      'Enterprise Hub Shell provides consistent branding and mobile-first navigation across all hubs',
      'Each hub has its own overview page with KPI tiles, insight cards and drill-down links',
      'Cross-division resource board shows crew and rig deployment across the whole company',
      'Crew availability heatmap — who is free, on leave, or double-booked across all divisions',
      'Business unit pages with per-division stats, staff counts and active job counts',
      'Consistent insight-card layout across desktop and mobile for every widget',
    ],
  },
  {
    name: '1:1 Parity Matrix',
    icon: 'Grid3x3',
    summary: 'A live tracking matrix that maps every Base44 artifact — every entity, function, automation, agent, webhook and auth flow — to its Azure equivalent, with completion tracking.',
    talkingPoints: [
      'Every entity mapped to an Azure SQL table with its RLS type (division, ownership, admin, public, complex)',
      'Every function categorised by trigger type — HTTP webhook, Timer scheduled, or HTTP on-demand',
      'Progress tracked per item with localStorage persistence — tick items off as you migrate them',
      'Searchable, filterable by category, with collapsible groups for easy navigation',
      'Summary stats at the top — total items, completed count, percentage',
    ],
  },
  {
    name: 'A3 Printable Wall Chart',
    icon: 'Printer',
    summary: 'A print-ready A3 landscape PDF that lays out the entire migration roadmap — 13-week timeline, target architecture, 1:1 parity summary, entity categories, risks and costs — designed to be hung on a wall.',
    talkingPoints: [
      'A3 landscape (420×297mm) with generous margins — nothing cut off or squashed',
      '13-week Gantt-style timeline with colour-coded phase bars and key milestones',
      'Target architecture table showing every layer\'s Base44 source and Azure target',
      '1:1 parity summary with entity, function, automation and agent counts',
      'Entity category breakdown showing how 90+ entities group into SQL table groups',
      'Risk and mitigation table with severity badges',
      'Indicative monthly cost breakdown for the Azure stack',
    ],
  },
  {
    name: 'Settings Overhaul',
    icon: 'Settings',
    summary: 'The settings page has been completely rebuilt — minimal overview, instant-action coming-soon locks, centralised integration status, and a clean sidebar with no redundant navigation.',
    talkingPoints: [
      'Single 4-tile stat strip on the overview — active, needs attention, coming soon, not configured',
      'Instant-action buttons for coming-soon locks — no more toggle-and-save fragility',
      'Centralised getSettingsHubStats backend function batches all integration statuses in one call',
      'SettingsSidebar filters out migrated items and shows coming-soon badges',
      'SettingsAccessGuard blocks access to integrations marked as coming soon',
      'Flat mobile navigation — no nested drawers, just a clean list on the overview',
    ],
  },
  {
    name: 'Real-Time Data Sync',
    icon: 'RefreshCw',
    summary: 'Site-wide real-time subscriptions on all core entities — jobs, rota, timesheets, staff, deliveries — so every screen updates the moment data changes, with no refreshing.',
    talkingPoints: [
      'useJobRealtimeSync hook subscribes to job, rota and timesheet entity events',
      'Delivery dashboard updates live as drivers complete stops',
      'Rota builder reflects assignment changes instantly across all viewers',
      'Compliance tiles refresh when SafetyCulture or AssetPanda syncs complete',
      'No polling — true push-based updates via entity subscriptions',
    ],
  },
  {
    name: 'Autopilot Agents',
    icon: 'Zap',
    summary: 'Autonomous agents that run on schedules and auto-act on high-confidence decisions — billing, scheduling, compliance, logistics and financial — with admin-tunable aggressiveness.',
    talkingPoints: [
      'AutopilotControl entity — each agent has status (active/paused/error), aggressiveness (conservative/balanced/aggressive)',
      'Billing Autopilot — auto-bills timesheets, auto-generates invoices, flags exceptions',
      'Payroll Autopilot — runs nightly, auto-builds daily timesheets from GPS and KeyLogBook data',
      'Compliance Autopilot — checks expiry, auto-books training renewals before lapse',
      'Decision count and exception count tracked per agent for audit',
      'Auto-pauses on error for safety — never runs blind on a failure',
    ],
  },
  {
    name: 'AI Assistants',
    icon: 'Sparkles',
    summary: 'Three in-app AI agents — Staff Assistant, Scheduling Assistant and Drilling Intelligence — that query live data and answer operational questions in plain English.',
    talkingPoints: [
      'Staff Assistant — answers "who is on site today?", "what rig needs service?", "show me overdue compliance"',
      'Scheduling Assistant — suggests crew assignments based on qualifications, availability and job type',
      'Drilling Intelligence — analyses drilling logs for ground condition patterns and flags anomalous SPT values',
      'All agents query the live database with scoped entity permissions — no hallucination, no internet access',
      'In-app conversation UI — no separate app, no context switching',
    ],
  },
];

// ── Closing: What This Means For The Team ──
export const closingPoints = {
  title: 'What This Means For You',
  subtitle: 'How the platform changes day-to-day work for every role',
  roles: [
    {
      role: 'Operations Managers',
      points: [
        'Real-time visibility into every job, crew and rig — no phone calls to find out where people are',
        'Automated morning digest replaces the 30-minute stand-up call round-robin',
        'Rota builder with conflict detection and weather flags — plan the week in minutes not hours',
      ],
    },
    {
      role: 'Field Crew',
      points: [
        'Log from your phone on site — even offline, entries sync when you are back online',
        'The app generates your timesheet from your logs — you enter less, not more',
        'Daily workflow in four steps: arrive, sign briefing, log activity, submit',
      ],
    },
    {
      role: 'Compliance & Safety',
      points: [
        'Every safety record live and queryable — no more filing cabinets at audit time',
        'Expired equipment blocked at the yard before it reaches site',
        'One-click Job Pack assembles the complete audit trail for any job',
      ],
    },
    {
      role: 'Finance & Billing',
      points: [
        'Every drilled metre matched to an agreed rate automatically — no billing leakage',
        'Unbilled WIP dashboard shows earned-but-unbilled revenue in real time',
        'One-click invoice generation and AGS export — days not weeks to cash',
      ],
    },
  ],
};