// ============================================================
// Team Briefing Pack — Content (Full Rewrite)
// All talking points, hub summaries, and deep-dive data for the
// team-briefing presentation pack. Pure data, no rendering logic.
// ============================================================

// ── Part 1: Why We Built This ──
export const whyBuilt = {
  title: 'Why We Built This Platform',
  subtitle: 'The problem we faced, the solution we built, what it changes',
  intro: 'Ground Control runs complex ground investigation and drilling operations across multiple sites, crews and rigs. For years, the data that proves what we did — drilled metres, trial pit observations, safety checks, compliance records — lived on paper, in spreadsheets, and across five or six disconnected software tools. This platform replaces all of that with one digital system that captures everything at source, connects to the tools we already pay for, and gives every manager real-time visibility into operations, safety and margin.',
  problems: [
    'Paper site records that could not be queried, flagged or exported — only filed in cabinets',
    'Five disconnected tools (SafetyCulture, Concur, Bob HR, OpenGround, Asset Panda) with reconciliation spreadsheets between them',
    'Billing leakage — work done on site that was never matched to an agreed rate or invoiced',
    'Compliance gaps discovered at audit time, not at the point of capture',
    'No real-time visibility into which crew is where, what rig needs service, or what work is unbilled',
    'Access requests and approvals scattered across emails and standalone pages — nothing tracked centrally',
  ],
  solution: 'One platform — built specifically for ground investigation — that captures every field activity digitally, connects to every system we already use, and professionalises raw site data into manager-reviewed records that feed compliance, payroll and billing automatically. Every approval, alert and request now flows through a single Universal Inbox so nothing gets lost in an email folder.',
  outcomes: [
    { label: 'Safety', value: 'Live, queryable audit trail — every decision on site is captured and time-stamped' },
    { label: 'Margin', value: 'Every drilled metre matched to an agreed rate — billing leakage eliminated' },
    { label: 'Efficiency', value: '25+ hours of management admin eliminated every week through automation' },
    { label: 'Compliance', value: 'Expired equipment never reaches site — blocks happen at the yard, not on site' },
    { label: 'Visibility', value: 'One inbox for every approval, alert and request — nothing lost or forgotten' },
    { label: 'Migration', value: 'A clear Power Apps + Azure migration path keeps us sovereign and scalable' },
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
      'Enterprise admins can loan idle rigs, vehicles and crews between divisions from one page',
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
      'My Requests tab on every profile — holiday, expense, payslip and shift-swap requests in one place',
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
      'Predictive maintenance flags vehicles before they break down, not after',
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
      'Push-to-Panda sends local-only assets to Asset Panda so the inventory is always complete',
    ],
  },
  {
    name: 'Compliance Hub',
    icon: 'ShieldCheck',
    summary: 'Safety, audits, training gaps and site readiness — synced from Mitti (SafetyCulture) with hazard mapping and incident reporting.',
    talkingPoints: [
      'Mitti sync pulls site safety audits and inspection forms every 30 minutes',
      'Red alert banner on every page when critical safety issues are open',
      'GPS-tagged hazard map — every underground service encounter plotted on site',
      'Incident reporting with AI-assisted root cause analysis and RIDDOR flagging',
      'Training gap analysis — which crew members lack required qualifications for their team',
      'Toolbox talks and site readiness gates before crews can start work',
      'Mitti action routing — audit action items auto-routed to the right person by category',
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
      'AFP dispute workflow — client disputes tracked per line item with counter-offers and history',
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
      '3-stage pick-list sign-off — Picked, Loaded, Driver Check — each with a drawn signature',
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
      'Decommissioning workflow — finish a job and sweep all assets back to the yard',
    ],
  },
  {
    name: 'Settings & Integrations',
    icon: 'Settings',
    summary: 'Every integration, access level, migration tool and system configuration — one hub for connecting and controlling the whole platform.',
    talkingPoints: [
      'Integration hub — Mitti, Concur, Bob HR, HMRC CIS, OpenGround, Asset Panda, Geotab, Holman',
      'Universal Inbox — every approval, alert and request in one place with SLA tracking',
      'Access levels — permission groups controlling what each staff member can see and do',
      'Data & Migration section — Power Apps roadmap, build hub, Azure plan, M365 guide all in one place',
      'Email template builder — branded emails for schedules, reminders and reports',
      'Report template builder — custom report layouts for clients and internal use',
      'Backup and restore — division-level snapshots for disaster recovery',
      'Office help guides — 25 seeded topics covering every admin module',
    ],
  },
];

