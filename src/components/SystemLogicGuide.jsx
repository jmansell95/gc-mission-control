import React, { useState } from 'react';
import { Download, Loader2, BookOpen, ShieldCheck, TrendingUp, Sparkles, HardHat, FileClock, Clock, Activity, Zap, FileText, Radar, Users, MessageSquare, Camera, Mic, MapPin, CalendarClock, Layers, Boxes, Truck, Inbox, ClipboardList, GraduationCap, ShoppingCart, QrCode, Database, GitBranch } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { EMBLEM_URL } from '@/components/Logo';

const BRAND_DARK = '#2E5A1A';
const BRAND_LEAF = '#8DC63F';
const SLATE_900 = '#0f172a';
const SLATE_700 = '#334155';
const SLATE_500 = '#64748b';
const SLATE_300 = '#cbd5e1';
const SLATE_100 = '#f1f5f9';
const WHITE = '#ffffff';

const SECTIONS = [
  {
    id: 'architecture',
    icon: Layers,
    title: 'Architecture & Data Isolation',
    desc: 'How division_id keeps every business stream\'s data in its own silo',
    items: [
      { stat: 'One Database, Many Business Streams', meaning: 'The platform uses a single shared database — not a separate database per business stream. Every operational record (Job, Staff, Timesheet, RotaAssignment, Vehicle, ShiftSwap, StaffMessage, etc.) carries a division_id field that tags which business stream it belongs to. This acts as a logical partition: functionally equivalent to each business stream having its own folder, without the cost and complexity of running separate databases.' },
      { stat: 'Row-Level Security (RLS)', meaning: 'Each entity has RLS rules that automatically filter every query at the database level. A user in the Geotechnical business stream physically cannot read, create or see a Job belonging to Land & Water — the database blocks it before any data reaches the screen. Admins and enterprise admins can see across all business streams; directors see only their managed business streams; standard users are locked to their own division_id. This is enforced server-side, not just hidden in the UI.' },
      { stat: 'Blank Slate Creation', meaning: 'When a new business stream is launched via the Business Stream Wizard, only a single business stream configuration record is created — its identity (name, code, type, colour), structure (enabled hubs, tabs, navigation) and settings (VAT rate, markup, briefing rules). No jobs, staff, rotas, timesheets or vehicles are copied or seeded. The business stream starts completely empty and is filled in by admins working within it after launch. The wizard warns you of this at every step.' },
      { stat: 'Child Records Inherit Scope', meaning: 'Records that belong to a job or staff member (JobCostItem, Invoice, Absence, JobComment, JobMilestone, DeliveryLog, BriefingSignature, etc.) do not carry their own division_id — they are scoped through their parent job_id or staff_id. Because the parent is business-stream-tagged and RLS-protected, the child records are effectively isolated too: a user who cannot see a business stream\'s jobs cannot see that business stream\'s cost items, invoices or deliveries.' },
      { stat: 'Enterprise-Wide Visibility', meaning: 'Enterprise admins and super admins bypass the business stream filter, giving them a cross-business-stream view for the Enterprise Dashboard, business-unit rollups and global settings. Directors see only their managed_division_ids. This tiered access — locked user, scoped director, global admin — is what makes the single-database model safe while still allowing enterprise oversight.' },
      { stat: 'Business Stream Backups', meaning: 'Because each business stream\'s data is tagged with division_id, the backup system can snapshot and restore a single business stream without touching any other. The DivisionSnapshot captures every record matching that division_id, plus the business stream\'s configuration, into a single restorable file. A failed change in one business stream can be rolled back independently.' },
    ],
  },
  {
    id: 'assets',
    icon: Boxes,
    title: 'Assets Hub',
    desc: 'How rigs, plant, lifting gear and PAT equipment are managed',
    items: [
      { stat: 'Asset Passport', meaning: 'Every asset (rig, machinery, trailer, lifting gear, portable appliance) has a full-page Asset Passport at /assets/:id. It brings together the asset\'s identity, live compliance status, maintenance timeline, deployment history, linked equipment, and financial lifecycle (revenue vs cost ROI) in one place. It is the single source of truth for everything about that piece of equipment.' },
      { stat: 'Asset Types', meaning: 'Six asset types: rig (drilling rigs — CP or rotary), machinery (excavators, mixers), trailer, vehicle, lifting (shackles, slings, chains, hooks linked to rigs), and portable_appliance (110V transformers, power tools, leads requiring PAT). Each type drives which compliance rules and maintenance logic apply.' },
      { stat: 'Compliance Rollup', meaning: 'A rig\'s overall compliance status is a rollup of its own LOLER/PUWER/PAT status plus the status of every linked lifting gear and portable appliance. If any linked item is expired, the rig is flagged non-compliant and cannot be assigned to a job. This prevents a rig passing inspection while its slings are out of date.' },
      { stat: 'Stock Levels (Asset Panda)', meaning: 'Live stock levels and warehouse locations are pulled from Asset Panda on a scheduled sync. Items reported "out of stock" or "needs service" are automatically deactivated so they cannot be added to jobs. Demo assets are skipped so showcase data is never pushed to or purged from external systems.' },
      { stat: 'Usage-Based Maintenance', meaning: 'For rigs and plant, maintenance is driven by accumulated engine hours (calculated from approved drilling logs), not just calendar dates. When hours_since_last_service crosses the service_interval_hours threshold (default 250h for rigs), the asset is flagged "due_soon" and a maintenance slot is auto-booked. Logging a service resets the hour counter.' },
      { stat: 'Financial Lifecycle', meaning: 'The Financial tab on each Asset Passport shows the full ROI: total revenue earned from approved billing records vs total cost (maintenance + servicing + straight-line depreciation from acquisition_cost). Net profit and ROI percentage update in real time as new billing and service records are added, giving finance a live view of whether each asset is paying for itself.' },
      { stat: 'QR Scanning', meaning: 'Every asset has a QR code. Field crews scan the QR to sign equipment out to a job, sign it back in on return, or report a fault — all from the Asset Scanner page (/scanner) or the mobile app. Scans update the asset\'s current_location (yard → in_transit → site → returned) and push stock-level updates to Asset Panda.' },
    ],
  },
  {
    id: 'dashboard',
    icon: Activity,
    title: 'Dashboard Stats',
    desc: 'What every number on the dashboard means',
    items: [
      { stat: 'Crew Utilisation %', meaning: 'The percentage of active staff who are on site today. Active staff = all staff where is_active is true. On site = RotaAssignment records for today. A low percentage means crews are under-utilised or the rota is not published.' },
      { stat: 'Active Jobs', meaning: 'Jobs where status is "in_progress". These are live jobs with crews on site. Planning, completed and on-hold jobs are excluded from this count.' },
      { stat: 'Timesheet Queue', meaning: 'Timesheet entries with status "submitted" — awaiting manager approval. Overdue entries are those submitted more than 48 hours ago without a decision.' },
      { stat: 'Overdue Actions', meaning: 'Safety action items (from SafetyCulture audits) whose due date has passed. These are corrective actions assigned from audit findings that have not been closed.' },
      { stat: 'Pending Deliveries', meaning: 'DeliveryLog records for today where status is "pending" or "in_progress". These are deliveries or collections scheduled for today that have not been completed.' },
      { stat: 'Three-Tier Dashboard', meaning: 'The dashboard is organised into three tiers: Operational Pulse (live exception metrics), Alerts & Action (items needing attention), and Deep Dive & Analytics (charts, forecasts, historical data). Drag widgets to reorder or toggle visibility via the customise button on each tier header.' },
      { stat: 'Mission Control Center', meaning: 'A unified command widget showing burn rate gauge, system health, outstanding revenue, and safety status in one view. It pulls from jobs, timesheets, invoices, and safety reports to give a single-glance operational picture.' },
      { stat: 'Idle Asset Transfers', meaning: 'The Idle Asset Transfer widget matches yard assets sitting idle with upcoming job delivery requirements and auto-generates transfer delivery legs. A daily automation at 6 AM runs the matching engine so gear moves to where it is needed without manual planning.' },
      { stat: 'Training Gap Scheduler', meaning: 'Scans all staff for expiring compliance certifications (LOLER, PUWER, first aid, etc.) and cross-references their rota to find free days for training. Suggests optimal training slots that do not conflict with job assignments.' },
    ],
  },
  {
    id: 'compliance',
    icon: ShieldCheck,
    title: 'Compliance Logic',
    desc: 'How LOLER, PUWER & PAT status is calculated',
    items: [
      { stat: 'Compliance Status', meaning: 'Derived from the most recent ServiceRecord of the relevant type. "compliant" = next expiry > 30 days. "expiring" = within 30 days. "expired" = past due. "unknown" = no service record on file.' },
      { stat: 'LOLER Interval', meaning: 'Default 6 months. Lifting equipment and rigs require a thorough examination every 6 months under LOLER reg 9. Editable per asset in Compliance Rules settings.' },
      { stat: 'PUWER Interval', meaning: 'Default 12 months. Work equipment (machinery, trailers, vehicles) inspected annually. High-risk plant may need shorter intervals.' },
      { stat: 'PAT Interval', meaning: 'Default 12 months for office, 3 months for construction sites. Portable electrical equipment (110V transformers, power tools, leads) tested via the PAT Testing Console.' },
      { stat: 'Expiring Warning Days', meaning: 'Default 30 days. Assets are flagged "expiring soon" when their next test is within this window. Drives the amber warning tiles.' },
      { stat: 'Hard-Stop Validation', meaning: 'AssignmentModal cross-references staff qualifications against job requirements. A staff member without the required qualification cannot be assigned — the system blocks the assignment, it does not warn.' },
      { stat: 'Compliance Passport Gate', meaning: 'When a rig is selected for a job in the Rig Gear Picker, the Compliance Passport Gate checks whether the rig\'s LOLER/PUWER/PAT certificates remain valid for the entire on-site period. If a cert expires during the job, assignment is blocked and a recertification prompt appears. If it expires soon after, a warning is shown.' },
    ],
  },
  {
    id: 'maintenance',
    icon: HardHat,
    title: 'Predictive Maintenance',
    desc: 'Usage-based servicing instead of calendar-based',
    items: [
      { stat: 'Engine Hours', meaning: 'Automatically calculated from approved InvestigationLog records. Every drilling activity (borehole_progress, sample_collection) contributes duration_minutes to the rig\'s running total since its last service. No manual hour-meter reading required.' },
      { stat: 'Service Threshold', meaning: 'A rig is flagged "due_soon" when its accumulated engine hours since the last service cross 250 hours. The threshold is configurable. At 250h, the system auto-books a maintenance slot and notifies the responsible person.' },
      { stat: 'Rig-Tooling Lockdown', meaning: 'Before a rig can be assigned to a job, the validateRigTooling function checks every linked asset (slings, shackles, bits, rods). If any linked gear is expired or inactive, the assignment is blocked with a specific reason for each blocked item.' },
      { stat: 'Maintenance Status', meaning: '"ok" = next service >30 days away. "due_soon" = within 30 days. "overdue" = past due. "unknown" = no service date recorded. Driven by next_service_date, which is set by the usage-based calculation or manually.' },
    ],
  },
  {
    id: 'financial',
    icon: TrendingUp,
    title: 'Financial Logic',
    desc: 'How charges, WIP and realisation are calculated',
    items: [
      { stat: 'Unified Financial KPIs', meaning: 'All financial stat boxes (Billing Hub, Admin Dashboard, Enterprise Financial Hub, Job Financials) now use a single shared calculation module (financialStats.js) so the numbers mean the same thing and add up correctly on every surface. Outstanding = sent + overdue invoices by gross_total. Overdue = status "overdue" OR status "sent" with due_date in the past, by gross_total. Collected/Revenue = paid invoices by gross_total. Total Invoiced = all non-void invoices by gross_total. Draft invoices are excluded from Outstanding everywhere.' },
      { stat: 'Outstanding', meaning: 'Invoices where status is "sent" or "overdue" — the client has been billed but payment has not been received yet. Excludes draft (not yet sent), paid (settled), and void (cancelled). Calculated using gross_total (including VAT) so it matches the amount the client actually owes.' },
      { stat: 'Overdue', meaning: 'Invoices where status is "overdue" OR status is "sent" with due_date in the past. This catches both invoices explicitly marked overdue and sent invoices whose payment deadline has passed without being flagged. Calculated using gross_total.' },
      { stat: 'Collected / Revenue', meaning: 'Invoices where status is "paid" — money received from the client. Same calculation on every surface. Uses gross_total so it matches the cash actually received.' },
      { stat: 'Total Invoiced', meaning: 'All non-void invoices (draft + sent + overdue + paid) by gross_total. This is the total value of all invoices ever issued, regardless of payment status. Void invoices are excluded because they are cancelled and represent no real obligation.' },
      { stat: 'Unbilled WIP', meaning: 'The sum of all JobCostItem amounts where the item has not been included on a paid invoice. This is "earned but unbilled" revenue — work that has been done and costed but not yet invoiced to the client.' },
      { stat: 'Realisation %', meaning: 'Invoiced amount ÷ earned amount across all active jobs. A dropping realisation rate is the earliest warning sign of billing leakage. The dashboard surfaces this as a live percentage.' },
      { stat: 'Charge Calculation', meaning: 'The calculateCharge function runs automatically on every approved InvestigationLog and submitted Timesheet. It matches the activity to a BillingRule (by task description or log type), applies the rate, and sets charge_amount and charge_breakdown on the record.' },
      { stat: 'Revenue Method', meaning: 'How a job earns money: "drilling_meterage" = £/metre, "groundworks_unit" = £/trial pit, "coring_unit" = £/core run, "day_rate" = fixed daily crew rate, "flat_fee" = single project fee. Set on the Team, inherited by the job.' },
      { stat: 'VAT Rate', meaning: 'Default 20% (UK standard rate). Applied to invoice net totals. Editable per job for zero-rated or exempt work. Falls back to the BusinessConfig default_vat_rate when not set on the job.' },
      { stat: 'VAT Liability', meaning: 'The total VAT on outstanding (sent + overdue) invoices. This is money collected from the client (as part of the gross_total) but not yet paid to HMRC. Shown on the Financial Overview widget so finance can track their HMRC obligation.' },
      { stat: 'Asset Financial Lifecycle', meaning: 'The Financial tab on each Asset Passport shows the full ROI of an asset: total revenue earned (from approved JobCostItem billing records) vs total cost (maintenance + servicing + straight-line depreciation). The net profit and ROI percentage update in real time as new billing and service records are added.' },
      { stat: 'Auto-Detect Billing from Remarks', meaning: 'Each investigation log entry has an "Auto-Detect Billing" button that sends the log\'s remarks to an LLM. The AI identifies billable events mentioned in the driller diary (e.g. "extra casing installed", "made up 10m of rods") and auto-creates JobCostItem billing entries with the correct rate from the Master Price List.' },
      { stat: 'Billable Items Quick Add', meaning: 'The BillableItemsQuickAdd component replaced the legacy multi-step billing wizard with an inline, single-panel entry form. Billing teams add cost items, labour, and hired equipment to a job in one panel — no wizard steps, no page navigation. Items are grouped by PO for tracking and flow directly into the AFP billing pipeline.' },
    ],
  },
  {
    id: 'ai',
    icon: Sparkles,
    title: 'AI Features',
    desc: 'What each intelligent assistant does',
    items: [
      { stat: 'Staff Assistant', meaning: 'A conversational AI copilot available to every user inside the app. It queries the live database to answer operational questions in plain English: "Who is on site today?", "What needs my approval?", "Show me overdue compliance." Available via the Sparkles button in the sidebar.' },
      { stat: 'Drilling Intelligence', meaning: 'A dedicated AI agent that analyses drilling logs for ground condition patterns, flags anomalous SPT values, identifies refusal trends, and surfaces geotechnical risks. It reads the logs so the engineer does not have to. Available via the HardHat button in the sidebar.' },
      { stat: 'Scheduling Assistant', meaning: 'An AI assistant that suggests crew assignments based on qualifications, availability and job type. It validates staff qualifications against crew requirements before suggesting an assignment — work that takes a scheduler 20 minutes takes seconds.' },
      { stat: 'Incident Auto-Analysis', meaning: 'When logging a safety incident, an AI analysis button appears after the description is entered. The LLM analyses the incident against UK HSE guidelines and RIDDOR requirements, then suggests a root cause, corrective actions with priority and owner, whether it is RIDDOR-reportable, and prevention notes. Suggestions can be applied to the report with one click.' },
      { stat: 'What-If Rota Sandbox', meaning: 'A sandbox tab in the Scheduling Hub that lets planners test rota changes before applying them. Add proposed assignments and the system calculates the impact on crew utilisation, job coverage, and cost. An AI analysis button assesses risk factors (overallocation, single-point-of-failure) and recommends approve, reject, or modify.' },
    ],
  },
  {
    id: 'field',
    icon: Users,
    title: 'Field Team Features',
    desc: 'Self-service, comms & productivity tools for field crews',
    items: [
      { stat: 'Staff Messenger', meaning: 'A business-stream-scoped in-app messaging system with crew-wide (business stream) broadcasts, 1:1 direct messages, and job-scoped group chats. Messages are real-time via entity subscriptions and secured by row-level security so crews only see messages within their own business stream. Accessible from the "More" tab on the staff dashboard.' },
      { stat: 'Shift Swap Marketplace', meaning: 'A marketplace where field staff can offer up their assigned shift for swap. Colleagues in the same business stream see the offer on the board and can claim it. The offering staff member\'s manager then approves or rejects the claim. On approval, the RotaAssignment is automatically reassigned to the claiming staff member — no manual rota editing required.' },
      { stat: 'Self-Service Hub', meaning: 'A one-stop panel for field staff to request holidays, log expenses, and request payslips without calling the office. Holiday requests capture date range and reason, and notify the staff member\'s manager for approval. Expenses are saved as DailyCost records linked to the job. All requests are tracked with a status timeline (submitted → approved/rejected).' },
      { stat: 'Live Crew Map', meaning: 'A real-time map showing where every crew member in the business stream is deployed today. Pins are clustered by job site, with crew avatars and started/active counts. Clicking a pin shows the job name, location, and crew on site. Gives managers instant visibility of their entire field operation without phoning around.' },
      { stat: 'Voice-to-Text Dictation', meaning: 'A hands-free voice input button available on every field text-entry form — task descriptions, progress notes, and diary entries. Uses the browser\'s Web Speech API (en-GB) with graceful fallback on unsupported browsers. Designed for drillers wearing gloves or working in noisy cabs where typing is impractical. Tap the mic, speak, and the text is transcribed directly into the field.' },
      { stat: 'Photo Auto-Tagging', meaning: 'When field staff upload site photos, AI vision (InvokeLLM) automatically analyses each image and tags it with: equipment visible (rigs, vans, tools), work activity (drilling, groundworks), site conditions (mud, weather), and a suggested caption. GPS coordinates are also captured. Photos are auto-organised in the job gallery by these tags — no manual labelling required. An "AI" badge on each photo thumbnail indicates it was auto-tagged.' },
      { stat: 'GPS Auto-Arrival', meaning: 'The Shift Wizard uses device geolocation to auto-detect when a crew member arrives on site. If the GPS position is within the job\'s geofence radius, the arrival time is pre-filled into the travel-to-site form. The crew member just confirms — no manual time entry. Falls back gracefully to manual entry when GPS is unavailable or denied.' },
      { stat: 'Tablet Split-Pane', meaning: 'All field CRUD and list/detail views use a responsive split-pane layout that adapts from a single-column stack on phones to a master-detail two-pane view on tablets. This ensures parity between phone (field crews) and tablet (management) as equal first-class design targets.' },
    ],
  },
  {
    id: 'automations',
    icon: Zap,
    title: 'Automations',
    desc: 'Background tasks that run without anyone asking',
    items: [
      { stat: 'Daily Stand-up Digest', meaning: 'Every weekday at 7 AM, emails all admins a digest: crew on site count, rig maintenance alerts, critical safety actions, and vehicle alerts. Replaces the morning phone round-robin.' },
      { stat: 'Usage-Based Maintenance', meaning: 'Daily at 6 AM. Recalculates engine hours for every rig from approved logs since its last service. Flags rigs crossing the 250h threshold and auto-books maintenance.' },
      { stat: 'Compliance Expiry Check', meaning: 'Daily. Checks every asset\'s compliance_expiry_date against today. Updates compliance_status to "expired" or "expiring" and deactivates non-compliant assets so they cannot be assigned.' },
      { stat: 'Milestone Auto-Push', meaning: 'Triggered when an investigation log is approved. Posts a "Verified Milestone" comment to the client portal and emails the project manager. Zero manual steps.' },
      { stat: 'Schedule Email', meaning: 'Triggered when a rota week is published. Emails each assigned crew member their weekly schedule with a PDF attachment.' },
      { stat: 'Bank Holiday Sync', meaning: 'Annual. Pulls UK bank holidays from gov.uk API so the rota engine knows not to schedule work on public holidays.' },
      { stat: 'Geofence Batch Check', meaning: 'Every 10 minutes. Reads the latest GPS position for every vehicle and checks it against all job, supplier and client geofences. Catches arrivals/departures the real-time Geotab webhook may have missed between pings.' },
      { stat: 'Idle Asset Transfer Sweep', meaning: 'Daily at 6 AM. The autoGenerateTransferLegs function matches assets sitting idle in the yard with upcoming job delivery requirements and auto-creates DeliveryLeg records so gear moves to where it is needed without manual planning.' },
      { stat: 'Portal Feedback Sync', meaning: 'Nightly at 11 PM. The syncPortalFeedbackToJobStatus function processes client portal feedback ratings. When a poor rating (1-2 stars) is received, the linked job is automatically put on hold with a status_reason so the project manager can investigate before continuing.' },
    ],
  },
  {
    id: 'logistics',
    icon: Truck,
    title: 'Logistics & Deliveries',
    desc: 'How pick lists, route optimisation, goods-in and delivery billing work',
    items: [
      { stat: 'Depot Pick Lists', meaning: 'The Depot Pick Lists page (/depot-pick-lists) groups today\'s deliveries by vehicle, showing each drop as a card with its pick-list items, delivery address, and a 3-stage digital sign-off. Warehouse staff open a delivery, see the full item list to pick, and work through the stages in order. The page is accessible from the Logistics Hub Pick Lists tab and is mobile-first for warehouse floor use.' },
      { stat: '3-Stage Per-Signature Sign-Off', meaning: 'Every pick list has three sign-off stages: Picked (warehouse confirms items picked from shelf), Loaded (loader confirms items on the vehicle), and Driver Check (driver confirms the load is correct before departure). Each stage requires the signer to draw their signature on a canvas — a finger or stylus drawn signature, not a tap. The signature PNG, signer name, and timestamp are saved to the DeliveryLog record, creating a legally defensible audit trail per stage.' },
      { stat: 'Signature Storage', meaning: 'Each stage\'s drawn signature is stored as a base64 PNG data URL on the DeliveryLog record (picked_signature_data_url, loaded_signature_data_url, driver_check_signature_data_url). Completed stages display the signature thumbnail next to the signer\'s name and timestamp in the modal. The printed A4 pick sheet embeds the captured signature images so the paper trail matches the digital trail.' },
      { stat: 'Printable A4 Pick Sheet', meaning: 'Every pick list can be printed as an A4 sheet for the notice board or driver handout. The sheet includes the job details, vehicle, item checklist with tick boxes for Picked and Loaded, driver instructions, and a sign-off block. When stages are already signed digitally, the captured signature images are embedded in the printed sheet; unsigned stages show blank lines for physical sign-off as a backup.' },
      { stat: 'Route Optimisation', meaning: 'The optimizeDailyRoute function uses the Google Maps Directions API with waypoint optimisation to calculate the most efficient stop order for a driver\'s day. It sets optimized_sequence_index (recommended stop order), optimized_eta (estimated arrival time), leg_duration_minutes (traffic-aware travel time), and leg_distance_miles on each DeliveryLog. The pick list page sorts drops by sequence index so the warehouse picks in drive order.' },
      { stat: 'Goods-In Gatekeeper', meaning: 'When a supplier delivery arrives at the depot, the Goods In panel (Logistics Hub → Procurement tab) verifies the shipment against the expected items and quantity. The receiver scans or manually confirms each line item, records the condition, and stamps the receipt. This creates a GoodsInReceipt record and updates ConsumableStockItem quantities so the warehouse inventory stays accurate.' },
      { stat: 'Delivery Billing', meaning: 'Every delivery is chargeable by default. The calculateCharge function matches the delivery to a BillingRule (by delivery type and distance), applies the rate, and sets charge_amount and charge_breakdown on the DeliveryLog. Billing can be set to auto (rule-calculated), no_charge (goodwill visit), or custom_fee (manual override). Internal handovers (item_handover) default to not chargeable.' },
      { stat: 'Vehicle Capacity Checks', meaning: 'When equipment is signed out onto a delivery vehicle, the system sums the weight_kg and volume_m3 of all items and compares against the vehicle\'s max_weight_kg and max_volume_m3. If the loaded weight exceeds the limit, the sign-out is blocked unless the dispatcher explicitly overrides (weight_override=true, logged to SystemAuditLog). The total_loaded_weight_kg and axle_guidance_note are denormalised onto the DeliveryLog for the driver hub safe-to-drive display.' },
    ],
  },
  {
    id: 'geofence',
    icon: Radar,
    title: 'Geofence & Vehicle Tracking',
    desc: 'How GPS arrival/departure detection works',
    items: [
      { stat: 'Geofence Targets', meaning: 'Three types of locations are monitored: job sites (using Job.site_lat/site_lng), supplier yards (using Supplier.lat/lng) and client collection points (using Client.lat/lng). A vehicle entering the radius around any of these triggers an arrival event; leaving triggers a departure.' },
      { stat: 'Default Radius', meaning: '100 metres. The distance from the location centre within which a vehicle is considered "on site". Configurable globally in Geofence Settings, and overridable per job, supplier or client for locations that need a larger or smaller zone (e.g. a large client yard vs a tight layby).' },
      { stat: 'Arrival / Departure Logic', meaning: 'The system compares each GPS ping to the last known state. An arrival is only recorded if the vehicle was previously outside (or this is the first check). A departure is only recorded if the vehicle was previously inside. This prevents duplicate events from repeated pings while stationary.' },
      { stat: 'Auto Check-in', meaning: 'When enabled in Geofence Settings, a vehicle entering its assigned job\'s geofence automatically sets "arrived_on_site_at" on the crew\'s rota assignment — no manual check-in needed. The event is flagged "AUTO CHECK-IN" in the feed.' },
      { stat: 'Real-time + Batch', meaning: 'Geotab webhooks and fleet syncs check geofences in real time as location pings arrive. A scheduled batch check every 10 minutes acts as a fallback to catch any pings the webhook missed, ensuring no arrival or departure goes undetected.' },
      { stat: 'Geofence Event Feed', meaning: 'A dashboard widget showing the latest 30 arrival/departure events with vehicle, location, distance and time. Clicking a job event opens the job detail drawer. Supplier and client events show the location name without navigation.' },
    ],
  },
  {
    id: 'enterprise',
    icon: Layers,
    title: 'Enterprise Hubs & Cross-Division Tools',
    desc: 'Multi-division dashboards, crew availability and resource loaning',
    items: [
      { stat: 'Enterprise Dashboard', meaning: 'The top-level landing page (/enterprise) sits above all divisions. It shows a two-level hierarchy: Business Units (holding groups) contain Business Streams (operating entities). BU cards aggregate child-stream stats with a preview strip; stream cards show per-division crew, jobs, fleet and outstanding. Enterprise KPIs (total crew, active jobs, outstanding) roll up across every permitted division. Super admins can add new BUs or streams via a guided wizard.' },
      { stat: 'Business Unit vs Stream', meaning: 'A Business Unit is a parent holding group (e.g. a group that owns several specialist firms). A Business Stream is an operating entity underneath a BU (or standalone). The dashboard distinguishes them with different card styles and counters: BU cards show aggregated child-stream totals; stream cards show direct operational counts. An orphaned stream whose parent is not visible is treated as standalone so it never disappears.' },
      { stat: 'Operations Hub', meaning: 'The Enterprise Operations Hub (/enterprise/operations) is a cross-division command view of live operations: active jobs, in-progress deliveries, deployed rigs (geotechnical only) and fleet utilisation. Per-stream breakdowns show each division\'s operational load. Drilling and rig stats are gated to geotechnical-type streams only, so non-drilling divisions do not see empty rig tiles.' },
      { stat: 'Financial Hub', meaning: 'The Enterprise Financial Hub (/enterprise/financial) rolls up revenue, outstanding, overdue invoices and total invoiced across all permitted divisions. It gives finance leaders a single view of group-wide cash position without entering each division. Figures are denominated in GBP and refresh from the live invoice and job data.' },
      { stat: 'Compliance Hub', meaning: 'The Enterprise Compliance Hub (/enterprise/compliance) aggregates compliance pass rate, expired items, expiring certificates and open incidents across every division. Safety and compliance leaders use it to spot group-wide risk hotspots before they become incidents.' },
      { stat: 'Crew Availability Heatmap', meaning: 'A card-per-staff week view of crew availability. Each crew member renders as a full-width card with their 7-day strip inside (on-job, leave, sick, training, depot, available), so the layout is mobile-friendly with no horizontal page scroll. The dashboard widget shows a 12-staff preview; the full page (/enterprise/crew-availability) shows everyone. The division-scoped version lives in the Scheduling Hub Availability Heatmap tab. Both share the same card style and colour-coded status cells.' },
      { stat: 'Cross-Division Resource Pool', meaning: 'The Resource Pool (/enterprise/resource-pool) shows idle rigs, vehicles and crews across all divisions and lets managers loan a resource from one division to another without leaving the page. Loaning reassigns the resource\'s division_id instantly. The dashboard widget shows a tabbed preview (idle rigs / idle vehicles / available crew) with a one-tap loan-to-division picker.' },
    ],
  },
  {
    id: 'rig-earnings',
    icon: TrendingUp,
    title: 'Rig Earnings & Live Performance',
    desc: 'How live rig earnings are calculated from metres drilled × rate cards',
    items: [
      { stat: 'Live Metres × Rate Cards', meaning: 'Rig earnings on the dashboard are computed live from actual InvestigationLog records (the same records the KeyLogBook webhook writes) multiplied by the job\'s rate cards — no longer day-rate × calendar days. The headline shows metres drilled today and earnings today, updating as new logs arrive.' },
      { stat: 'Per-Rig Grouping', meaning: 'Logs are grouped by device_name (the rig tag from the AGS file). When the AGS file has no rig tag, the system falls back to the driller name (staff_name) so work is always organised — never dumped under "Unassigned". Each rig tile shows borehole count, metres, and earnings.' },
      { stat: 'Rig Drill-Down', meaning: 'Clicking a rig tile opens a drill-down modal with three tabs: Boreholes (every borehole that rig drilled, with metres + earnings per hole), Timeline (every log for that rig — activities, strata, samples, installations — with times, duration, charges, and the logger), and Logger (the KeyLogBook user who logged each entry, resolved to a Staff record with a link when a name match exists).' },
      { stat: 'SOR Depth Bands', meaning: 'For jobs with a Schedule of Rates (InvestigationSOR), total borehole depth is distributed across standardised depth bands (0–5m, 5–10m, etc.) and each band is priced against the matching SOR item. This gives accurate earnings for CP drilling where rates change by depth.' },
      { stat: 'Auto-Priced Remarks', meaning: 'Driller remark activities (source = keylogbook_remarks) are auto-priced at ingest against the job rate card. The cleaned (AI-professionalised) description is matched first, then the raw driller wording. Matched activities get chargeable=true, billing_status=auto, and a charge_breakdown JSON showing the rate card item, unit price, and total.' },
      { stat: 'Auto-Refresh', meaning: 'The dashboard Rig Earnings widget silently re-pulls live logs every 4 minutes so an open dashboard stays current with the latest KeyLogBook webhook data — no manual refresh needed. The widget also honours the job filter (all jobs vs a selected job).' },
      { stat: 'Full Figures Toggle', meaning: 'The "Full figures" button on the Rig Earnings widget expands an all-time per-rig live earnings breakdown — every rig\'s total metres, boreholes, and earnings across the whole job, not just today.' },
    ],
  },
  {
    id: 'klb-webhook',
    icon: FileClock,
    title: 'KeyLogBook AGS Webhook (Consolidated)',
    desc: 'Single endpoint for borehole data, driller remarks, and auto-timesheets',
    items: [
      { stat: 'Single Endpoint', meaning: 'All KeyLogBook data — borehole locations, strata, samples, SPT, core runs, installations, groundwater readings, AND driller daily remarks — flows through one consolidated webhook endpoint: importAGS. KeyLogBook pushes AGS files via event-based webhooks (hole_created, hole_updated, hole_deleted). No separate remarks webhook is needed.' },
      { stat: 'Auto-Pricing at Ingest', meaning: 'When the AGS file is processed, each driller remark activity is auto-priced against the job rate card immediately. The cleaned description (AI-professionalised) is matched first, then the raw driller wording. Matched activities get chargeable=true and a charge_breakdown showing the rate card item used.' },
      { stat: 'Auto-Timesheet Generation', meaning: 'For automated KeyLogBook pushes (event webhooks and scheduled pushes), the imported keylogbook_remarks logs are aggregated into submitted daily summary timesheets per work date. Remark logs are auto-approved and a timesheet is generated immediately. Manual uploads keep logs pending for manager review.' },
      { stat: 'Borehole-Scoped Overwrite', meaning: 'Re-importing a borehole only replaces logs for the boreholes in that file — boreholes not in the file are left untouched. This prevents a single-borehole re-upload from wiping a job with many boreholes. A safeguard warns when a re-import would replace a larger dataset with a smaller one.' },
      { stat: 'Crew Attribution', meaning: 'The parser reads HDPH_LOG (the actual KeyLogBook user who logged the hole) and HDPH_CREW (the full crew). Per-shift activities (DLOG/PTIM/HDIA) are attributed to the correct crew via SHFT_ID. Borehole-level technical logs aggregate all crew across all shifts. The Lead Driller is the first name in HDPH_LOG.' },
      { stat: 'Structured Time Groups', meaning: 'KeyLogBook stores the driller\'s shift diary in structured AGS groups (DLOG, PTIM, DREM, SHFT, HORN, TREM) with dedicated time columns. The parser chains consecutive PTIM activities into contiguous time blocks using the SHFT shift window, so the full working day is captured with real durations instead of zero-duration point markers.' },
      { stat: 'Webhook Auth & Signing', meaning: 'The importAGS endpoint supports four auth methods: Bearer token, Basic Auth, custom header, or off. Optional HMAC-SHA256 request signing (X-Hole-Signature header) verifies the payload genuinely came from KeyLogBook and was not tampered with. Internal app calls (manual uploads from the settings UI) are identified by the user\'s JWT and skip webhook validation.' },
      { stat: 'Sample Auto-Creation', meaning: 'When the AGS file contains a SAMP group, Sample entity records are auto-created and linked back to their InvestigationLog (sample_collection log). This means the driver\'s sample-collection flow picks them up automatically — no manual sample entry needed.' },
    ],
  },
  {
    id: 'sso-login',
    icon: ShieldCheck,
    title: 'Microsoft SSO Login',
    desc: 'How staff log in with Microsoft — no emails, no passwords, no invites',
    items: [
      { stat: 'SSO-Only Login', meaning: 'The login page offers a single "Continue with Microsoft" button. No email/password form, no Google, no invite emails. Staff click the button, authenticate with their work Microsoft account, and they\'re in.' },
      { stat: 'Auto-Match by Email', meaning: 'On first login, the platform creates the user\'s platform account from their Microsoft identity. The app immediately calls getMyStaffProfile → buildMyProfile, which matches the Microsoft email (case-insensitive) to a Staff record. If a match is found, the platform user_id is auto-linked to that Staff record.' },
      { stat: 'Auto-Provision Fallback', meaning: 'If no Staff record matches by email (e.g. a brand-new contractor), buildMyProfile auto-creates a minimal Staff record via the service role so the user is never blocked. The record is created with their Microsoft name, email, and user_id, assigned to a default field-ops team.' },
      { stat: 'No Invite Emails', meaning: 'Because SSO creates the account on first login, there is no need to send invite emails. Staff simply go to the app URL and click "Continue with Microsoft." Their supervisor must have set their email on their Staff record first so the match works.' },
      { stat: 'Straight to Profile', meaning: 'After Microsoft login + email match, the user is routed straight to their role-based landing page (admin dashboard for office staff, schedule for field crew, scanner for scanner-only users). First-time users who haven\'t completed profile setup (photo + phone) are sent to the onboarding screen first.' },
      { stat: 'Email Requirement', meaning: 'Every Staff record must have a valid email that matches the staff member\'s Microsoft account email. Staff without an email cannot be matched by SSO. The permission rebuild flags staff without emails so the admin can add them.' },
    ],
  },
  {
    id: 'permissions',
    icon: Users,
    title: 'Permission Groups & Access Control',
    desc: 'How per-module access is enforced for every team and group',
    items: [
      { stat: 'Seven System Groups', meaning: 'The permission system is built on seven clean system groups: Super Admin (all write), Admin (all write), Management (all write except Settings), User (read-only on core hubs), Field Staff (schedule + profile only), Read Only (strict read-only lockdown), and Scanner Only (scanner page only). Every staff member is assigned to exactly one group.' },
      { stat: 'Per-Module Access', meaning: 'Each group defines an access level for each of the 12 admin modules (Dashboard, Projects, Scheduling, Staff, Logistics, Assets, Fleet, Investigation, Compliance, Financial, Reports, Settings). Levels are: none (hub hidden), read (view only, no edits), write (full create/update/delete). The platform admin flag bypasses everything.' },
      { stat: 'Every Staff Assigned', meaning: 'Every Staff record has a permission_group_id. The rebuild assigns all staff to the appropriate group based on their role: super_admin → Super Admin, admin → Admin, management → Management, user → User, read_only → Read Only, everyone else (field, depot, subcontractors) → Field Staff. No orphans.' },
      { stat: 'Route Guards', meaning: 'RouteGuard checks canAccessRoute for every protected route. Scanner-only users see /scanner only. Drivers (field staff with delivery_dashboard_enabled) see /deliveries only. Subcontractors see /subcontractor only. Field staff see /staff-schedule, /staff-profile, /scanner. Office roles see everything. Onboarding-gated routes redirect new users to /onboarding first.' },
      { stat: 'Division Access Manifests', meaning: 'For finer control, DivisionAccessManifest records can override a group\'s base permissions per division — hiding specific elements, disabling specific features, or masking financial data for a particular group in a particular division. This is layered on top of the group\'s base permissions.' },
      { stat: 'Landing Page Resolution', meaning: 'After login, each user is routed to their landing page. Resolution order: per-staff default_landing_page override → scanner-only → /scanner, driver → /deliveries, subcontractor → /subcontractor, permission group landing_page (office → /admin, field → /staff-schedule), role-based fallback. This ensures every user lands in the right place for their job.' },
    ],
  },
  {
    id: 'inbox',
    icon: Inbox,
    title: 'Universal Inbox & Approval Routing',
    desc: 'Centralised approvals, alerts, and SLA escalation across every hub',
    items: [
      { stat: 'Unified Inbox', meaning: 'The Universal Inbox (/inbox) consolidates every actionable item across all hubs into one list: approvals (AFP review, timesheets, access requests, early leave, delay logs, pricing reviews, off-hire), alerts (compliance expiring, invoices overdue, failed audits, zero-line AFPs, margin breaches), and notices (schedule published, new jobs, crew messages). Each item has a type, priority, status, and deep-link to the source record.' },
      { stat: 'Approval Routing Config', meaning: 'Each approval type (AFP review, timesheet, access request, etc.) has an ApprovalRoutingConfig record that defines who receives it. Three approver modes: manager_chain (escalates from the requester\'s manager to fallback to super admins), permission_group (all staff in a named group), specific_staff (an explicit staff list). Configurable per-type in Settings → Approval Routing.' },
      { stat: 'SLA Tracking', meaning: 'Every approval item gets an sla_due_at timestamp computed from the routing config\'s sla_hours. When the SLA passes without action, the SLA checker escalates: re-notifies the approver, then routes to the fallback approvers. Overdue items show a red badge in the inbox.' },
      { stat: 'Hub Badge Counts', meaning: 'Each hub shows a live badge count of pending inbox items originating from that hub. The badge updates in real time via entity subscriptions so managers see at a glance which hubs need attention without opening the full inbox.' },
      { stat: 'Inbox Engine', meaning: 'A shared backend module (inboxEngine.ts) handles all approval creation, routing resolution, SLA tracking, and email notification logic. Every approval flow (AFP, timesheet, access, early leave, delay, pricing, off-hire, compliance doc, debt collection) calls the same createApproval function so routing is consistent and auditable.' },
      { stat: 'Delegation', meaning: 'Managers can delegate their pending approvals to another staff member for a set period. Delegated items show who delegated them and when delegation expires. On expiry, items automatically route back to the original approver.' },
    ],
  },
  {
    id: 'manager-dashboard',
    icon: ClipboardList,
    title: 'Manager Team Dashboard',
    desc: 'Per-manager oversight of team assignments, compliance, and approvals',
    items: [
      { stat: 'Team View', meaning: 'The Manager Team Dashboard (/manager-team) gives each manager a focused view of their direct reports: who is on site today, who has pending timesheet approvals, who has expiring compliance, and who has upcoming schedule gaps. It filters to only show staff where manager_id matches the logged-in manager.' },
      { stat: 'Approval Queue', meaning: 'Managers see their pending approvals (timesheets, early leave, delay logs, access requests) inline on their team dashboard — no need to open the full Universal Inbox. They can approve or reject directly from the dashboard, and the action flows through the same inboxEngine as the main inbox.' },
      { stat: 'Compliance Gaps', meaning: 'The dashboard surfaces compliance gaps for the manager\'s team: staff with expiring training, missing qualifications for upcoming job assignments, and expired certifications. Each gap links to the staff member\'s compliance editor so it can be resolved quickly.' },
    ],
  },
  {
    id: 'training-autopilot',
    icon: GraduationCap,
    title: 'Training Compliance Autopilot',
    desc: 'Automated daily + weekly training gap detection and booking suggestions',
    items: [
      { stat: 'Daily Gap Scan', meaning: 'The Training Compliance Autopilot runs a daily scan (integrated into the existing weekly/daily workflow) that checks every active staff member\'s training_category_ids against their expiring certifications. Staff with certifications expiring within 30 days are flagged as gaps.' },
      { stat: 'Rota Cross-Reference', meaning: 'The scan cross-references each gap against the staff member\'s rota to find free days for training. It suggests optimal training slots that do not conflict with job assignments, so training can be booked without disrupting active work.' },
      { stat: 'Dashboard Widget', meaning: 'A Training Gap Scheduler widget on the Admin Dashboard shows the count of staff with expiring certifications and the suggested training slots. Managers can click through to book the training directly from the widget.' },
      { stat: 'Per-Staff Categories', meaning: 'Training requirements are assigned per-staff via training_category_ids on the Staff record (the single source of truth), not inherited from the team. This means two drillers on the same team can have different training requirements based on their individual qualifications.' },
    ],
  },
  {
    id: 'assets-new',
    icon: Database,
    title: 'Asset Hub — New Features',
    desc: 'Push-to-Panda, QR labels, bulk actions, recently viewed, and advanced filtering',
    items: [
      { stat: 'Push to Panda', meaning: 'The "Push N → Panda" button in the fleet health strip sends all locally-created assets (those without a panda_asset_id) to Asset Panda as new objects. After the push, every asset has a panda_asset_id and there are no more local-only assets. This consolidates the full inventory into Asset Panda as the single source of truth.' },
      { stat: 'QR Label Printing', meaning: 'The "QR Labels" button opens a bulk printing utility that generates printable A4 sheets of QR codes for selected assets. Each label shows the asset name, QR code, fleet number, and type — 12 labels per page (3 columns × 4 rows), evenly spaced for an A4 folder. Assets without a system QR code get one generated client-side.' },
      { stat: 'Bulk Actions Bar', meaning: 'When selection mode is enabled on the inventory grid, a sticky BulkActionsBar appears at the bottom of the screen. It supports: Assign to Job, Set Inactive, Recertify, and View Certificates — all applied to the selected assets in one operation. "Select All" selects every asset matching the current filter.' },
      { stat: 'Recently Viewed Strip', meaning: 'A horizontal strip at the top of the inventory view shows the last 5 assets the user opened, with quick-click navigation to reopen them. Tracked via localStorage so it persists across sessions. Clearable with a single click.' },
      { stat: 'Deployment Filter', meaning: 'A filter dropdown on the inventory grid lets you filter by deployment status: All Locations, In Depot (storage location matches depot/yard/Dartford), On Site / Active (not in depot and is_active), or Inactive (is_active = false).' },
      { stat: 'Lifecycle Filter', meaning: 'A filter dropdown for asset lifecycle stage: Active, Aging (past depreciation years), Due for Replacement (replacement date within 90 days), or Disposed (disposal date set or lifecycle_status = disposed).' },
      { stat: 'Maintenance Filter', meaning: 'A filter dropdown for maintenance status: On Track, Due Soon, Overdue, or No Interval — matching the same logic as the maintenance gauge on each asset card.' },
      { stat: 'Compact Mode', meaning: 'A toggle on the inventory grid switches between Detailed (full card with all stats) and Compact (condensed card for faster mobile scanning). Compact mode shows just the name, status badge, and key compliance indicator — ideal for warehouse floor scanning on a phone.' },
      { stat: 'Full-Page Asset Detail', meaning: 'All asset views now route to the unified /assets/:id full-page detail view instead of opening a drawer. This gives more space for the compliance timeline, financial lifecycle, deployment history, and linked equipment — and makes the back button work naturally on mobile.' },
    ],
  },
  {
    id: 'access-inbox',
    icon: Inbox,
    title: 'Access Approvals via Universal Inbox',
    desc: 'How new-user access requests now route through the inbox — and the pages that were removed',
    items: [
      { stat: 'Inbox-Based Access Requests', meaning: 'When a non-admin user signs in for the first time, registerPendingAccess sets their access_status to "pending" and creates an InboxItem for every staff member flagged as an approver (is_approver = true). Approvers see the request in their Universal Inbox (/inbox) alongside every other approval — no separate queue page. They click Approve or Reject directly from the inbox card.' },
      { stat: 'actionInboxItem — Access Handling', meaning: 'When an approver acts on an access_request inbox item, actionInboxItem updates the user\'s access_status to "approved" (or "rejected") using the service role, then sends a branded welcome email to approved users via sendWelcomeEmail. The inbox item is closed and the approver is recorded. No manual user-management page is needed — the inbox is the single approval surface.' },
      { stat: 'Removed: Pending Access Queue', meaning: 'The standalone PendingAccessQueue settings page has been removed. Its functionality is fully replaced by the Universal Inbox — every pending access request appears as an inbox item with a deep-link to /inbox. The old route (/pending-access) still exists for the end-user waiting screen, but admin management is inbox-only.' },
      { stat: 'Removed: Access Gate Settings', meaning: 'The AccessGateSettings page (which configured contact instructions and approver lists) has been removed. Approvers are now designated via the is_approver flag on each Staff record (toggled in the staff edit form, super admins only). The contact instructions field has been dropped — the inbox card itself shows the requester\'s email and sign-in time.' },
      { stat: 'Approver Designation', meaning: 'To make someone an access approver, edit their Staff record and tick "Is this person an access approver?" (super admins only). When ticked, the staff member receives email notifications when a new user signs in and is waiting for approval, and their name appears on the pending user\'s waiting screen as a contact. Synced to the platform user role by syncStaffUserRoles.' },
    ],
  },
  {
    id: 'my-requests',
    icon: FileText,
    title: 'My Requests — Profile Self-Service Tab',
    desc: 'How staff submit and track holiday, expense, payslip and shift-swap requests from their profile',
    items: [
      { stat: 'My Requests Tab', meaning: 'Every staff profile (/admin/profile) now has a "My Requests" tab alongside Personal Details, Compliance Wallet, Training, Timesheets and Performance. It renders the SelfServiceHub component — a one-stop panel for holiday requests, expense claims, payslip requests, equipment requests, general requests and shift swaps. Staff no longer need to call the office or navigate to a separate page.' },
      { stat: 'Request Types', meaning: 'Four request types: holiday (date range + reason, notifies the manager for approval), expense (amount + description, saved as a cost record linked to the job), payslip (request the latest payslip), and equipment/general (free-text request for gear or anything else). Each request is a StaffRequest record with a status lifecycle: pending → in_progress → fulfilled / rejected.' },
      { stat: 'Shift Swap Marketplace', meaning: 'A second tab inside My Requests where field staff can offer up an assigned shift for swap. Colleagues in the same division see the offer and can claim it. The offering staff member\'s manager approves or rejects the claim; on approval the RotaAssignment is automatically reassigned to the claiming staff member.' },
      { stat: 'Deletion of Pending Requests', meaning: 'Both staff and admins can delete a request while it is still in "pending" status. This lets staff cancel a mistake or withdraw a request that is no longer needed without waiting for the office to reject it. Fulfilled or rejected requests cannot be deleted (they remain for the audit trail).' },
      { stat: 'Status Timeline', meaning: 'Every request shows its current status and, once the office responds, the response note and responder name. The SelfServiceHub polls the StaffRequest entity so the status updates as soon as the office acts — no refresh needed.' },
    ],
  },
  {
    id: 'powerapps-migration',
    icon: GitBranch,
    title: 'Power Apps Migration',
    desc: 'The roadmap, build hub and feature audit for migrating to Microsoft Power Apps',
    items: [
      { stat: 'Migration Roadmap', meaning: 'An 8-phase roadmap (accessible from Settings → Data & Migration → Power Apps Migration Roadmap) that rebuilds the platform on Microsoft Power Apps: Phase 0 Foundation (environment, Dataverse, Entra ID SSO), Phase 1 Core Data Schema (90+ entities as Dataverse tables with RLS), Phase 2 Model-Driven App (admin back office), Phase 3 Canvas Apps (field mobile apps), Phase 4 Power Automate (180+ functions as cloud flows), Phase 5 Power BI (embedded dashboards), Phase 6 Data Migration (CSV → Dataflows), Phase 7 Cutover (parallel run, go-live, decommission). Each phase has a downloadable code pack.' },
      { stat: 'Build Hub', meaning: 'The Power Apps Build Hub (Settings → Data & Migration → Power Apps Build Hub) generates five downloadable volumes: the Dataverse Schema Pack (every entity as a table definition), the Power Automate Flow Bundle (every backend function as a flow definition), the PowerFx Source (formula logic for canvas apps), the Integration Guide (how each external system connects), and the Claude Build Script (a conversation script that walks an AI builder through constructing each component). One click downloads the complete developer handoff pack.' },
      { stat: 'Feature Compatibility Audit', meaning: 'A live audit matrix (embedded in both the Azure Migration Plan and the Power Apps Migration Roadmap pages) that scores every platform feature for transferability: Full Transfer (native Power Apps equivalent), Partial (needs custom work), Rebuild (no equivalent), or Not Available. It covers every module — Dashboard, Jobs, Scheduling, Staff, Assets, Fleet, Compliance, Financial, Logistics, Reports, Settings — and produces a print-ready report showing the percentage that transfers cleanly. This informs the build-effort estimates and the migration timeline.' },
      { stat: 'Data & Migration Settings Section', meaning: 'All migration pages are now consolidated under Settings → Data & Migration: Migration Hub (financial comparison, build-effort, roadmap timeline, parity matrix, risk map), Power Apps Migration Roadmap, Power Apps Build Hub, Azure Migration Plan, M365 Setup Guide, Improvement Roadmap, and KeyLogBook Docs. They render as embedded tabs inside the settings shell — no navigating away to a standalone route. Admins review migration content and return to the settings overview with the standard back button.' },
    ],
  },
  {
    id: 'office-help',
    icon: BookOpen,
    title: 'Office Help Guides',
    desc: '25 seeded help topics covering every office-facing module — accessible from Help → Help Guides',
    items: [
      { stat: 'Seeded Topics', meaning: 'The seedOfficeHelpTopics backend function creates 25 comprehensive HelpTopic records for office staff, covering: Dashboard, Jobs, Scheduling & Rota, Staff Management, Assets & Equipment, Fleet & Vehicles, Compliance & Safety, Billing & Invoicing, Reports, Settings, AFP Builder, CVR, Invoicing, Rate Cards, AFP Disputes, Payroll, Geotab, Asset Panda, Mitti, Bob HR, Concur, CIS, Inbox & Approvals, Permissions, and the Client Portal. Each topic has a title, category, and rich-text body.' },
      { stat: 'Access', meaning: 'Office help guides are accessible from the Help page (/help) which filters by audience = "office". Field staff see a separate set of field-audience guides at /help-field. The Help Guide page renders topics grouped by category with a search bar. No PDF download is needed — everything is searchable on screen.' },
      { stat: 'Keeping Guides in Sync', meaning: 'When a feature is added, removed, or changed, the corresponding HelpTopic record should be updated (or re-seeded via seedOfficeHelpTopics) so the guides stay accurate. The System Logic & Stats Guide (this PDF) is the companion reference — update both when adding new stats or features so the user-facing guides and the technical reference stay aligned.' },
      { stat: 'Removed Page References', meaning: 'The help guides have been reviewed and corrected for references to the removed Pending Access Queue and Access Gate Settings pages. Any guide that previously directed admins to those pages now points to the Universal Inbox (/inbox) for access approval management instead.' },
    ],
  },
];

