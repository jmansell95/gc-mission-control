import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Rocket, Users, Briefcase, PoundSterling, ShieldCheck, Wrench, Clock,
  Globe, Truck, BarChart3, Plug, Smartphone, Settings, FileText,
  Zap, ChevronDown, ChevronRight, CheckCircle2, Circle, AlertCircle, Download, Loader2, Sparkles
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';

const CATEGORIES = [
  {
    id: 'known-issues',
    icon: AlertCircle,
    title: 'Known Issues & Gaps',
    color: 'rose',
    items: [
      { priority: 'high', title: 'Zero job margins — internal cost prices missing', desc: 'All jobs currently show zero margin because RateCardItem records are missing cost_price values. The financial engine falls back to the sell price when cost is blank, producing £0 margin. Need a bulk cost-rate import pass (importInternalCostRates exists) to populate cost_price on every labour, plant and material line, then re-run calculateJobFinancials across all active jobs.', status: 'done' },
      { priority: 'high', title: 'BillingRule ↔ RateCardItem mismatches', desc: 'User reports mismatches between BillingRule settings and Master Price List data. The rate-card description matcher is fragile — minor wording differences cause no-match. Need a normalised fuzzy matcher (tokenised, case-insensitive, abbreviation-aware) with a manual override/lock field so managers can pin a BillingRule to a specific RateCardItem without relying on text matching.', status: 'done' },
      { priority: 'high', title: 'Driller misclassification as subcontractors', desc: 'Drillers are being misidentified as subcontractors when mapped to "SDA Site Investigations". The detector treats all company-like names as contractors. Need a whitelist of internal company names (SDA, Ground Control, Land & Water) plus a staff-name cross-check before flagging a row as subcontractor.', status: 'done' },
      { priority: 'high', title: 'Agency workers attributed to "Unknown Agency"', desc: 'Agency workers are incorrectly attributed to "Unknown Agency" instead of Daniel Owen, City Sites, or Black Swan. The agency matcher needs to use the header context ("Field Teams - Drilling Subbies") and a known-agency name list to link labourers to the correct Contractor record.', status: 'done' },
      { priority: 'high', title: 'Subcontractors missing from import preview', desc: 'Subcontractors in the "Drillers" tab are not appearing in the import preview, and subcontractor entities are not correctly linking to Staff records during the ImportDashboard process. Need to surface subcontractor rows in the dry-run preview and auto-create/link Staff records with worker_type "subcontractor".', status: 'done' },
      { priority: 'medium', title: 'Orphaned rota assignments with null rig_asset_id', desc: 'Spreadsheet import logic creates orphaned RotaAssignment records with null rig_asset_id references. Need a post-import sweep that either links the assignment to the correct rig or flags it for manual resolution, plus a validation step that blocks null rig references on drilling jobs.', status: 'done' },
      { priority: 'medium', title: 'Non-project activities polluting the Job entity', desc: 'The Job entity currently contains non-project activities like "Holiday" and "Off" due to loose import validation. These should be filtered out during import and routed to Absence/RotaAssignment non-job types instead of creating Job records.', status: 'done' },
      { priority: 'medium', title: 'Rigs showing incorrect data on logistics tab', desc: 'Rigs on the logistics tab in the Job details view are displaying incorrect data. The rig asset lookup is pulling stale or cross-job data. Need to scope the query by job_id and current_location to show only rigs actually on this job.', status: 'done' },
      { priority: 'medium', title: 'Depot staff categorised under Field Teams header', desc: 'Depot staff are incorrectly being categorised under the "Field Teams" header in the rota import. The section-header detector needs a depot/yard keyword list to route depot staff to the correct team category.', status: 'done' },
      { priority: 'low', title: 'Reverse geocoding not rendering in UI', desc: 'Two-phase reverse geocoding and safety event date/time formatting are not yet rendering correctly in the UI. The backend returns the data but the frontend components are not displaying it. Need to wire the geocoded address into the map popups and format safety event timestamps with timezone-aware display.', status: 'done' },
    ],
  },
  {
    id: 'next-actions',
    icon: Rocket,
    title: 'Next Priority Actions',
    color: 'amber',
    items: [
      { priority: 'high', title: 'Populate internal cost rates across all rate cards', desc: 'Run the importInternalCostRates function with the current cost-rate spreadsheet to fill cost_price on every RateCardItem. Then trigger calculateJobFinancials on all active jobs to recompute margins. This single action fixes the zero-margin issue across the entire platform.', status: 'done' },
      { priority: 'high', title: 'Build a rate-card matcher with manual override', desc: 'Replace the fragile description-text matcher with a normalised tokenised matcher. Add a "locked_rate_card_item_id" field to BillingRule so managers can pin a rule to a specific rate card line. Show a confidence badge and a "match locked" indicator in the Billing Rules UI.', status: 'done' },
      { priority: 'high', title: 'Fix driller & subcontractor detection in import', desc: 'Add an internal-company whitelist (SDA Site Investigations, Ground Control, Land & Water Solutions) to the subcontractor detector. Cross-check company-like names against existing Staff records before flagging as subcontractor. Surface all detected subcontractors in the import preview with link/create actions.', status: 'done' },
      { priority: 'high', title: 'Fix agency attribution with header-context matcher', desc: 'Use the "Field Teams - Drilling Subbies" header context to identify agency-supplied rows. Match agency names (Daniel Owen, City Sites, Black Swan) against a known-agency list stored in AppSetting. Auto-link labourers to the correct Contractor record with worker_type "agency".', status: 'done' },
      { priority: 'medium', title: 'Add post-import rig validation sweep', desc: 'After import, run a sweep that checks every drilling RotaAssignment for a null rig_asset_id. Auto-link by matching the rig name from the spreadsheet to a SiteAsset, or flag for manual resolution. Block publishing a rota week that has drilling assignments without rigs.', status: 'done' },
      { priority: 'medium', title: 'Filter non-project activities from Job entity', desc: 'During import, detect "Holiday", "Off", "AL" and similar non-job labels and route them to RotaAssignment with assignment_type "annual_leave" instead of creating a Job record. Add a validation step that rejects Job creation for known non-project labels.', status: 'done' },
      { priority: 'medium', title: 'Fix rig data on job logistics tab', desc: 'Scope the rig asset query on the Job logistics tab by job_id and current_location="site" to show only rigs actually on this job. Remove the stale-data fallback that pulls from the last assignment.', status: 'done' },
      { priority: 'low', title: 'Wire reverse geocoding & safety timestamps into UI', desc: 'Connect the reverse-geocoded address string to the live map popups and the safety event detail cards. Format safety event timestamps using Europe/London timezone with relative time labels ("2h ago").', status: 'done' },
    ],
  },
  {
    id: 'future-vision',
    icon: Sparkles,
    title: 'Future Vision — What to Add Next',
    color: 'indigo',
    items: [
      { priority: 'high', title: 'Business-Stream-scoped dashboard themes', desc: 'Each business stream gets its own accent colour (already on Division.color) that cascades through the sidebar, header, KPI tiles and business stream workspace. Users instantly know which business stream they are in by the colour palette. Already partially implemented — extend to all hub pages.', status: 'done' },
      { priority: 'high', title: 'Cross-division resource sharing board', desc: 'A "Resource Pool" view at the enterprise level showing idle rigs, vehicles and crews across all divisions. Managers can loan a rig from Geotechnical to Environmental for a week without leaving the enterprise dashboard. Tracks the loan as a cross-division delivery.', status: 'done' },
      { priority: 'high', title: 'AI-powered weekly operations digest', desc: 'A scheduled automation that uses InvokeLLM to read the week\'s jobs, rotas, timesheets, incidents and financials, then writes a natural-language executive summary emailed to directors every Friday. Highlights what went well, what\'s at risk, and what needs attention next week.', status: 'done' },
      { priority: 'medium', title: 'Live margin guard on every job card', desc: 'Every job card across the dashboard shows a live margin badge (green ≥15%, amber 5–15%, rose <5%) computed from the latest financial rollup. Clicking the badge opens the financial breakdown drawer. Makes margin visible everywhere, not just in the billing hub.', status: 'done' },
      { priority: 'medium', title: 'Crew availability heatmap across divisions', desc: 'An enterprise-level heatmap showing every active crew member × day, colour-coded by division, so directors can see at a glance who is free, who is on leave, and who is cross-divisional. Click a cell to draft a cross-division assignment.', status: 'done' },
      { priority: 'medium', title: 'Procurement-to-job pipeline', desc: 'A full procurement flow: raise a material/hire request from a job → auto-create a Purchase Order → supplier confirms → goods-in scan → auto-attach cost to the job. Closes the gap between ordering equipment and billing it.', status: 'done' },
      { priority: 'medium', title: 'Client portal multi-job project view', desc: 'Clients with multiple jobs under one project see a consolidated portal view — aggregated progress, shared milestones, combined billing, and a project-level photo timeline. Already have ClientPaymentHistory — extend to full project portal.', status: 'done' },
      { priority: 'low', title: 'Holman fleet integration activation', desc: 'Activate the Holman fleet sync (syncHolmanFleet function exists) by connecting the Holman API credentials in the Integrations Hub. Pulls live mileage, service due dates, and fuel data into the Fleet Hub. Replaces the removed DVLA VES API with Holman as the authoritative vehicle data source.', status: 'done' },
      { priority: 'low', title: 'Microsoft 365 unified SSO', desc: 'Activate the Microsoft 365 hub (Microsoft365SetupGuide page exists) for unified Outlook, Teams, and SharePoint SSO. Gives staff single-sign-on and enables Outlook calendar sync without individual connector setup.', status: 'done' },
      { priority: 'low', title: 'WhatsApp crew notifications', desc: 'Activate the WhatsApp integration (sendCrewWhatsApp and whatsappWebhook functions exist) by connecting the WhatsApp Business API. Sends rota notifications, daily reminders and incident alerts directly to crew phones without email dependency.', status: 'done' },
    ],
  },
  {
    id: 'visual-ux',
    icon: Zap,
    title: 'Visual & UX Modernization',
    color: 'violet',
    items: [
      { priority: 'high', title: 'Vibrant Design Token System', desc: 'Enhanced global CSS with vibrant glassmorphism, neon glow shadows, animated mesh-gradient page backgrounds, gradient text utilities, and 16 saturated stat-tile gradients. Every page now uses page-bg-vibrant for a cohesive, colorful foundation that cascades automatically.', status: 'done' },
      { priority: 'high', title: 'Modal-first forms across all pages', desc: 'All create/edit flows now use full-screen slide-over panels or centered dialogs (JobForm, StaffProfileEditDrawer, AssignmentModal, JobWizardModal, FinishJobModal, ComplianceBlockModal, etc.) so users stay in context. Reduces cognitive load and keeps the dashboard visible behind the form.', status: 'done' },
      { priority: 'high', title: 'Micro-animations & entrance effects', desc: 'Added float, slide-up, pop-in, and gradient-shift keyframe animations. Cards animate in on mount, hero icons float gently, modals pop in with spring physics. Framer-motion page transitions already in place.', status: 'done' },
      { priority: 'high', title: 'Mobile-first field staff experience', desc: 'All field staff pages (Staff Dashboard, Delivery Dashboard, Staff Profile) use the vibrant page background, colorful gradient quick-link tiles with glow shadows, and larger 12px loading spinners. Touch targets remain ≥40px with active:scale feedback. Full wizard-style flows for shift, end-of-shift, and ad-hoc visits.', status: 'done' },
      { priority: 'medium', title: 'Drag-and-drop interactive rota timeline', desc: 'DragDropRotaTimeline component in the Scheduling Hub uses @hello-pangea/dnd for Google-Calendar-style drag-and-drop. Managers drag jobs from an available pool onto staff day cells, drag assignment cards between days to move them, and click × to remove. Full CRUD wired to RotaAssignment entity.', status: 'done' },
      { priority: 'medium', title: 'Availability heatmap overlays on rota', desc: 'AvailabilityHeatmap component in the Scheduling Hub overlays annual leave (blue), sick (rose), training (amber), yard/depot (slate), and on-job (emerald) as color-coded background highlights on the rota grid. Weekend dimming, legend, and week navigation included. Reads from RotaAssignment + approved Absence records.', status: 'done' },
      { priority: 'medium', title: 'Real-time route path map for deliveries', desc: 'DeliveryRouteMap component draws a dashed polyline on a leaflet map connecting collection → transfer → delivery legs with numbered, color-coded stop markers. Shown in the admin delivery detail drawer.', status: 'done' },
      { priority: 'medium', title: 'One-click bulk delivery reconciliation', desc: 'BulkDeliveryReconciliation tab in the Logistics Hub shows all in-transit legs with photo + signature proof, with a select-all and fast-approve action bar. Legs missing proof are flagged separately.', status: 'done' },
      { priority: 'medium', title: 'Staff performance graph dashboard', desc: 'StaffPerformanceCharts component on the Profile page shows a radial chart for on-time/briefing/completion rates, weekly meterage bar chart, and stat cards for total shifts and meterage.', status: 'done' },
      { priority: 'low', title: 'Fixed light theme', desc: 'The app now uses a fixed light theme for consistency across all devices. The dark/light mode toggle has been removed from the sidebar and settings. The .dark CSS tokens remain in index.css for future use if needed.', status: 'done' },
      { priority: 'low', title: 'Customisable dashboard colour themes', desc: 'Dashboard Color Themes settings page lets each user pick from 6 preset accent themes (Ground Control green, Ocean Blue, Royal Violet, Sunset Amber, Crimson Rose, Forest Teal). Applies instantly via CSS custom properties and persists on the device.', status: 'done' },
      { priority: 'medium', title: 'Ghost sidebar (collapsible icon rail)', desc: 'The admin sidebar now collapses to an icon-only rail (64px wide) via a toggle button at the bottom. Labels hide, the logo shrinks to its mark, the profile avatar becomes a compact circle with a flyout menu, and nav items show tooltips on hover. State persists in localStorage so it survives page reloads. Frees up screen real estate for data-dense pages like the Investigation Hub and financial grids.', status: 'done' },
      { priority: 'high', title: '3-column Investigation Hub', desc: 'Dedicated cross-job review workspace for all site investigation logs. Left pane: filterable log list (search by borehole/sample/staff, filter by review status, job, log type). Middle pane: full log detail with geotechnical data tiles, SPT blows, strata descriptions, photos, billing, and manager approve/query actions. Right pane: borehole context — strata sequence, samples, installations, and standpipe readings for the same borehole reference, with click-to-navigate between related logs. Responsive 3-column on desktop, stacked on mobile.', status: 'done' },
      { priority: 'high', title: 'Quick Action Bar on dashboard', desc: 'One-click shortcut buttons at the top of the dashboard for the most common admin operations — New Job, Add Staff, Raise Invoice, Log Incident, New Delivery, Add Asset. Each button navigates to the relevant module instantly, saving clicks for power users.', status: 'done' },
      { priority: 'high', title: 'Job Kanban board', desc: 'Drag-and-drop Kanban board view for jobs with 5 status columns (Planning, In Progress, Decommissioning, Completed, On Hold). Drag cards between columns to update job status instantly. Each card shows name, location, start date, and today\'s crew count. Click any card to open full job detail.', status: 'done' },
      { priority: 'high', title: 'Missing rates detection & bulk fix', desc: 'Automatic detection of crew members without a personal day rate (RateCardItem). A warning banner appears on the Staff page showing how many staff are missing rates and their labour costs show as £0. A bulk rate-entry modal lets managers set day rates for all affected staff at once, creating RateCardItem records that the financial engine uses for labour cost calculations.', status: 'done' },
      { priority: 'high', title: 'Aged debtors dashboard', desc: 'New Aged Debtors tab on the Billing page groups all unpaid invoices into aging buckets (0-30, 31-60, 61-90, 90+ days) with total outstanding per bucket and per client. Summary cards show total outstanding, overdue count, and 90+ days at-risk amount. Top 10 clients by outstanding amount listed for collection prioritisation.', status: 'done' },
      { priority: 'high', title: 'Billing readiness report', desc: 'New Billing Readiness tab shows all jobs with unbilled chargeable work (approved timesheets and cost items not yet invoiced), grouped by client. Finance gets a one-click view of what\'s ready to invoice, with the total unbilled amount and per-job breakdown. Click any job to drill into its detail.', status: 'done' },
      { priority: 'high', title: 'Compliance calendar', desc: 'New Calendar tab on the Compliance page shows a month-grid calendar with every compliance expiry (staff certs, vehicle MOT/tax/insurance, equipment LOLER/PUWER/PAT, service due) as color-coded events. Navigate months, click any day to see all expiries, legend by category. Replaces the flat expiry list with a visual planning tool.', status: 'done' },
      { priority: 'high', title: 'Asset utilisation trends', desc: 'New Utilisation tab on the Asset Hub shows a 30-day utilisation trend chart (on-site vs idle per day) with average utilisation rate and under-utilized asset count. Top 5 most utilized assets listed with progress bars. Helps identify idle assets for reallocation or sale.', status: 'done' },
      { priority: 'high', title: 'Depreciation schedule', desc: 'New Depreciation tab on the Asset Hub shows a full depreciation schedule table for every asset with acquisition cost and useful life — annual depreciation, accumulated depreciation, current book value, and remaining useful life. Summary cards show total acquisition value, total depreciated, and total book value. Assets due for replacement (book value near salvage or replacement date within 90 days) are highlighted.', status: 'done' },
      { priority: 'high', title: 'Staff directory grid & cost analytics', desc: 'New Directory tab on the Staff page shows a visual card grid of all active crew with avatars, role, team, and contact info. New Cost Analytics tab shows a bar chart of top earners by labour cost for the current month, with total monthly spend and a warning for staff who worked without a day rate.', status: 'done' },
      { priority: 'high', title: 'Copy last week\'s rota', desc: 'Copy Last Week button on the Scheduling Hub duplicates all assignments from the previous week to the target week, shifting dates by 7 days. Shows a conflict preview (staff already assigned on target dates) before applying, and skips conflicting assignments. Saves managers from manually rebuilding similar weeks.', status: 'done' },
      { priority: 'high', title: 'Bulk approve/query investigation logs', desc: 'Select mode in the Investigation Hub log list lets managers tick multiple logs and bulk-approve or bulk-query them in one action. A sticky action bar shows the selection count with Approve All and Query buttons. Query prompts for a note that the crew will see. Dramatically speeds up log review for high-volume jobs.', status: 'done' },
      { priority: 'high', title: 'Client payment history', desc: 'Client-facing payment history component shows all invoices for a client\'s jobs with status badges, amounts, and paid dates. Summary cards show total paid and total outstanding. Ready for integration into the client portal multi-job view.', status: 'done' },
      { priority: 'medium', title: 'Data freshness indicators', desc: 'Reusable DataFreshnessIndicator component shows when a data source was last fetched with a relative time label (e.g. "2m ago") and a manual refresh button. Ready for integration into dashboard widgets and list headers so users always know if they\'re looking at live or stale data.', status: 'done' },
      { priority: 'medium', title: 'Widget empty states', desc: 'Reusable WidgetEmptyState component provides a consistent empty-state UI (icon, title, message) for dashboard widgets that have no data, instead of leaving blank space. Ready for integration into any widget that currently shows nothing when empty.', status: 'done' },
    ],
  },
  {
    id: 'data-import',
    icon: Plug,
    title: 'Data Import & Sync',
    color: 'blue',
    items: [
      { priority: 'high', title: 'Refined Import Deduplication & Staff Linking', desc: 'Cross-tab staff matching now handles nicknames (Jon→John, Bob→Robert), initials (J Smith→John Smith), and typos via a layered fuzzy matcher. The dry-run preview shows the match method and confidence score for every linked staff member so planners can verify deduplication before applying.', status: 'done' },
      { priority: 'high', title: 'Incremental (non-destructive) import mode', desc: 'Incremental Import settings page + incrementalImport backend function. Matches incoming rows to existing RotaAssignment records by staff_id + date, updates in place while preserving manual fields (arrival times, briefing signatures, meterage, notes), creates new records for unmatched rows, and flags orphans for review. Dry-run preview shows the diff before applying.', status: 'done' },
      { priority: 'high', title: 'Import preview with undo/rollback', desc: 'The incrementalImport function supports dry_run mode that returns a full diff (to_create, to_update, orphaned, preserved_fields) before applying. The Backup & Restore settings page provides a full JSON snapshot export that can be used to roll back if an import produces unexpected results.', status: 'done' },
      { priority: 'medium', title: 'CSV import for bulk staff & jobs', desc: 'CSV Bulk Import settings page lets admins create multiple Staff, Job, Vehicle, Client, Supplier, or Contractor records from a simple CSV. Preview before importing, with header-to-field mapping.', status: 'done' },
      { priority: 'medium', title: 'iCal / calendar feed export', desc: 'Calendar button on every staff card calls the getStaffICalFeed backend function, which builds an iCal (.ics) file of the crew member\'s upcoming rota assignments (jobs, annual leave, sick, training) with all-day events including location, site contact, and shift times. Downloads instantly for import into any phone or desktop calendar app.', status: 'done' },
      { priority: 'low', title: 'AGS real-time validation & error recovery', desc: 'The importAGS function validates AGS file structure on upload, returns detailed error summaries (last_ags_sync_summary), and tracks success/failed status per webhook. The KeyLogBook Settings page shows the last sync status and summary. Partial-import recovery via the AGS Import Settings manual upload flow.', status: 'done' },
    ],
  },
  {
    id: 'staff',
    icon: Users,
    title: 'Staff Management',
    color: 'emerald',
    items: [
      { priority: 'high', title: 'Skills & certifications matrix', desc: 'New Skills Matrix tab in the Compliance Manager showing every active staff member × qualification type (CSCS, CPCS, NPORS, First Aid, Driving Licence, DBS, Forklift) as a color-coded grid — green=compliant, amber=expiring ≤30d, red=expired, gray=missing. Searchable by name or job title with summary stats at the top.', status: 'done' },
      { priority: 'high', title: 'Availability calendar', desc: 'Month-grid calendar in the Staff Manager showing every active staff member × day. Approved absences (holiday, sick, personal, training) are color-coded with letter badges. Navigate months, jump to today, and see at a glance who is free before assigning.', status: 'done' },
      { priority: 'high', title: 'Auto-assign crew suggestions', desc: 'CrewSuggester component ranks all active staff by a composite score: team membership (40pts), availability — no approved absence overlap (30pts), valid certs — CSCS/CPCS/First Aid (20pts), and past rota experience (10pts). Shows badges for each factor and one-click assign.', status: 'done' },
      { priority: 'medium', title: 'Staff utilisation analytics', desc: 'Staff Utilisation widget on the dashboard shows billable vs non-billable hours per staff member for the current week, with an overall utilisation rate and color-coded progress bars. Sits in the Performance & Financials section and the Financials view profile.', status: 'done' },
      { priority: 'medium', title: 'Digital ID cards with QR codes', desc: 'ID Cards button in the Staff Manager opens a digital ID card generator. Select any active staff member to preview a branded, credit-card-sized ID with their photo, name, role, team, and a QR code encoding their identity details. Print the card or download the QR code for site access verification.', status: 'done' },
      { priority: 'low', title: 'Performance reviews & feedback', desc: 'Staff Review Manager in Settings lets admins create periodic reviews (probation, quarterly, annual, project completion, ad-hoc feedback), rate performance 1-5, set goals with target dates, and share with staff for acknowledgement.', status: 'done' },
    ],
  },
  {
    id: 'jobs',
    icon: Briefcase,
    title: 'Job Management',
    color: 'amber',
    items: [
      { priority: 'high', title: 'Multi-Discipline Job Schema', desc: 'Jobs now support multiple simultaneous disciplines (drilling + groundworks + enabling) with per-discipline status, dates, and revenue methods. Migration function deployed — all existing jobs migrated to the new disciplines array.', status: 'done' },
      { priority: 'high', title: 'Decommissioning Lifecycle', desc: 'Finish Job action transitions jobs to decommissioning status, auto-generates collection tasks for all on-site equipment, and locks new billable items. Final inspection checklist and site clearance progress ring before completion.', status: 'done' },
      { priority: 'high', title: 'Discipline Pills on Job Cards', desc: 'At-a-glance colored pill strips showing all active disciplines on every job card and context view for instant multi-discipline visibility.', status: 'done' },
      { priority: 'high', title: 'Billing Lockdown on Decommissioning/Completed', desc: 'Cost items, subcontractor logs, and equipment can no longer be added once a job is decommissioning or completed. The billing lock banner now shows the reason (invoice issued vs job finalised) and the Add buttons are disabled until the job is reactivated.', status: 'done' },
      { priority: 'high', title: 'Multi-Discipline Job Wizard', desc: 'The New Job wizard now supports stacking multiple discipline tracks (drilling + groundworks + enabling) with a primary discipline marker. Each track inherits job-level dates and billing as defaults; the primary mirrors into legacy fields for backward compat.', status: 'done' },
      { priority: 'high', title: 'Job templates with defaults', desc: 'Job Types now carry template defaults (billing method, drilling method, markup %, budget, duration, teams, notes). The New Job wizard shows a template picker on step 1 — selecting one pre-fills the entire form. Duration auto-calculates the end date from the start date. Template defaults are configured in Settings → Job Types.', status: 'done' },
      { priority: 'high', title: 'Real-time profitability alerts', desc: 'Inline budget overrun banner on the Job Costing panel (amber ≥10%, rose ≥25%) plus a dashboard Profitability Alerts widget that runs the full checkJobBudgetAlerts engine — budget overrun, low margin, negative profit, and predictive margin-drop from daily burn rate. Nightly automation emails a digest to admins.', status: 'done' },
      { priority: 'medium', title: 'Job dependencies & sequencing', desc: 'Job Dependency Manager on the job Summary tab lets admins link prerequisite jobs. Shows a warning banner when any dependency is not yet complete, and a green "all clear" banner when all prerequisites are finished. Dependencies are stored on the Job entity and visible in the context view.', status: 'done' },
      { priority: 'medium', title: 'Milestone-based progress tracking', desc: 'Milestone Manager now auto-calculates a job progress percentage from completed milestones with a color-coded progress bar (slate <50%, blue ≥50%, emerald at 100%). The completion count badge and progress bar update instantly when milestones are toggled.', status: 'done' },
      { priority: 'medium', title: 'Multi-site job grouping', desc: 'Group related jobs under a project with shared resource allocation and cross-site reporting.', status: 'done' },
      { priority: 'medium', title: 'Global discipline filter', desc: 'Click discipline pills on any job card to filter the entire dashboard by that discipline type.', status: 'done' },
      { priority: 'low', title: 'Job cloning with date shift', desc: 'Clone button on every job card calls the cloneJob backend function, which duplicates the job with all fields, disciplines, cost items, logistics assignments, and milestones — shifting all dates by a specified number of days. New job starts in planning status with "(Clone)" suffix.', status: 'done' },
    ],
  },
  {
    id: 'financials',
    icon: PoundSterling,
    title: 'Financial & Billing',
    color: 'violet',
    items: [
      { priority: 'high', title: 'Automated invoice generation workflow', desc: 'The Auto-Invoice Engine assembles draft invoices from approved timesheets, cost items, hotel bookings, deliveries, meterage logs, and subcontractor charges. Runs nightly at 6 AM and also triggers instantly when a manager approves an InvestigationLog. A manual "Run Auto-Invoice" button is on the Billing Lifecycle hub. Admins get an email digest of created drafts.', status: 'done' },
      { priority: 'high', title: 'Cost forecasting', desc: 'Cost Forecast widget on the Job Costing panel projects final cost from the current daily burn rate × remaining days. Shows current cost vs projected final vs budget, with overrun warning and margin forecast (current → projected).', status: 'done' },
      { priority: 'high', title: 'Cash flow projection timeline', desc: 'Cash Flow Forecast widget on the dashboard visualises upcoming revenue (invoices due) and costs (supplier payments, payroll) on a timeline.', status: 'done' },
      { priority: 'medium', title: 'CIS deduction automation', desc: 'Auto-calculate CIS deductions and submit to HMRC API with verification tracking.', status: 'done' },
      { priority: 'medium', title: 'Purchase order management', desc: 'New Purchase Orders settings page (Financial Control Hub) with full PO lifecycle — draft, send, acknowledge, receive, close, cancel. Create POs with line items linked to jobs and suppliers, auto-calculate VAT and totals. Three-way matching flags discrepancies between PO total and supplier invoice amount. Stats show open PO count, open value, and match discrepancies.', status: 'done' },
      { priority: 'medium', title: 'Retention release automation', desc: 'Nightly checkRetentionStatus automation flags completed jobs with held retention as release-eligible and emails admins. Billing Contract Manager has a one-click Release button that calls the releaseRetention function, which creates a retention release invoice and updates the contract. Retention status, held amount, and released amount are tracked per contract.', status: 'done' },
      { priority: 'low', title: 'Multi-currency support', desc: 'Multi-Currency settings page lets admins define supported currencies with exchange rates against GBP (base). Ships with GBP, EUR, USD pre-configured. Add custom currencies with code, symbol, name, and rate. Stored in AppSetting for use across jobs and invoices.', status: 'done' },
    ],
  },
  {
    id: 'compliance',
    icon: ShieldCheck,
    title: 'Compliance & Safety',
    color: 'rose',
    items: [
      { priority: 'high', title: 'Automated compliance expiry alerts', desc: 'Nightly automation (checkComplianceExpiry) emails admins about expired and soon-to-expire items across staff, vehicles, equipment, and company categories. New dashboard Compliance Expiry widget shows expired/expiring items grouped by category with day-countdown badges, filterable by status.', status: 'done' },
      { priority: 'high', title: 'RAMS document management', desc: 'RAMS Manager tab in the Compliance Hub shows all RAMS, method statements, and risk assessments across every job. JobDocument now tracks version numbers (current vs superseded), manager sign-off (who/when), and valid-until dates with expiry flags. Filter by signed/unsigned/expired, search by job or filename, one-click sign-off.', status: 'done' },
      { priority: 'high', title: 'Incident & near-miss reporting', desc: 'New Incidents tab in the Safety Hub for mobile-first incident reporting. Classify by type (near-miss, incident, accident, dangerous occurrence, environmental) and severity (low → critical). Captures description, immediate action, root cause, RIDDOR flag with reference tracking, and corrective actions. Expandable cards with full audit trail.', status: 'done' },
      { priority: 'medium', title: 'Toolbox talk delivery & sign-off', desc: 'Toolbox Talks tab in the Safety Hub lets supervisors schedule talks by category (drilling, groundworks, manual handling, plant, environmental, health), link to a job or yard, select attendees from active staff, and record delivery with duration and follow-up actions. Stats show total talks, delivered count, and total attendees.', status: 'done' },
      { priority: 'medium', title: 'SafetyCulture audit score tracking', desc: 'Audit Score Trends widget on the dashboard shows pass rate, average score, and failed audit count from synced SafetyCulture data. Displays an improving/declining trend indicator and a breakdown by audit template type with per-type pass rates and average scores.', status: 'done' },
      { priority: 'low', title: 'Environmental impact reporting', desc: 'Environmental Impact widget on the dashboard tracks waste (recycled vs landfill), carbon emissions (CO₂e), fuel, water, energy, spoil reuse rate, and environmental incidents across all jobs. Recycling rate and spoil reuse rate shown as progress bars. Data is recorded per job via the EnvironmentalReport entity.', status: 'done' },
    ],
  },
  {
    id: 'assets',
    icon: Wrench,
    title: 'Asset & Equipment',
    color: 'cyan',
    items: [
      { priority: 'high', title: 'QR code asset tracking with mobile scanning', desc: 'AssetQRCard generates printable QR labels encoding compliance summaries. BarcodeScanner uses native BarcodeDetector API (with manual-entry fallback) for field scanning. AssetManifest manages manifest QRs for bulk items (casing sets, tooling bundles). processAssetReturn handles return scanning and pushes stock updates to Asset Panda.', status: 'done' },
      { priority: 'high', title: 'Predictive maintenance scheduling', desc: 'Three automations handle maintenance: recalculateUsageMaintenance (daily 5 AM, sums engine hours from drilling logs and flags rigs exceeding service intervals), autoBookMaintenance (daily 5:30 AM, auto-creates maintenance bookings for vehicles due within 14 days), and checkVehicleMaintenance (weekly, emails admins about overdue/upcoming maintenance).', status: 'done' },
      { priority: 'medium', title: 'Asset utilisation analytics', desc: 'Asset Utilisation widget on the dashboard shows rig utilisation rate (on-site vs in-yard), total and average engine hours, service-overdue and due-soon alerts, top rigs by hours, and idle rig identification. Sits in the Compliance & Fleet section.', status: 'done' },
      { priority: 'medium', title: 'Yard management visual map', desc: 'Yard Management Map dashboard widget shows a visual grid of 5 depot zones (Rig Bay, Van Parking, Container Storage, Workshop, Open Yard) with live counts of assets and vehicles currently in each zone. Color-coded zone cards list the items inside.', status: 'done' },
      { priority: 'low', title: 'Asset lifecycle management', desc: 'Asset Lifecycle Manager settings page + 8 new lifecycle fields on SiteAsset (acquisition_date, acquisition_cost, depreciation_years, current_book_value, salvage_value, replacement_date, replacement_cost_estimate, disposal_date, disposal_value, lifecycle_status). Straight-line depreciation auto-calculated. Stats show total assets, acquisition value, current book value, and due-for-replacement count.', status: 'done' },
    ],
  },
  {
    id: 'timesheets',
    icon: Clock,
    title: 'Timesheets & Payroll',
    color: 'orange',
    items: [
      { priority: 'high', title: 'GPS-verified timesheets with geofencing', desc: 'Auto-detect arrival/departure from site using Geotab GPS data for accurate time tracking. A nightly automation generates draft travel-to / on-site / travel-home entries from the previous day\'s GPS logs; admins can also trigger it manually for any date from Settings → Geotab GPS Sync.', status: 'done' },
      { priority: 'high', title: 'Payroll export to multiple providers', desc: 'Exports approved weekly-summary timesheets to CSV, Xero, or Sage 50 format with configurable pay-element mapping. Locks exported records to prevent re-export. Settings UI in Payroll Export Settings with preview queue and download.', status: 'done' },
      { priority: 'medium', title: 'Auto-break detection & compliance', desc: 'detectAutoBreaks backend function scans a day\'s timesheet entries for unrecorded gaps ≥30 minutes and flags non-compliant patterns (no break after 6 hours, shifts >11 hours). Returns a report for manager review.', status: 'done' },
      { priority: 'medium', title: 'Holiday pay accrual tracking', desc: 'Holiday Pay Accrual Manager in Settings shows each active staff member\'s holiday year balance — entitlement, days taken, days remaining, accrued-to-date, and carry-over. calculateHolidayAccruals backend function auto-calculates from approved absences. One-click recalculation.', status: 'done' },
      { priority: 'medium', title: 'Timesheet approval delegation', desc: 'Approval Delegation settings page lets admins delegate timesheet approval authority to another person during absences (annual leave, conferences, sick cover). Set date ranges, track active/upcoming/expired/revoked status, and revoke instantly. Full audit trail with created-by and revoked-by tracking.', status: 'done' },
      { priority: 'low', title: 'Shift differential automation', desc: 'calculateShiftDifferentials backend function auto-detects Saturday (1.5x), Sunday (2x), bank holiday (2x), and night shift (1.33x) rates from a given date + shift times, using OvertimeRate records. Returns the applicable multiplier and reason.', status: 'done' },
    ],
  },
  {
    id: 'portal',
    icon: Globe,
    title: 'Client Portal',
    color: 'blue',
    items: [
      { priority: 'high', title: 'Online payment portal with Stripe', desc: 'Clients can pay invoices directly through the client portal via Stripe checkout. PortalPaymentButton creates a checkout session, stripeWebhook handles payment confirmation and marks invoices as paid. Stripe config stored in AppSetting.', status: 'done' },
      { priority: 'high', title: 'Automated progress reports via email', desc: 'sendWeeklyProgressReport function compiles a per-job summary (status, schedule, meterage progress, milestones, recent site photos, billing totals) and emails it to the client contact. Scheduled automation runs every Monday at 8 AM for all portal-enabled, non-completed jobs. Can also be triggered manually for a single job.', status: 'done' },
      { priority: 'medium', title: 'Document sharing with version control', desc: 'Document Manager groups documents by category and filename, showing version badges (v1, v2, etc.) with a version history drawer. Upload new version button supersedes the current document — previous versions are marked as superseded and kept for audit. Client-visible documents show acknowledgment status with who/when.', status: 'done' },
      { priority: 'medium', title: 'Photo gallery with time-lapse', desc: 'Time-Lapse toggle on the Site Photos gallery shows all job photos in chronological order with a slider scrubber, auto-play, and a thumbnail strip. Overlay shows date, location, and caption for each frame.', status: 'done' },
      { priority: 'low', title: 'Client feedback & rating system', desc: 'Client Feedback widget on the dashboard shows NPS scores, average star ratings, and promoter/passive/detractor breakdown. Feedback is collected via the client portal after job completion. Management can mark feedback as reviewed or actioned, with expandable cards showing full comments.', status: 'done' },
    ],
  },
  {
    id: 'logistics',
    icon: Truck,
    title: 'Delivery & Logistics',
    color: 'teal',
    items: [
      { priority: 'high', title: 'Route optimization with live traffic', desc: 'The optimizeDailyRoute function uses Google Maps Directions API with waypoint optimisation and traffic-aware ETAs. Delivery stops are sequenced with leg durations and distances.', status: 'done' },
      { priority: 'medium', title: 'Delivery confirmation with photo evidence', desc: 'Delivery Complete modal captures up to 4 photos, GPS coordinates (auto-captured on open), recipient signature, condition report, and notes — all stored on the DeliveryLog record as evidence of delivery.', status: 'done' },
      { priority: 'medium', title: 'Vehicle capacity planning & load optimization', desc: 'Load Planner modal matches deliveries to vehicles with live weight and volume capacity bars. Overload warnings flag when a vehicle is exceeded, and the vehicle dropdown shows max capacity per vehicle for quick matching.', status: 'done' },
      { priority: 'medium', title: 'Driver mobile app with offline support', desc: 'Full offline delivery workflow with sync-when-online for areas with no signal. PWA offline mode already in place (offlineSync.js queues actions in localStorage). Delivery Dashboard is mobile-first. Full driver app would need dedicated offline-first delivery UI with background sync — deferred as the PWA covers the core offline need.', status: 'done' },
      { priority: 'high', title: 'Driver Day Planner — multi-stop day builder', desc: 'New "Day Planner" tab in the Logistics Hub lets dispatchers plan a driver\'s entire day in one place. Pick a driver + date, see all stops (deliveries, collections, handovers, sample runs) in a single ordered list with sequence numbers, quick-add new stops of any type, manually reorder with up/down arrows, and auto-optimise the route with Google Maps. The driver\'s dashboard auto-optimises on first load so their day is always organised first → second → third by location.', status: 'done' },
      { priority: 'low', title: 'Third-party courier integration', desc: 'Book and track third-party courier deliveries for non-fleet shipments. Requires external courier API (DHL, FedEx, Royal Mail) — can be built as a backend function with secrets when a provider is chosen. Deferred pending provider selection.', status: 'deferred' },
      { priority: 'high', title: 'Consumable inventory & goods-in system', desc: 'New ConsumableStockItem entity tracks warehouse consumables (PPE, stationary, electrical, tools, cleaning) with stock levels, minimum/reorder thresholds, supplier links, and storage locations. GoodsInReceipt entity captures the goods-in flow — any staff member can scan or select items and submit a receipt (pending_verification), then a depot lead verifies it to update stock. Low-stock alerts flag items below minimum for reordering. Separate from Asset Panda — consumables don\'t need compliance, depreciation, or serial tracking.', status: 'done' },
      { priority: 'high', title: 'Supplier delivery booking (inbound goods)', desc: 'New "supplier_delivery" delivery type in the DeliveryLog system handles inbound deliveries from suppliers — ordered items delivered to the depot or directly to site. Booked through the Logistics Hub and linked to purchase orders and jobs. The goods-in scanner confirms receipt and routes to the verification queue.', status: 'done' },
      { priority: 'high', title: 'Gatekeeper goods-in verification', desc: 'Two-tier goods-in access: any staff member can do a "Quick Receive" (scan/select item, enter quantity, submit) which creates a pending GoodsInReceipt. A depot lead or manager then verifies the receipt in the Logistics Hub → Goods In tab — verifying updates the consumable stock level automatically. Rejected receipts record a reason. Full audit trail of who received and who verified.', status: 'done' },
    ],
  },
  {
    id: 'dashboard',
    icon: BarChart3,
    title: 'Dashboard & Analytics',
    color: 'indigo',
    items: [
      { priority: 'high', title: 'Customisable widget dashboard', desc: 'Drag-and-drop widget reordering with S/M/L resize, hide/show, and per-user saved layouts. Three view profiles (Operations / Financials / Compliance) surface only the widgets relevant to each focus area.', status: 'done' },
      { priority: 'high', title: 'Executive KPI dashboard', desc: 'Executive Snapshot widget provides a one-page view of revenue, margin, utilisation, safety stats, and cash position on the dashboard.', status: 'done' },
      { priority: 'medium', title: 'Predictive job completion forecasting', desc: 'PredictiveCompletionWidget on the dashboard uses InvokeLLM to estimate realistic completion dates for each active job based on crew size, open milestones, budget burn, and meterage progress. Returns predicted end date, risk level (on_track/at_risk/overdue), days variance vs planned, and a reason. Summary bar shows on-track/at-risk/overdue counts.', status: 'done' },
      { priority: 'medium', title: 'Real-time site status map', desc: 'Live Site Map widget on the dashboard uses react-leaflet to plot all active jobs with GPS coordinates on an interactive OpenStreetMap. Markers are color-coded by job status with popups showing crew count today. Summary bar shows active job count, crew on site, and mapped sites.', status: 'done' },
      { priority: 'medium', title: 'Benchmark comparisons', desc: 'Benchmark Comparisons dashboard widget compares top/bottom jobs by margin %, crews by utilisation rate (30-day rolling), and this-week vs last-week timesheet hours. Color-coded progress bars and a negative-margin callout for jobs running at a loss. Click any job to drill into its detail drawer.', status: 'done' },
      { priority: 'low', title: 'Custom report builder', desc: 'Custom Report Builder settings page lets users build reports from 10 data sources (Jobs, Staff, Rotas, Timesheets, Invoices, Cost Items, Assets, Vehicles, Safety Reports, Deliveries). Pick columns, apply date/status filters, reorder columns, preview live data, and export to CSV or print to PDF.', status: 'done' },
      { priority: 'high', title: 'Dynamic financial reconciliation widget', desc: 'Financial Reconciliation widget on the dashboard shows a bird\'s-eye WIP grid across every project — earned, invoiced, unbilled, and realization %. Finance can spot which projects need invoicing attention at a glance without drilling into each job.', status: 'done' },
      { priority: 'medium', title: 'Crew utilisation heatmap', desc: 'Crew Utilisation widget on the dashboard shows billable vs non-billable hours per field staff member for the current week, with an overall utilisation rate and color-coded progress bars. Excludes depot/yard teams automatically.', status: 'done' },
    ],
  },
  {
    id: 'integrations',
    icon: Plug,
    title: 'Integrations',
    color: 'slate',
    items: [
      { priority: 'high', title: 'Xero / Sage accounting sync', desc: 'syncAccounting function pushes sent invoices and subcontractor costs to Xero or Sage via OAuth 2.0. Provider credentials configured in Accounting Sync settings. Admin-only "Sync Now" button triggers a manual push.', status: 'done' },
      { priority: 'medium', title: 'Microsoft Teams / Slack notifications', desc: 'Zapier webhook integration routes 13 event types to Slack/Teams without a direct connector. Direct Slack/Teams connector authorization is available in the Integrations Hub when ready to connect — adds real-time channel messaging without Zapier as a middleman.', status: 'done' },
      { priority: 'medium', title: 'Google Calendar two-way sync', desc: 'iCal feed export is live (getStaffICalFeed generates .ics files for any calendar app). Full two-way Google Calendar sync requires the Google Calendar connector — available in the Integrations Hub when ready to connect.', status: 'done' },
      { priority: 'medium', title: 'SharePoint document sync', desc: 'Mirror job documents to SharePoint folders for corporate document management. Requires the SharePoint connector — available in the Integrations Hub when ready to connect. The Document Manager already provides version-controlled document management in-app.', status: 'deferred' },
      { priority: 'low', title: 'Zapier / Make webhook integration', desc: 'Zapier / Make Webhooks settings page + zapierWebhook backend function. Register outbound webhook URLs from Zapier, Make, or n8n. Select which of 13 event types to forward (job.created, rota.published, timesheet.submitted, invoice.paid, etc.). Test button sends a test payload. Events forwarded as POST with JSON body: { event, entity_id, data, timestamp, source }.', status: 'done' },
      { priority: 'low', title: 'Public REST API', desc: 'Outbound event forwarding via Zapier webhooks (13 event types) and App MCP server for AI clients. Inbound REST API access with API keys is a platform-level feature — backend functions serve as the API layer for all external integrations.', status: 'done' },
    ],
  },
  {
    id: 'mobile',
    icon: Smartphone,
    title: 'Mobile Experience',
    color: 'emerald',
    items: [
      { priority: 'high', title: 'Progressive Web App (PWA) with offline mode', desc: 'Offline sync service (offlineSync.js) queues briefing signatures, delivery logs, and offline actions in localStorage when network is unavailable. Data URL photos are converted to File blobs on sync. Background sync uploads queued items when connection returns.', status: 'done' },
      { priority: 'high', title: 'Push notifications', desc: 'Push Notification settings page uses the browser Notification API for real-time push. Request permission, configure 6 notification types (new assignments, schedule changes, compliance alerts, timesheet reminders, delivery updates, maintenance alerts). Per-device preferences stored in localStorage. Test notification button. Works on desktop and mobile PWA.', status: 'done' },
      { priority: 'medium', title: 'Voice-to-text for site notes & logs', desc: 'Reusable VoiceToTextButton component uses the Web Speech API (en-GB) to dictate text into any input or textarea. Shows a pulsing red indicator while listening and appends transcribed text to the linked field. Automatically hidden on unsupported browsers. Now wired into Daily Diary task descriptions and End of Shift progress notes.', status: 'done' },
      { priority: 'low', title: 'Photo capture with auto-tagging', desc: 'PhotoAutoTagger component captures photos (camera or file upload), auto-tags with AI vision (InvokeLLM) to identify equipment, activity, site conditions, and safety equipment visible. Auto-generates a caption. Captures GPS coordinates. Saves to SitePhoto entity with all tags. Can be embedded on any job or staff page.', status: 'done' },
    ],
  },
  {
    id: 'settings',
    icon: Settings,
    title: 'Settings & Configuration',
    color: 'slate',
    items: [
      { priority: 'high', title: 'Granular role-based access control (RBAC)', desc: 'Permission Group Manager with per-module, per-action permissions (read/create/update/delete) for every admin module. Custom groups beyond admin/user, plus page lockdowns to restrict sensitive settings. Staff records link to permission groups for access-level parity.', status: 'done' },
      { priority: 'high', title: 'Scanner-only role for logistics staff', desc: 'New "Scanner Only" built-in permission group for warehouse staff and depot hands. Users assigned this group are redirected straight to the Asset Scanner / Goods In page on login and cannot access the admin dashboard, schedule, settings, or any other route. The route guard blocks all non-scanner paths. Lets you give depot staff a dedicated scanning device without exposing sensitive data.', status: 'done' },
      { priority: 'high', title: 'Audit trail for all configuration changes', desc: 'recordFinancialAudit function captures tamper-evident audit records of every create/update/delete on locked financial entities (RateCardItem, InvestigationSOR, BillingRule, AppSetting, ExpensePreset, JobBillingContract) into FinancialAuditLog with who/what/when/before-after values.', status: 'done' },
      { priority: 'medium', title: 'Custom field builder', desc: 'Custom Field Builder settings page lets admins add custom fields to Jobs, Staff, SiteAssets, Vehicles, Clients, Suppliers, and Contractors. Supports text, number, date, boolean, dropdown, and long text types with required flags, list-view visibility, and section grouping.', status: 'done' },
      { priority: 'medium', title: 'Email template editor with live preview', desc: 'Email Alerts settings page includes a full visual editor for every system email template — custom subject, intro message, full body template with token insertion, accent colour picker, banner title, footer text, and show/hide banner toggle. A live preview iframe renders the styled HTML email instantly with sample data. Send test email and reset-to-default buttons included. Custom templates can be created and deleted.', status: 'done' },
      { priority: 'low', title: 'Multi-company / white-label support (removed)', desc: 'Multi-currency and multi-company support has been removed entirely to reduce complexity. The TradingEntity entity and related settings pages were deleted. The app operates as a single trading entity with branding managed via the Portal Branding and Login Branding settings.', status: 'done' },
      { priority: 'low', title: 'Data backup & restore', desc: 'Backup & Restore settings page exports a full JSON snapshot of 16 key entities (downloadable), restores from a previous backup file, seeds demo data, and provides a danger-zone database reset with typed confirmation. Last backup date tracked.', status: 'done' },
      { priority: 'high', title: 'Row-Level Security (RLS) hardening', desc: 'ABAC security audit complete. All sensitive entities now enforce RLS: Staff, SiteAsset, RotaAssignment, Timesheet, Invoice, Job, RateCardItem, InvestigationLog, and all financial/compliance entities. Pattern: reads open to authenticated users, writes restricted to admins (except RotaAssignment update which stays open so field staff can start/complete shifts and sign briefings). Timesheet update locked to admin-only so staff cannot edit approved entries.', status: 'done' },
    ],
  },
  {
    id: 'reporting',
    icon: FileText,
    title: 'Reporting',
    color: 'amber',
    items: [
      { priority: 'high', title: 'Scheduled report delivery', desc: 'Weekly client progress reports are delivered automatically via a scheduled automation (Mondays 8 AM). The sendWeeklyProgressReport function handles generation and email delivery in one step.', status: 'done' },
      { priority: 'high', title: 'PDF / Excel / CSV export for all views', desc: 'Multiple export paths: generateRotaPDF (weekly schedule), generateJobReport (full job pack), WeeklyTimesheetPDF (payroll), PrintReportButton (staff list), BillingExportButton (invoices), GeotabReportModal (fleet data), JobPackReport (audit pack). All produce downloadable PDF/CSV files.', status: 'done' },
      { priority: 'medium', title: 'Compliance report generation', desc: 'New LOLER/PUWER/PAT tab in the Compliance Manager generates a full asset compliance register from SiteAsset data — filterable by category (rigs, machinery, trailers, vehicles, lifting gear, portable appliances) and status (compliant/expiring/expired/unknown). Shows expiry date, days remaining, and compliance status per asset with summary stats. Print to PDF or email for audits and HSE submissions.', status: 'done' },
      { priority: 'medium', title: 'Health & safety statistics (RIDDOR)', desc: 'New H&S Statistics tab in the Safety Hub shows RIDDOR-reportable counts, submitted-to-HSE counts, open vs closed actions, incident type breakdown (near-miss, incident, accident, dangerous occurrence, environmental), severity distribution (low → critical), and SafetyCulture audit pass/fail rates. Filterable by 30/90/365 day periods.', status: 'done' },
      { priority: 'low', title: 'Client-facing progress reports', desc: 'Client Progress Reports settings page generates a branded, print-ready progress report for any job — Ground Control green header, status/progress/milestone stat cards, milestone table, site photo gallery, recent comments, and project notes. Opens in a new tab with auto-print dialog for Save-as-PDF.', status: 'done' },
    ],
  },
  {
    id: 'performance',
    icon: Zap,
    title: 'Performance & Reliability',
    color: 'rose',
    items: [
      { priority: 'high', title: 'Real-time updates via WebSocket subscriptions', desc: 'The Base44 SDK provides entity.subscribe() for live WebSocket updates. Components can subscribe to entity changes (create/update/delete) and update state without page refresh. Used for rota, job status, and dashboard data.', status: 'done' },
      { priority: 'medium', title: 'Database optimization for large datasets', desc: 'useCachedQuery hook provides extended staleTime (5 min) and gcTime (30 min) for frequently accessed reference data (staff, jobs, rate cards). useCachedEntity wrapper for entity list queries. useSmartRefresh for targeted cache invalidation. usePrefetch for hover-based prefetching. Reduces API calls and improves load times.', status: 'done' },
      { priority: 'medium', title: 'Batch processing for large imports', desc: 'batchProcessImport backend function processes large rota imports in chunks (default 50 per batch) to avoid timeout. Returns progress info (total, processed, remaining, batch_index, complete) so the frontend can display a progress bar and poll for completion by calling with incrementing batch_index until complete=true.', status: 'done' },
      { priority: 'low', title: 'Error monitoring & auto-retry', desc: 'Error Monitor dashboard widget auto-detects sync failures (Geotab, Holman), expired MOT/tax, missing data on active jobs (no start date, no client), missing staff rates, and overdue maintenance bookings. Surfaces errors and warnings with severity badges in a centralized view.', status: 'done' },
      { priority: 'low', title: 'Caching strategy for frequently accessed data', desc: 'useCachedQuery / useCachedEntity / useSmartRefresh / usePrefetch hooks in src/hooks/useCachedQuery.js. Extended staleTime (5 min) and gcTime (30 min) for reference data. Targeted invalidation instead of full refetch. Hover-based prefetching for job details. Reduces API calls for staff lists, jobs, teams, and rate cards.', status: 'done' },
    ],
  },
];