// ── Part 3: Deep-Dive — Recent Major Work ──
export const deepDive = [
  {
    name: 'Power Apps Migration Roadmap',
    icon: 'GitBranch',
    summary: 'An 8-phase roadmap to rebuild the platform on Microsoft Power Apps — Dataverse, model-driven apps, canvas apps, Power Automate flows and Power BI dashboards — with 1:1 feature parity.',
    talkingPoints: [
      'Phase 0: Foundation — Power Platform environment, Dataverse, Entra ID SSO, solution structure',
      'Phase 1: Core data schema — 90+ Base44 entities recreated as Dataverse tables with RLS',
      'Phase 2: Model-driven app — the admin back office with views, forms and business process flows',
      'Phase 3: Canvas apps — the field-facing mobile apps for crews, drivers and subcontractors',
      'Phase 4: Power Automate — 180+ backend functions rebuilt as cloud flows with triggers',
      'Phase 5: Power BI — embedded dashboards replacing the React widget grid',
      'Phase 6: Data migration — CSV export from Base44, Power Query Dataflows into Dataverse',
      'Phase 7: Cutover — parallel run, validation, go-live and decommission the old platform',
      'Every phase has a downloadable code pack — Dataverse schemas, flow bundles, PowerFx source',
    ],
  },
  {
    name: 'Power Apps Build Hub',
    icon: 'Code',
    summary: 'A self-service build hub that generates the Dataverse schema document, Power Automate flow bundles, PowerFx source code, integration guides and Claude AI build scripts — ready to hand to a developer.',
    talkingPoints: [
      'Dataverse Schema Pack — every entity as a table definition with fields, types and relationships',
      'Power Automate Flow Bundle — every backend function as a flow definition with triggers and actions',
      'PowerFx Source — the formula logic for canvas app screens and controls',
      'Integration Guide — how each external system (Geotab, Asset Panda, Mitti, Concur) connects',
      'Claude Build Script — a conversation script that walks Claude through building each component',
      'Download all five volumes in one click — the complete developer handoff pack',
    ],
  },
  {
    name: 'Azure Migration — 13-Week Plan',
    icon: 'Cloud',
    summary: 'An alternative migration path to a sovereign, enterprise-owned Azure stack — Azure SQL, Entra ID, Azure Functions — with 1:1 feature parity and a printable A3 wall chart.',
    talkingPoints: [
      '13-week continuous-phase migration timeline with a 1-week stabilization buffer',
      '90+ entities → Azure SQL tables with Row-Level Security via SESSION_CONTEXT',
      '180+ backend functions → Azure Functions (HTTP triggers for webhooks, Timer triggers for schedules)',
      'Auth moves from Base44 email/OTP to Microsoft Entra ID (MSAL) — same login experience',
      'All secrets move to Azure Key Vault; file storage to Azure Blob; realtime to SignalR',
      'Running cost ~£220–300/mo vs the current platform subscription — scales with usage',
      'Full data sovereignty: UK South region, GDPR-compliant, enterprise-owned and auditable',
      'A3 printable wall chart lays out the full roadmap for the office wall',
    ],
  },
  {
    name: 'Feature Compatibility Audit',
    icon: 'Grid3x3',
    summary: 'A live audit matrix that scores every platform feature for Power Apps transferability — full transfer, partial, rebuild, or not available — so we know exactly what carries over and what needs rebuilding.',
    talkingPoints: [
      'Every module scored: Dashboard, Jobs, Scheduling, Staff, Assets, Fleet, Compliance, Financial, Logistics, Reports, Settings',
      'Verdicts: Full Transfer (native Power Apps equivalent), Partial (needs custom work), Rebuild (no equivalent), Not Available',
      'Executive summary shows the percentage of features that transfer cleanly vs need work',
      'Print-ready report for stakeholder review — no guessing about what the migration covers',
      'Informs the build effort estimates and the migration timeline',
    ],
  },
  {
    name: 'Universal Inbox & Approval Consolidation',
    icon: 'Inbox',
    summary: 'Every approval, alert and request across the entire platform now flows through one Universal Inbox — no more scattered emails or standalone queues. Access requests, timesheets, AFPs, early leave, delays, pricing reviews and more all land in the same place.',
    talkingPoints: [
      'One inbox for every actionable item — approvals, alerts and notices from every hub',
      'Access requests now route to the inbox — the old Pending Access Queue and Access Gate Settings pages are gone',
      'When a new user signs in, registerPendingAccess creates an inbox item for each approver — they approve or reject from the inbox',
      'actionInboxItem handles the approve/reject decision, updates the user\'s access status and sends the welcome email automatically',
      'SLA tracking — every item gets a deadline; overdue items escalate to fallback approvers',
      'Hub badge counts show pending items per hub in real time',
      'Managers can delegate approvals when they are out of office',
    ],
  },
  {
    name: 'My Requests Tab in Profile',
    icon: 'FileText',
    summary: 'Every staff member now has a "My Requests" tab on their profile where they can submit holiday, expense, payslip and shift-swap requests — and track the status of each one — without calling the office.',
    talkingPoints: [
      'One tab for every self-service request — holiday, expense, payslip, equipment, shift swap',
      'Holiday requests capture date range and reason, then notify the manager for approval',
      'Expenses are saved as cost records linked to the job',
      'Shift swap marketplace — offer a shift, a colleague claims it, the manager approves',
      'Every request shows a status timeline — submitted, in progress, fulfilled, rejected',
      'Pending requests can be deleted by the staff member or the admin',
      'Reduces phone calls to the office — everything is tracked in the system',
    ],
  },
  {
    name: 'Office Help Guides',
    icon: 'BookOpen',
    summary: '25 comprehensive help guides seeded for office staff — covering every admin module from Dashboard and Jobs to AFP Builder, CVR, Invoicing, Rate Cards, Permissions and the Client Portal. Accessible from Help → Help Guides.',
    talkingPoints: [
      '25 topics covering every office-facing module — Dashboard, Jobs, Scheduling, Staff, Assets, Fleet, Compliance, Billing, Reports, Settings',
      'Deep-dive guides for AFP Builder, CVR, Invoicing, Rate Cards, Disputes, Payroll',
      'Integration guides for Geotab, Asset Panda, Mitti, Bob HR, Concur, CIS',
      'Inbox & Approvals guide — how the Universal Inbox works for office staff',
      'Permissions guide — how access levels and permission groups work',
      'Client Portal guide — how to invite clients and what they can see',
      'All accessible from the Help page — no PDF download needed, searchable on screen',
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
      'Compliance tiles refresh when Mitti or Asset Panda syncs complete',
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
        'Universal Inbox means every approval and alert lands in one place — nothing lost in email',
      ],
    },
    {
      role: 'Field Crew',
      points: [
        'Log from your phone on site — even offline, entries sync when you are back online',
        'The app generates your timesheet from your logs — you enter less, not more',
        'Daily workflow in four steps: arrive, sign briefing, log activity, submit',
        'My Requests tab — request holidays, log expenses and swap shifts without calling the office',
      ],
    },
    {
      role: 'Compliance & Safety',
      points: [
        'Every safety record live and queryable — no more filing cabinets at audit time',
        'Expired equipment blocked at the yard before it reaches site',
        'One-click Job Pack assembles the complete audit trail for any job',
        'Mitti action routing sends audit action items to the right person automatically',
      ],
    },
    {
      role: 'Finance & Billing',
      points: [
        'Every drilled metre matched to an agreed rate automatically — no billing leakage',
        'Unbilled WIP dashboard shows earned-but-unbilled revenue in real time',
        'One-click invoice generation and AGS export — days not weeks to cash',
        'AFP dispute workflow tracks client pushback per line item — nothing forgotten',
      ],
    },
    {
      role: 'IT & Migration Team',
      points: [
        'Power Apps Build Hub generates the full developer handoff pack — schemas, flows, PowerFx, guides',
        'Feature Compatibility Audit shows exactly what transfers and what needs rebuilding',
        'Azure Migration Plan gives a sovereign alternative with a printable A3 wall chart',
        'M365 Setup Guide covers Entra ID SSO, SharePoint and Teams configuration',
      ],
    },
  ],
};