export default function SystemLogicGuide() {
  const [generating, setGenerating] = useState(false);

  const buildPDF = async () => {
    setGenerating(true);
    try {
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 48;

      // Cover
      doc.setFillColor(BRAND_DARK);
      doc.rect(0, 0, pageW, 200, 'F');
      doc.setFillColor(BRAND_LEAF);
      doc.rect(0, 200, pageW, 4, 'F');
      doc.setTextColor(WHITE);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.text('System Logic & Stats Guide', margin, 130);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      doc.setTextColor(200, 220, 180);
      doc.text('What every number, rule and automation means', margin, 155);
      doc.setFontSize(9);
      doc.text(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), margin, 178);

      let y = 240;
      doc.setTextColor(SLATE_700);
      doc.setFontSize(10);
      const intro = doc.splitTextToSize(
        'This guide explains every statistic, rule and automation in the Ground Control Mission Control. It is the reference document for anyone who needs to understand what the system is doing and why — from new managers to auditors to the board. It complements the user-facing Help Guides (Help → Help Guides) — when you add a new stat or feature, update both this guide and the relevant Help Topic so the two stay in sync.',
        pageW - margin * 2
      );
      doc.text(intro, margin, y);
      y += intro.length * 14 + 20;

      SECTIONS.forEach((section) => {
        if (y > pageH - 80) { doc.addPage(); y = 60; }
        // Section header
        doc.setFillColor(BRAND_DARK);
        doc.roundedRect(margin, y, pageW - margin * 2, 26, 4, 4, 'F');
        doc.setTextColor(WHITE);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(section.title, margin + 12, y + 17);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(200, 220, 180);
        doc.text(section.desc, margin + 12, y + 24);
        y += 36;

        section.items.forEach((item) => {
          if (y > pageH - 70) { doc.addPage(); y = 60; }
          // Stat name pill
          doc.setFillColor(BRAND_LEAF);
          doc.roundedRect(margin, y, 140, 16, 3, 3, 'F');
          doc.setTextColor(WHITE);
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.text(item.stat.toUpperCase(), margin + 6, y + 11);
          // Meaning
          doc.setTextColor(SLATE_700);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9.5);
          const lines = doc.splitTextToSize(item.meaning, pageW - margin * 2);
          doc.text(lines, margin, y + 28);
          y += 28 + lines.length * 12 + 12;
        });
        y += 8;
      });

      // Footer on every page
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setDrawColor(SLATE_300);
        doc.setLineWidth(0.5);
        doc.line(margin, pageH - 30, pageW - margin, pageH - 30);
        doc.setTextColor(SLATE_500);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.text('Ground Control · System Logic & Stats Guide', margin, pageH - 18);
        doc.text(`Page ${i} of ${pageCount}`, pageW - margin, pageH - 18, { align: 'right' });
      }

      doc.save(`Ground-Control-System-Logic-Guide-${new Date().toISOString().slice(0,10)}.pdf`);
    } catch (e) {
      console.error('PDF generation failed:', e);
      alert('Sorry, the PDF could not be generated. Please try again.');
    }
    setGenerating(false);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="insight-card rounded-2xl overflow-hidden">
        <div className="hero-gradient px-6 py-5 text-white flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/15 ring-1 ring-white/25 flex items-center justify-center backdrop-blur-sm">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">System Logic & Stats Guide</h2>
              <p className="text-white/80 text-sm">Every stat, rule and automation explained — downloadable as a PDF</p>
              <p className="text-white/60 text-xs mt-1">Companion to the user-facing Help Guides — update both when adding new stats or features.</p>
            </div>
          </div>
          <button onClick={buildPDF} disabled={generating}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-[#2E5A1A] rounded-xl font-semibold text-sm shadow-lg hover:shadow-xl transition disabled:opacity-60">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {generating ? 'Building…' : 'Download PDF Guide'}
          </button>
        </div>
      </div>

      {/* On-screen guide */}
      {SECTIONS.map(section => {
        const Icon = section.icon;
        return (
          <div key={section.id} className="insight-card rounded-2xl p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center shadow-sm">
                <Icon className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">{section.title}</h3>
                <p className="text-xs text-slate-500">{section.desc}</p>
              </div>
            </div>
            <div className="space-y-3">
              {section.items.map((item, i) => (
                <div key={i} className="border border-slate-100 rounded-xl p-3.5 hover:border-[#2E5A1A]/20 transition">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-[#2E5A1A]/10 text-[#2E5A1A] text-xs font-bold uppercase tracking-wide">{item.stat}</span>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">{item.meaning}</p>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}