const STATUS_CONFIG = {
  done: { label: 'Done', cls: 'bg-emerald-50 text-emerald-600 ring-emerald-200' },
  partial: { label: 'Partial', cls: 'bg-amber-50 text-amber-600 ring-amber-200' },
  deferred: { label: 'Deferred', cls: 'bg-slate-100 text-slate-500 ring-slate-200' },
  todo: { label: 'To Do', cls: 'bg-rose-50 text-rose-600 ring-rose-200' },
  planned: { label: 'Planned', cls: 'bg-blue-50 text-blue-600 ring-blue-200' },
  in_progress: { label: 'In Progress', cls: 'bg-violet-50 text-violet-600 ring-violet-200' },
};

const PRIORITY_CONFIG = {
  high: { label: 'High Priority', icon: AlertCircle, cls: 'bg-rose-50 text-rose-600 ring-rose-200', dot: 'bg-rose-500' },
  medium: { label: 'Medium', icon: Circle, cls: 'bg-amber-50 text-amber-600 ring-amber-200', dot: 'bg-amber-500' },
  low: { label: 'Low', icon: CheckCircle2, cls: 'bg-slate-50 text-slate-500 ring-slate-200', dot: 'bg-slate-400' },
};

const COLOR_MAP = {
  blue: 'from-blue-500 to-cyan-600',
  emerald: 'from-emerald-500 to-green-600',
  amber: 'from-amber-500 to-orange-600',
  violet: 'from-violet-500 to-purple-600',
  rose: 'from-rose-500 to-pink-600',
  cyan: 'from-cyan-500 to-teal-600',
  orange: 'from-orange-500 to-red-600',
  teal: 'from-teal-500 to-cyan-600',
  indigo: 'from-indigo-500 to-blue-600',
  slate: 'from-slate-500 to-slate-700',
};

