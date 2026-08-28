import React, { useState } from 'react';
import { Download, Loader2, BookOpen, ShieldCheck, TrendingUp, Sparkles, HardHat, FileClock, Clock, Activity, Zap, FileText, Radar, Users, MessageSquare, Camera, Mic, MapPin, CalendarClock, Layers, Boxes } from 'lucide-react';
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
      { stat: 'Unbilled WIP', meaning: 'The sum of all JobCostItem amounts where the item has not been included on a paid invoice. This is "earned but unbilled" revenue — work that has been done and costed but not yet invoiced to the client.' },
      { stat: 'Realisation %', meaning: 'Invoiced amount ÷ earned amount across all active jobs. A dropping realisation rate is the earliest warning sign of billing leakage. The dashboard surfaces this as a live percentage.' },
      { stat: 'Charge Calculation', meaning: 'The calculateCharge function runs automatically on every approved InvestigationLog and submitted Timesheet. It matches the activity to a BillingRule (by task description or log type), applies the rate, and sets charge_amount and charge_breakdown on the record.' },
      { stat: 'Revenue Method', meaning: 'How a job earns money: "drilling_meterage" = £/metre, "groundworks_unit" = £/trial pit, "coring_unit" = £/core run, "day_rate" = fixed daily crew rate, "flat_fee" = single project fee. Set on the Team, inherited by the job.' },
      { stat: 'VAT Rate', meaning: 'Default 20% (UK standard rate). Applied to invoice net totals. Editable per job for zero-rated or exempt work. Falls back to the BusinessConfig default_vat_rate when not set on the job.' },
      { stat: 'Asset Financial Lifecycle', meaning: 'The Financial tab on each Asset Passport shows the full ROI of an asset: total revenue earned (from approved JobCostItem billing records) vs total cost (maintenance + servicing + straight-line depreciation). The net profit and ROI percentage update in real time as new billing and service records are added.' },
      { stat: 'Auto-Detect Billing from Remarks', meaning: 'Each investigation log entry has an "Auto-Detect Billing" button that sends the log\'s remarks to an LLM. The AI identifies billable events mentioned in the driller diary (e.g. "extra casing installed", "made up 10m of rods") and auto-creates JobCostItem billing entries with the correct rate from the Master Price List.' },
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
        'This guide explains every statistic, rule and automation in the Ground Control Mission Control. It is the reference document for anyone who needs to understand what the system is doing and why — from new managers to auditors to the board.',
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