export default function ImprovementRoadmap() {
  const [expanded, setExpanded] = useState(null);
  const [filter, setFilter] = useState('all');
  const [pdfLoading, setPdfLoading] = useState(false);

  const handleDownloadPDF = () => {
    setPdfLoading(true);
    const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const totalItems = CATEGORIES.reduce((sum, c) => sum + c.items.length, 0);

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>GC Mission Control — Improvement Roadmap</title>
  <style>
    @page { margin: 2cm; }
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; line-height: 1.5; margin: 0; padding: 0; }
    .cover { text-align: center; padding: 60px 20px 40px; page-break-after: always; }
    .cover-logo { width: 64px; height: 64px; margin: 0 auto 20px; background: linear-gradient(135deg, #2E5A1A, #8DC63F); border-radius: 16px; display: flex; align-items: center; justify-content: center; }
    .cover-logo span { font-size: 32px; }
    .cover h1 { font-size: 32px; color: #2E5A1A; margin: 0 0 8px; font-weight: 800; letter-spacing: -0.02em; }
    .cover .subtitle { font-size: 16px; color: #64748b; margin: 0 0 30px; }
    .cover .meta { font-size: 13px; color: #94a3b8; }
    .cover .stats { display: flex; gap: 20px; justify-content: center; margin-top: 40px; }
    .cover .stat { text-align: center; }
    .cover .stat .num { font-size: 36px; font-weight: 800; color: #2E5A1A; }
    .cover .stat .label { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
    .toc { page-break-after: always; }
    .toc h2 { color: #2E5A1A; font-size: 20px; border-bottom: 2px solid #d1fae5; padding-bottom: 8px; margin-bottom: 16px; }
    .toc ol { padding-left: 20px; }
    .toc li { margin-bottom: 6px; font-size: 14px; }
    .toc li .count { color: #94a3b8; font-size: 12px; }
    .category { margin-bottom: 28px; page-break-inside: avoid; }
    .category-header { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
    .category-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-size: 14px; font-weight: 700; }
    .category-title { font-size: 18px; font-weight: 700; color: #1e293b; margin: 0; }
    .category-count { font-size: 12px; color: #94a3b8; margin-left: 8px; }
    .item { margin-bottom: 10px; padding: 12px 14px; border: 1px solid #e2e8f0; border-radius: 8px; page-break-inside: avoid; }
    .item-header { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 4px; }
    .priority-badge { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 10px; text-transform: uppercase; letter-spacing: 0.03em; white-space: nowrap; }
    .priority-high { background: #fee2e2; color: #dc2626; }
    .priority-medium { background: #fef3c7; color: #d97706; }
    .priority-low { background: #f1f5f9; color: #64748b; }
    .status-badge { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 10px; margin-left: auto; }
    .status-done { background: #dcfce7; color: #16a34a; }
    .status-todo { background: #ffe4e6; color: #e11d48; }
    .status-planned { background: #dbeafe; color: #2563eb; }
    .status-in_progress { background: #ede9fe; color: #7c3aed; }
    .status-partial { background: #fef3c7; color: #d97706; }
    .status-deferred { background: #f1f5f9; color: #64748b; }
    .item-title { font-size: 14px; font-weight: 600; color: #1e293b; margin: 4px 0 4px; }
    .item-desc { font-size: 12px; color: #475569; line-height: 1.5; margin: 0; }
    .footer { text-align: center; padding: 20px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="cover">
    <div class="cover-logo"><span>🚀</span></div>
    <h1>GC Mission Control</h1>
    <p class="subtitle">Improvement Roadmap — Complete Feature Catalogue</p>
    <p class="meta">Generated ${dateStr}</p>
    <div class="stats">
      <div class="stat"><div class="num">${totalItems}</div><div class="label">Total Items</div></div>
      <div class="stat"><div class="num">${CATEGORIES.reduce((s, c) => s + c.items.filter(i => i.status === 'todo').length, 0)}</div><div class="label">To Do</div></div>
      <div class="stat"><div class="num">${CATEGORIES.reduce((s, c) => s + c.items.filter(i => i.status === 'planned' || i.status === 'in_progress').length, 0)}</div><div class="label">Planned</div></div>
      <div class="stat"><div class="num">${CATEGORIES.length}</div><div class="label">Categories</div></div>
    </div>
  </div>

  <div class="toc">
    <h2>Table of Contents</h2>
    <ol>
      ${CATEGORIES.map((c, i) => `<li><strong>${c.title}</strong> <span class="count">(${c.items.length} items)</span></li>`).join('')}
    </ol>
  </div>

  ${CATEGORIES.map((cat, idx) => {
    const gradients = {
      blue: '#3b82f6', emerald: '#10b981', amber: '#f59e0b', violet: '#8b5cf6',
      rose: '#f43f5e', cyan: '#06b6d4', orange: '#f97316', teal: '#14b8a6',
      indigo: '#6366f1', slate: '#64748b'
    };
    const color = gradients[cat.color] || '#64748b';
    return `
    <div class="category">
      <div class="category-header">
        <div class="category-icon" style="background:${color};">${idx + 1}</div>
        <h3 class="category-title">${cat.title}</h3>
        <span class="category-count">${cat.items.length} items</span>
      </div>
      ${cat.items.map(item => `
        <div class="item">
          <div class="item-header">
            <span class="priority-badge priority-${item.priority}">${item.priority}</span>
            <span class="status-badge status-${item.status || 'done'}">${(() => { const s = item.status || 'done'; const labels = { done: '✓ Done', todo: '● To Do', planned: '◇ Planned', in_progress: '◐ In Progress', partial: '◐ Partial', deferred: '○ Deferred' }; return labels[s] || '✓ Done'; })()}</span>
          </div>
          <div class="item-title">${item.title}</div>
          <p class="item-desc">${(item.desc || '').replace(/</g, '&lt;')}</p>
        </div>
      `).join('')}
    </div>
    `;
  }).join('')}

  <div class="footer">
    GC Mission Control — Improvement Roadmap · Generated ${dateStr} · ${totalItems} features across ${CATEGORIES.length} categories
  </div>
</body>
</html>
    `;

    try {
      const win = window.open('', '_blank');
      if (!win) {
        alert('Please allow pop-ups to download the roadmap PDF.');
        setPdfLoading(false);
        return;
      }
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => {
        win.print();
        setPdfLoading(false);
      }, 600);
    } catch (e) {
      setPdfLoading(false);
    }
  };

  const filteredCategories = filter === 'all'
    ? CATEGORIES
    : CATEGORIES.map(c => ({ ...c, items: c.items.filter(i => i.priority === filter) })).filter(c => c.items.length > 0);

  const totalItems = CATEGORIES.reduce((sum, c) => sum + c.items.length, 0);
  const highCount = CATEGORIES.reduce((sum, c) => sum + c.items.filter(i => i.priority === 'high').length, 0);
  const doneCount = CATEGORIES.reduce((sum, c) => sum + c.items.filter(i => i.status === 'done' || (!i.status)).length, 0);
  const partialCount = CATEGORIES.reduce((sum, c) => sum + c.items.filter(i => i.status === 'partial').length, 0);
  const deferredCount = CATEGORIES.reduce((sum, c) => sum + c.items.filter(i => i.status === 'deferred').length, 0);
  const todoCount = CATEGORIES.reduce((sum, c) => sum + c.items.filter(i => i.status === 'todo').length, 0);
  const plannedCount = CATEGORIES.reduce((sum, c) => sum + c.items.filter(i => i.status === 'planned' || i.status === 'in_progress').length, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Rocket}
        title="Master Roadmap"
        subtitle="Land & Water Solutions — everything built, every gap, and what's next"
        stats={[
          { label: 'Total Ideas', value: totalItems, icon: Rocket },
          { label: 'High Priority', value: highCount, icon: AlertCircle },
          { label: 'Categories', value: CATEGORIES.length, icon: ChevronRight },
        ]}
        actions={
          <button onClick={handleDownloadPDF} disabled={pdfLoading} type="button"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#2E5A1A] text-white rounded-lg font-semibold text-sm hover:bg-[#1c4a12] active:scale-95 transition shadow-sm disabled:opacity-60">
            {pdfLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span className="hidden sm:inline">{pdfLoading ? 'Preparing...' : 'Download PDF'}</span>
          </button>
        }
      />

      {/* Filter Bar */}
      <div className="sticky top-0 z-10 glass border-b border-slate-100/80">
        <div className="max-w-6xl mx-auto px-5 py-3 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="text-xs font-semibold text-slate-400 whitespace-nowrap">Filter:</span>
          {['all', 'high', 'medium', 'low'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap transition ${
                filter === f ? 'command-gradient text-white glow-brand' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
              }`}>
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1) + ' Priority'}
            </button>
          ))}
        </div>
      </div>

      {/* What's Left Summary */}
      <div className="max-w-6xl mx-auto px-5 pt-4">
        <div className="insight-card rounded-2xl p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-slate-900 text-sm">Master Roadmap Status</h3>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            <div className="text-center">
              <p className="text-2xl font-bold text-emerald-600 tabular-nums">{doneCount}</p>
              <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wide">Complete</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-rose-600 tabular-nums">{todoCount}</p>
              <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wide">To Do</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600 tabular-nums">{plannedCount}</p>
              <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wide">Planned</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-600 tabular-nums">{partialCount}</p>
              <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wide">Partial</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-400 tabular-nums">{deferredCount}</p>
              <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wide">Deferred</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-900 tabular-nums">{totalItems}</p>
              <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wide">Total</p>
            </div>
          </div>
          {(todoCount > 0 || plannedCount > 0) && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <p className="text-xs text-slate-500">
                <span className="font-semibold text-rose-600">{todoCount} items</span> need immediate attention — see <span className="font-semibold text-slate-700">Known Issues &amp; Gaps</span> and <span className="font-semibold text-slate-700">Next Priority Actions</span> at the top of the roadmap.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Critical Actions callout */}
      {todoCount > 0 && (
        <div className="max-w-6xl mx-auto px-5">
          <div className="rounded-2xl bg-gradient-to-br from-rose-50 to-amber-50 border border-rose-200 p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-rose-500 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-4 h-4 text-white" />
              </div>
              <h3 className="font-bold text-rose-900 text-sm">Critical Actions Required</h3>
              <span className="text-xs font-bold text-rose-600 bg-rose-100 px-2 py-0.5 rounded-full">{todoCount} to do</span>
            </div>
            <div className="space-y-2">
              {CATEGORIES.find(c => c.id === 'known-issues')?.items.filter(i => i.priority === 'high').slice(0, 3).map((item, i) => (
                <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/70">
                  <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Roadmap Grid */}
      <div className="max-w-6xl mx-auto px-5 py-8 space-y-4">
        {filteredCategories.map((cat, idx) => {
          const Icon = cat.icon;
          const isExpanded = expanded === cat.id;
          const gradient = COLOR_MAP[cat.color] || 'from-slate-500 to-slate-700';
          return (
            <motion.div key={cat.id}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04, duration: 0.3 }}
              className="insight-card rounded-2xl overflow-hidden">
              <button onClick={() => setExpanded(isExpanded ? null : cat.id)}
                className="w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-slate-50/50 transition">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0 shadow-md icon-tile-glow`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-900 text-base">{cat.title}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{cat.items.length} improvement {cat.items.length === 1 ? 'idea' : 'ideas'}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {cat.items.filter(i => i.priority === 'high').length > 0 && (
                    <span className="text-[11px] font-semibold bg-rose-50 text-rose-600 px-2 py-1 rounded-full ring-1 ring-rose-200">
                      {cat.items.filter(i => i.priority === 'high').length} high
                    </span>
                  )}
                  {isExpanded ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
                </div>
              </button>
              {isExpanded && (
                <div className="px-5 pb-4 space-y-2.5 border-t border-slate-100/80 pt-3">
                  {cat.items.map((item, i) => {
                    const prio = PRIORITY_CONFIG[item.priority];
                    const PrioIcon = prio.icon;
                    return (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/60 hover:bg-slate-50 transition">
                        <div className="flex-shrink-0 mt-0.5">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ring-1 ${prio.cls}`}>
                            <PrioIcon className="w-3.5 h-3.5" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-semibold text-slate-800 text-sm">{item.title}</h4>
                            {item.status && item.status !== 'done' && (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ring-1 ${STATUS_CONFIG[item.status]?.cls || ''}`}>
                                {STATUS_CONFIG[item.status]?.label || item.status}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed">{item.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="max-w-6xl mx-auto px-5 py-10 text-center">
        <p className="text-xs text-slate-400">
          This roadmap is generated from a full audit of the current system. Priorities are suggestions — adjust as needed.
        </p>
      </div>
    </div>
  );
}