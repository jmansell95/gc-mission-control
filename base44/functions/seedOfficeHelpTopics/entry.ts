import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';

// ============================================================
// seedOfficeHelpTopics — one-time seeding of comprehensive
// HelpTopic records with audience='office' covering every admin
// hub, financial workflow, integration, and system feature.
//
// Idempotent: skips topics that already exist by title.
// Admin-only.
// ============================================================

const TOPICS = [
  {
    title: 'Dashboard Overview',
    category: 'general',
    summary: 'Understanding the Mission Control dashboard — widgets, filters, and quick actions.',
    order: 1,
    tags: 'dashboard, overview, widgets, stats, mission control',
    content: `# Dashboard Overview

The Mission Control dashboard is your command centre — a real-time view of everything happening across your business stream.

## Key Widgets

- **Project Health** — Active projects, their status, and progress at a glance
- **Crew Deployment** — Who is on site, who is available, and who is off today
- **Live Site Map** — GPS locations of all crews and vehicles on active sites
- **Billing Pipeline** — AFPs in draft, review, and submitted stages
- **Compliance Overview** — Expiring certificates, overdue audits, and safety alerts
- **Revenue Velocity** — Drilling meterage and revenue trends over time

## Using Filters

Use the job selector bar at the top to filter the dashboard to a specific project, or view all projects. The division switcher in the sidebar lets enterprise admins toggle between business streams.

## Quick Actions

- **Command Centre** — Click any widget to drill down into the detail
- **AI Daily Briefing** — Read the auto-generated summary of today priorities
- **Add Job** — Create a new project directly from the dashboard
- **Assign Crew** — Open the scheduling hub to build the weekly rota

## Tips

- Widgets are customisable — use the layout editor to rearrange them
- Click any stat number to drill down into the underlying records
- The dashboard refreshes in real-time as data changes in the field`,
  },
  {
    title: 'Jobs Management',
    category: 'general',
    summary: 'Creating, editing, and managing projects — disciplines, crews, and site details.',
    order: 2,
    tags: 'jobs, projects, create, edit, disciplines, site',
    content: `# Jobs Management

Projects (referred to as Jobs throughout the system) are the core unit of work. Each job tracks a site investigation from planning through completion.

## Creating a Job

1. Click **Add Job** from the dashboard or jobs hub
2. Fill in the project name, site location, and client
3. Set the start and end dates
4. Choose the discipline(s) — drilling, groundworks, or depot
5. Set the revenue method (day rate, meterage, unit rate, or flat fee)
6. Upload the requisition list and site maps

## Multi-Discipline Jobs

A single job can have multiple disciplines (e.g. drilling AND groundworks). Each discipline tracks its own:
- Status (planning, active, completed, on hold)
- Start/end dates
- Revenue method and rates
- Required teams

## Job Statuses

- **Planning** — New job, rota not yet published
- **In Progress** — Rota published, crew on site
- **Decommissioning** — Work finished, equipment being collected
- **Completed** — All assets returned, site cleared
- **On Hold** — Paused with a reason
- **Cancelled** — Cancelled with a reason

## Site Details

Each job stores the site address, GPS coordinates (for geofencing), what3words, and site contact information. The weather thresholds can be overridden per project for site-specific safety limits.

## Documents

Upload site maps, scope of work, RAMS, and method statements. RAMS documents support versioning — upload a new revision and the old one is marked as superseded. Documents can be marked as client-visible for the portal.`,
  },
  {
    title: 'Scheduling and Rota',
    category: 'general',
    summary: 'Building the weekly rota, assigning crews, and publishing schedules.',
    order: 3,
    tags: 'scheduling, rota, crew, assignment, publish, weekly',
    content: `# Scheduling and Rota

The Scheduling Hub is where you build the weekly rota — assigning crews to jobs, managing availability, and publishing schedules.

## Weekly Rota Builder

1. Select the week from the date picker
2. Drag staff onto jobs for each day, or use the **Assign Crew** button
3. The system checks for conflicts (double-booking, missing qualifications)
4. Add permanent crew for recurring weekly patterns
5. Click **Publish** to send the rota to all assigned crew

## Availability

- View each crew member availability heatmap
- Approved holidays show as blocked-out dates
- The system prevents assigning staff who are on holiday or off sick

## Permanent Crew

For long-running projects, set up a permanent crew pattern (e.g. Mon to Fri). The system auto-generates rota assignments for each week — no need to re-assign manually. When the project end date extends, the system auto-generates new weeks.

## Rota Warnings

The system flags:
- **Missing qualifications** — Staff assigned to a job requiring certifications they do not hold
- **Double-booking** — Staff assigned to two jobs on the same day
- **No crew assigned** — A job has no crew for a working day
- **Depot vs site hours** — Depot staff have different working hours (07:00-16:00) vs site hours (08:00-17:00)

## Publishing

When you publish a rota:
- All assigned crew receive an email with their schedule
- The job status automatically moves to In Progress
- Crew see a splash screen on their phone acknowledging the week schedule`,
  },
  {
    title: 'Staff Hub',
    category: 'general',
    summary: 'Managing staff records, contacts, crew profiles, and access levels.',
    order: 4,
    tags: 'staff, contacts, crew, profiles, access, permissions',
    content: `# Staff Hub

The Staff Hub is your directory of all staff members — direct employees, subcontractors, and agency workers.

## Staff List

View all staff in your division. Filter by team, worker type, or active status. Click any staff card to view their full profile, contact details, and compliance status.

## Adding Staff

1. Click **Add Staff**
2. Choose worker type: Direct Employee, Subcontractor, or Agency
3. Fill in name, email, phone, and job title
4. Assign to a team
5. Set their permission group (access level)
6. Toggle **Send Invite** to email them a login link

## Contacts Tab

The Contacts tab shows all subcontractor and agency companies. Each company card shows:
- Onboarding status (pending, approved, suspended)
- Insurance expiry and coverage limits
- CIS verification status
- Contacts (name, role, phone, email)
- Crew members (Lead Driller, Second Man)

## Access Levels

Each staff member access is controlled by their **Permission Group**:
- **Super Admin** — Full access to everything
- **Management** — Most hubs except settings
- **Users** — Standard office access
- **Field Team** — Field app only (schedule, profile, scanner)
- **Read Only** — View-only access

Set the permission group on each staff card. The system role syncs automatically.

## Approver Designation

Toggle **Access Approver** on any staff card (super admins only) to designate them as a person who receives new-user access requests in their inbox.`,
  },
  {
    title: 'Assets Hub',
    category: 'general',
    summary: 'Managing rigs, equipment, lifting gear, and PAT testing across the yard and sites.',
    order: 5,
    tags: 'assets, rigs, equipment, lifting gear, pat, compliance, asset panda',
    content: `# Assets Hub

The Assets Hub tracks all physical assets — drilling rigs, machinery, trailers, vehicles, lifting gear, and portable appliances.

## Asset Types

- **Rigs** — Cable percussion and rotary drilling rigs (with rig type classification)
- **Machinery** — Excavators, dumpers, and other plant
- **Trailers** — Towable equipment
- **Vehicles** — Company vehicles (managed in the Fleet Hub)
- **Lifting Gear** — Shackles, slings, chains, hooks (LOLER)
- **Portable Appliances** — 110V transformers, power tools, leads (PAT)

## Asset Panda Sync

Assets are synced from Asset Panda, which is the source of truth for:
- Stock levels (quantity owned vs available)
- Warehouse locations
- Asset conditions
- Serial numbers and barcodes

The sync runs daily. Use **Sync Now** to trigger an immediate update.

## QR Codes and Scanner

Every asset has a system-generated QR code. Print the QR labels and use the scanner (phone camera) to:
- Book equipment in and out of jobs
- Check compliance status on site
- Log services and inspections

## Compliance Tracking

Each asset tracks:
- **LOLER** — Lifting gear inspections
- **PUWER** — Machinery inspections
- **PAT** — Portable appliance testing
- Compliance status: compliant, expiring (30 days or less), expired

## Depreciation

Assets track depreciation using straight-line, reducing balance, or units-of-production methods. The system auto-calculates current book value and accumulated depreciation.`,
  },
  {
    title: 'Fleet Hub',
    category: 'general',
    summary: 'Vehicle management, live tracking, MOT/service schedules, and mileage.',
    order: 6,
    tags: 'fleet, vehicles, tracking, mot, service, mileage, geotab, holman',
    content: `# Fleet Hub

The Fleet Hub manages all company vehicles — live GPS tracking, maintenance schedules, and mileage records.

## Live Tracking

- **Live Map** — Real-time GPS locations of all vehicles (via Geotab)
- **Crew on Site** — See which crew members are in each vehicle
- **Trip History** — Review past trips with route playback
- **Geofence Events** — Arrival and departure timestamps at job sites

## Vehicle Records

Each vehicle tracks:
- Registration, make, model, and MOT/tax expiry
- Service history and next service due
- Mileage (synced from Holman or Geotab)
- Assigned driver
- Maintenance bookings

## Maintenance

- **Service Schedule** — Date-based or usage-based (engine hours) intervals
- **MOT Reminders** — Automated alerts before MOT expiry
- **Predictive Maintenance** — AI-flagged vehicles likely to need attention soon
- **Booking System** — Schedule maintenance with your garage

## Integrations

- **Geotab** — Live GPS tracking, trip data, and driver safety scores
- **Holman** — MOT dates, service dates, and mileage from fleet management
- Both sync daily and can be triggered manually

## Mileage Reconciliation

The system compares Geotab GPS mileage with claimed mileage to flag discrepancies for review.`,
  },
  {
    title: 'Compliance Hub',
    category: 'compliance',
    summary: 'Safety audits, incidents, toolbox talks, compliance certificates, and training.',
    order: 7,
    tags: 'compliance, safety, audits, mitti, incidents, toolbox talks, training, rams',
    content: `# Compliance Hub

The Compliance Hub is your central place for all safety, audit, and compliance management.

## Mitti (SafetyCulture) Audits

- Audits sync automatically from Mitti via webhook
- View all audits by template, date, or auditor
- Failed items generate action items routed to the right people
- Audit templates can be pinned, hidden, or filtered by GC reference codes

## Audit Dashboard

- Grid of all audit templates with pass/fail rates
- Click any template to see individual audits
- Drill down into audit details — scores, failed items, action items
- Export audit reports as PDF

## Incidents

- Report incidents (near miss, accident, dangerous occurrence, environmental)
- Track severity, root cause, and immediate actions taken
- RIDDOR-flagged incidents are highlighted
- AI-assisted incident analysis suggests root causes

## Toolbox Talks

- Schedule and deliver toolbox talks
- Capture digital signatures from attendees
- Sync talks from Mitti audits automatically
- Track follow-up actions

## Compliance Items

Track compliance items by category:
- **LOLER** — Lifting gear inspections
- **PUWER** — Machinery inspections
- **PAT** — Portable appliance testing
- **Driver checks** — Daily vehicle walk-rounds

## Training and Qualifications

- Assign training categories to staff
- Track certificate expiry dates
- Training gap analysis shows who needs what
- Book training courses and track completion

## RAMS

Upload and manage Risk Assessments and Method Statements with version control and sign-off tracking.`,
  },
  {
    title: 'Billing Hub',
    category: 'financial',
    summary: 'AFP builder, CVR management, invoicing, rate cards, and financial reporting.',
    order: 8,
    tags: 'billing, afp, cvr, invoicing, rate card, financial, margin, disputes',
    content: `# Billing Hub

The Billing Hub manages the entire billing lifecycle — from field data collection through to client invoicing.

## AFP (Application for Payment)

The AFP is the core billing document. Each job has a chain of AFPs covering sequential billing periods.

### AFP Lifecycle
1. **Draft** — Auto-populated from field data (driller logs, timesheets, deliveries, costs)
2. **Pending Review** — Submitted for manager review
3. **Submitted** — Sent to the client for approval
4. **Approved** — Client approved all items
5. **Invoiced** — Pushed to the CVR and converted to a formal invoice

### AFP Builder
- **Measured Works** — Line items with contracted qty, qty complete, and applied this period
- **Variations** — Variation orders with cost-agreement lifecycle (budget, firm, assessment, agreed)
- **Materials** — Materials on site
- **Compensation Items** — CI01-03 sheets
- **EWR Format** — For Early Warning Report projects (drilling, dayworks, enabling crew, accommodation, etc.)

### Dual-Side AFPs
The AFP tracks both sides:
- **Our Claim** — What we have done (gross applied, previous applied, applied this period)
- **Client Assessment** — What the client agrees to pay (assessed measure, gross assessed)

## CVR (Cost Value Reconciliation)

The CVR tracks the financial position of each job:
- Contract value vs claimed vs assessed
- Revenue, costs, and margin
- Variations and their agreement status
- Cash flow forecast

## Invoicing

- Auto-generate invoices from approved AFPs
- Track invoice status (draft, sent, paid, overdue)
- Chase overdue invoices automatically
- Export to Xero/Sage accounting

## Rate Cards

- Master Price List with all chargeable items
- Rate card items auto-match to assets and jobs
- EWR rate cards for Early Warning Report projects
- Keyword mapping for auto-matching

## Dispute Management

When a client disputes a line item:
1. Mark the item as **Disputed** with a note
2. Make a **Counter-offer** with an adjusted amount
3. Track the back-and-forth in the dispute history
4. Mark as **Agreed** or **Rejected** when resolved`,
  },
  {
    title: 'Reports Hub',
    category: 'general',
    summary: 'Standard reports, custom report builder, Power BI, and scheduled reports.',
    order: 9,
    tags: 'reports, custom, power bi, scheduled, export, pdf',
    content: `# Reports Hub

The Reports Hub provides standard operational reports, a custom report builder, and Power BI integration.

## Standard Reports

- **Crew Performance** — Meterage, on-time arrival, safety checks per driller
- **Rig Performance** — Meterage, revenue, and utilisation per rig
- **Availability Report** — Crew availability heatmap by week/month/year
- **Compliance Checks** — Expiring certificates, overdue audits
- **Remaining Work** — Projected remaining work by job
- **Supplier Spend** — Spend by supplier over time

## Custom Report Builder

Build your own reports:
1. Choose a data source (jobs, staff, assets, billing, etc.)
2. Select fields to display
3. Add filters (date range, division, status)
4. Choose a chart type (table, bar, line, pie)
5. Save as a template for reuse
6. Schedule for automatic email delivery

## Report Scheduling

Any saved report can be scheduled:
- Daily, weekly, or monthly delivery
- Email to specific recipients
- PDF or Excel format
- Auto-generated and sent automatically

## Power BI Integration

- Push data to Power BI datasets
- Refresh on a schedule
- View embedded Power BI dashboards
- Datasets include jobs, financials, compliance, and operations

## Exporting

All reports can be exported as:
- PDF (print-ready)
- Excel (spreadsheet)
- CSV (raw data)
- Direct email to recipients`,
  },
  {
    title: 'Settings Overview',
    category: 'general',
    summary: 'Configuration hub — integrations, branding, automations, dropdowns, and system rules.',
    order: 10,
    tags: 'settings, configuration, integrations, branding, automations, dropdowns',
    content: `# Settings Overview

The Settings hub is your configuration centre for all system-wide and division-specific settings.

## Command Hub

The Settings landing page shows a grid of all settings areas with live counts. Click any tile to jump to that settings page.

## Key Areas

### Integrations
Connect external services for your division:
- Geotab (GPS tracking)
- Holman (fleet management)
- Asset Panda (asset inventory)
- Bob HR (time-off sync)
- SAP Concur (expenses)
- Mitti/SafetyCulture (audits)
- HMRC CIS (subcontractor verification)
- Xero/Sage (accounting)
- Stripe (payments)

### Branding
- Global email branding (colours, banner, footer)
- Login page customiser (background, logo, welcome text)
- Client portal editor (appearance, widgets, sections)

### System Configuration
- **Approval Routing** — Who receives each approval type
- **Request Routing** — Route staff requests to the right people
- **Dropdown Manager** — Edit all dropdown options
- **Business Rules** — Working hours, travel deductions, break durations
- **Overtime Rates** — Configure overtime calculation rules
- **Email Builder** — Design branded email templates
- **Report Builder** — Design report templates

### Automations
View and manage all background automations — billing, compliance, scheduling, and logistics autopilots.

### Permissions
- **Access Levels** — Permission groups with per-module read/write
- **Compliance Check Config** — Which Mitti checks each division requires

## Per-Division Settings

Most integration settings are per-division — each business stream connects its own accounts. Switch divisions using the division switcher in the sidebar.`,
  },
  {
    title: 'AFP Builder — Detailed Guide',
    category: 'financial',
    summary: 'Step-by-step guide to building, populating, and submitting an AFP.',
    order: 11,
    tags: 'afp, application for payment, builder, populate, submit, measured works, variations',
    content: `# AFP Builder — Detailed Guide

The AFP (Application for Payment) is the formal document sent to the client each billing period.

## Creating an AFP

1. Open the job **Financials** tab
2. Click **Create AFP** (or the system auto-creates the first AFP)
3. Set the period end date (the submission deadline)
4. The system auto-calculates the certification due date (+5 days) and final payment notice date (+30 days)

## Populating from Field Data

Click **Refresh from Field Data** to auto-populate line items:
- **Driller logs** — Meterage from InvestigationLog records
- **Timesheets** — Approved timesheets become labour lines
- **Deliveries** — Equipment hire from DeliveryLog records
- **Subcontractor logs** — Subcontractor work from SubcontractorLog records
- **Daily costs** — Materials and other costs
- **Job cost items** — Equipment and labour added to the job

Each source record becomes a line item with a source field tracking its origin. Re-running the population is safe — existing items are updated, not duplicated.

## Manual Line Items

Add manual line items for anything not auto-populated:
1. Click **Add Line Item**
2. Choose the sheet (Measured Works, Variations, Materials, etc.)
3. Enter item description, unit, qty, and rate
4. The rate card matcher suggests a matching rate

## AFP Sheets

### Lump Sum Format
- **Measured Works** — Main line items with contracted qty, qty complete, gross applied, previous applied, applied this period
- **Variation Summary** — Variation orders with VO ref, date, time impact
- **Materials on Site** — Materials delivered to site
- **Compensation Items** — CI01-03 compensation sheets

### EWR Format (Early Warning Report)
- **Rotary/CP Drilling** — Per-borehole meterage
- **Rotary/CP Dayworks** — Time-based standing time entries
- **Enabling Crew** — Enabling works crew
- **Accommodation** — Accommodation costs
- **Misc / Hires / Mileage** — Other charges

## Submitting an AFP

1. Click **Submit for Review** — sends to a manager for approval
2. Manager reviews and clicks **Submit to Client** — generates a client-facing PDF
3. The client reviews and responds with their assessment
4. Enter the client assessed quantities in the **Client Assessment** columns
5. Disputed items are tracked through the dispute workflow

## AFP Chain

When an AFP is submitted, the system auto-creates the **next AFP** in the chain with:
- Period start = previous AFP period end + 1 day
- Blank line items ready for the next period data`,
  },
  {
    title: 'CVR Management',
    category: 'financial',
    summary: 'Cost Value Reconciliation — tracking project financial position and profitability.',
    order: 12,
    tags: 'cvr, cost value reconciliation, margin, profitability, financial position',
    content: `# CVR Management

The CVR (Cost Value Reconciliation) tracks the financial position of each project — revenue claimed, costs incurred, and margin.

## What the CVR Shows

- **Contract Value** — The total agreed contract amount
- **Claimed to Date** — Total claimed across all AFPs
- **Assessed to Date** — Total the client has agreed to pay
- **Invoiced to Date** — Total formally invoiced
- **Paid to Date** — Total received from the client
- **Costs Incurred** — Labour, equipment, materials, and subcontractor costs
- **Margin** — Revenue minus costs, as a percentage and absolute value

## CVR Line Items

CVR line items are pushed from approved AFPs. Each AFP line item becomes a CVR line item tracking:
- Original contracted amount
- Variations applied
- Claimed vs assessed
- Invoiced vs paid

## Uploading a CVR

You can upload a CVR Excel file to populate line items:
1. Click **Upload CVR** in the job Financials tab
2. Select the Excel file
3. The parser extracts line items and creates CVRLineItem records
4. Review and commit the parsed data

## Exporting

- Export the CVR to Excel for external reporting
- Export the full CVR pack (PDF + Excel + supporting documents)
- Push to Xero/Sage accounting

## Cash Flow Forecast

The CVR feeds the cash flow forecast, which projects:
- Expected revenue from outstanding AFPs
- Expected costs from active jobs
- Net cash position over time

## Margin Guard

The system monitors margins on each job and alerts when:
- Margin falls below a configured threshold
- Subcontractor costs exceed the agreed rate
- Unbilled work is accumulating without an AFP`,
  },
  {
    title: 'Invoicing',
    category: 'financial',
    summary: 'Generating, sending, tracking, and chasing invoices.',
    order: 13,
    tags: 'invoicing, invoices, generate, send, chase, overdue, xero, sage',
    content: `# Invoicing

The invoicing system converts approved AFPs into formal invoices and tracks them through to payment.

## Generating Invoices

1. Open an approved AFP
2. Click **Generate Invoice** — creates an Invoice record from the AFP agreed total
3. The invoice inherits the job client, VAT rate, and billing details
4. Review the invoice and click **Send**

## Invoice Lifecycle

- **Draft** — Created but not sent
- **Sent** — Emailed to the client
- **Paid** — Payment received and recorded
- **Overdue** — Past the payment terms (auto-flagged)
- **Disputed** — Client has queried the invoice

## Auto-Invoicing

The system can auto-generate invoices when:
- An AFP is approved (auto-invoice on approval)
- A milestone is completed (milestone-triggered invoicing)
- Monthly billing cycle (daily auto-invoice engine checks for due items)

## Chasing Overdue Invoices

- The system runs a daily check for overdue invoices
- Overdue invoices appear in the inbox as alerts
- The **Invoice Chase** function sends a branded reminder email
- Escalation rules can be configured (e.g. 7 days reminder, 30 days final notice)

## Accounting Export

Push invoices to your accounting system:
- **Xero** — Push invoices and purchase costs
- **Sage** — Push invoices and purchase costs
- **CSV Export** — Raw data for any accounting system

## Client Portal Payments

If Stripe is connected, clients can pay invoices directly from the client portal using a card payment.`,
  },
  {
    title: 'Rate Cards and Master Price List',
    category: 'financial',
    summary: 'Managing the Master Price List, EWR rate cards, and keyword mapping.',
    order: 14,
    tags: 'rate card, master price list, ewr, keyword mapping, pricing',
    content: `# Rate Cards and Master Price List

The Master Price List (Rate Card) is the central catalogue of all chargeable items and their prices.

## Rate Card Items

Each RateCardItem stores:
- **Item name** and description
- **Unit** (day, m, hour, nr, sum, etc.)
- **Cost price** (internal cost)
- **Charge-out price** (client price)
- **Category** (drilling, plant hire, labour, subcontractor, materials, etc.)
- **Keywords** for auto-matching

## Auto-Matching

The system auto-matches rate card items to:
- **Assets** — Equipment from Asset Panda matches by name (fuzzy match)
- **AFP line items** — Driller logs and costs match by keyword
- **Job cost items** — Added equipment matches by name

When a match is confirmed, the rate card price takes precedence over any other price source.

## EWR Rate Cards

For Early Warning Report projects, upload EWR-specific rate cards:
- Rotary drilling rates (per metre)
- CP drilling rates (per metre)
- Dayworks/standing time rates (per hour)
- Enabling crew rates (per day)
- Accommodation rates

Upload via Excel — the parser extracts rates and creates RateCardItem records.

## Keyword Mapping

Configure keyword mappings to auto-categorise and price items:
- Map keywords like "mobilise" or "demobilise" to specific rate card items
- Map keywords like "coreliner" or "bentonite" to materials categories
- The matcher uses these when auto-populating AFPs from field data

## Pricing Review

When the system cannot auto-match a price, it flags the item for **Pricing Review**:
- Items appear in the inbox for a manager to set the price
- Once priced, the item is stamped and the AFP is updated

## Margin Guard

The system checks each billed item margin (charge-out price vs cost price) and alerts when:
- Margin is below the configured threshold
- A subcontractor cost exceeds the agreed rate`,
  },
  {
    title: 'Dispute Management',
    category: 'financial',
    summary: 'Handling client disputes on AFP line items — counter-offers, negotiation, and resolution.',
    order: 15,
    tags: 'dispute, counter-offer, negotiation, client, afp, agreement',
    content: `# Dispute Management

When a client disagrees with a line item on an AFP, the dispute workflow tracks the negotiation to resolution.

## Dispute Lifecycle

1. **Disputed** — Client pushes back on a line item. Mark it with a note explaining the client position.
2. **Counter-offered** — You make a counter-offer with an adjusted amount and note.
3. **Agreed** — Both parties agree on the final amount. The agreed amount rolls into the AFP agreed total.
4. **Rejected** — Client rejects and you accept the rejection. The item is removed from the agreed total.

## How to Dispute an Item

1. Open the submitted AFP
2. Find the line item the client is disputing
3. Click **Dispute** and enter the client reason
4. The item dispute status changes to disputed
5. The AFP dispute_status changes to active

## Making a Counter-Offer

1. On a disputed item, click **Counter-offer**
2. Enter your proposed amount and a note explaining your position
3. The status changes to counter_offered
4. Wait for the client response

## Tracking the Negotiation

Each dispute action is recorded in the item **dispute history**:
- Timestamp, user, action (disputed, counter-offered, agreed, rejected)
- Note attached to each action
- Amount at the time of each action

## AFP Dispute Roll-Up

The AFP header shows:
- **Original Total** — The total before any disputes
- **Disputed Total** — Value of items currently in dispute
- **Agreed Total** — Final agreed amount after all disputes resolved
- **Dispute Status** — none, active, or resolved

## Resolving Disputes

When all line items are either **agreed** or **rejected**, the AFP dispute status changes to **resolved** and the agreed total is final. This total is then pushed to the CVR.`,
  },
  {
    title: 'Payroll Export',
    category: 'financial',
    summary: 'Exporting approved timesheets to Sage, Xero, or CSV for payroll processing.',
    order: 16,
    tags: 'payroll, export, sage, xero, csv, timesheets',
    content: `# Payroll Export

The Payroll Export system converts approved weekly timesheets into payroll-ready data for your accounting system.

## Payroll Autopilot

The system runs a daily and weekly payroll autopilot:
1. **Daily Merge** — Merges individual shift timesheets into weekly summaries
2. **Weekly Merge** — Finalises the week timesheets ready for export
3. **Export** — Generates the payroll file for Sage/Xero/CSV

## Exporting Payroll

1. Go to **Settings, Payroll Export**
2. Select the week ending date
3. Choose the export format (Sage, Xero, or CSV)
4. Review the summary — total hours, overtime, deductions
5. Click **Export** to download the file

## What is Included

- **Regular hours** — Standard working hours at the staff member day rate
- **Overtime** — Hours above the standard, calculated per the overtime rules
- **Shift differentials** — Night shift, weekend, and holiday premiums
- **CIS deductions** — 30% (net payer) or 0% (gross payer) based on HMRC verification
- **Holiday pay accrual** — Accrued holiday pay per the configured rate

## Timesheet Approval

Before payroll can be exported, timesheets must be approved:
1. Crew submit daily timesheets from their phone
2. The system auto-builds weekly timesheets from daily entries
3. Managers review and approve weekly timesheets
4. Green-path auto-approval applies to timesheets that meet all criteria (full hours, GPS verified, no gaps)

## Overtime Rules

Configure overtime in **Settings, Overtime Rates**:
- Daily overtime threshold (e.g. after 8 hours)
- Weekly overtime threshold (e.g. after 40 hours)
- Multipliers for weekday, weekend, and holiday overtime
- Shift differential rates

## CIS Deductions

For subcontractors, the system applies CIS deductions based on the HMRC verification:
- **Net payer** — 30% deduction
- **Gross payer** — 0% deduction
- **Higher rate gross** — 20% deduction

Run CIS verification in **Settings, HMRC CIS** before exporting payroll.`,
  },
  {
    title: 'Geotab GPS Integration',
    category: 'logistics',
    summary: 'Connecting Geotab for live vehicle tracking, trip data, and driver safety scores.',
    order: 17,
    tags: 'geotab, gps, tracking, vehicles, trips, driver safety, geofence',
    content: `# Geotab GPS Integration

Geotab provides live GPS tracking for all fleet vehicles — locations, trips, and driver safety scores.

## Setup

1. Go to **Settings, Geotab GPS**
2. Enter your Geotab credentials (username, password, database name)
3. Click **Test Connection** to verify
4. Click **Sync Now** to pull all vehicle data

## What Syncs

- **Live vehicle locations** — Updated every few minutes
- **Trip data** — Start/end times, distance, duration for each trip
- **Driver safety scores** — Speeding, harsh braking, cornering
- **Mileage** — Total odometer reading per vehicle
- **Engine diagnostics** — Fault codes and DTCs (if supported)

## Geofencing

The system uses Geotab GPS data for geofencing:
- **Job site geofences** — Auto-detects when a vehicle arrives at/departs from a job site
- **Client yard geofences** — Detects collection/delivery at client yards
- **Home geofences** — Detects when crew arrive home (for travel time calculation)

Geofence events feed into:
- **Timesheets** — Auto-fill arrival and departure times
- **Delivery tracking** — Confirm equipment arrivals
- **Travel time** — Calculate payable travel from site to home

## Auto-Timesheet Generation

The nightly Geotab timesheet auto-generation:
1. Checks each crew member GPS data for the day
2. Detects geofence events (arrived at site, left site, arrived home)
3. Auto-builds a timesheet with travel time, on-site time, and travel-home time
4. Submits for manager approval

## Driver Safety

- Safety events (speeding, harsh braking) are logged per trip
- The **Driver Safety Alert** workflow checks for concerning patterns
- Safety scores appear on each vehicle detail page

## Trip History and Route Playback

- View any vehicle trip history by date
- Play back the route on the map with a scrubber timeline
- Compare planned vs actual routes`,
  },
  {
    title: 'Asset Panda Integration',
    category: 'logistics',
    summary: 'Syncing asset inventory, stock levels, and warehouse locations from Asset Panda.',
    order: 18,
    tags: 'asset panda, sync, inventory, stock, warehouse, barcode, qr',
    content: `# Asset Panda Integration

Asset Panda is the source of truth for asset inventory — stock levels, warehouse locations, and asset conditions.

## Setup

1. Go to **Settings, Asset Panda**
2. Enter your API credentials
3. Select which Asset Panda groups to sync (Rigs, Lifting Gear, Plant, etc.)
4. Map Asset Panda fields to system fields
5. Click **Sync Now** to pull all assets

## What Syncs

- **Asset details** — Name, make, model, serial number, fleet number
- **Stock levels** — Quantity owned vs quantity available
- **Warehouse locations** — Where the asset is stored
- **Conditions** — Good, fair, poor, needs repair
- **Compliance dates** — Last inspection, next inspection, expiry
- **Images** — Asset photos (cached on demand)
- **Barcode** — Asset Panda barcode value for scanner matching

## Bidirectional Sync

The sync is bidirectional:
- **Pull** — Asset Panda to System (details, stock, compliance)
- **Push** — System to Asset Panda (quantity available updates on book-out/book-in)

## QR Code Generation

For assets without an Asset Panda barcode, the system generates a QR code (e.g. GC-uuid). Print QR labels and use the scanner to:
- Book equipment out to jobs
- Book equipment back into the yard
- Check compliance status on site

## Rate Card Linking

Assets are auto-linked to RateCardItem records by fuzzy name match:
- **Confirmed** — Auto-confirmed link, rate card price takes precedence
- **Skipped** — Admin chose to use the Asset Panda cost price instead
- **Unmatched** — No rate card match found

## Field Mapping

The field mapper lets you map Asset Panda custom fields to system fields. Each Asset Panda group can have different field labels, so the mapper adapts per group.

## Webhook

Asset Panda can send webhooks when assets are updated. Configure the webhook URL in your Asset Panda settings to trigger real-time updates.`,
  },
  {
    title: 'Mitti (SafetyCulture) Audits',
    category: 'compliance',
    summary: 'Syncing safety audits, inspection forms, and action items from Mitti/SafetyCulture.',
    order: 19,
    tags: 'mitti, safetyculture, audits, inspections, safety, action items, webhook',
    content: `# Mitti (SafetyCulture) Audits

Mitti (formerly SafetyCulture/iAuditor) is the source of all safety audits and inspection forms.

## Setup

1. Go to **Settings, Mitti**
2. Enter your Mitti API token
3. Set the webhook secret (add the same secret in your Mitti webhook config)
4. Enable the webhook receiver
5. Click **Sync Now** to pull historical audits

## Webhook vs Pull Sync

- **Webhook** — Mitti sends audit data in real-time when an audit is submitted. This is the primary method.
- **Pull Sync** — The system fetches audits from the Mitti API on a schedule (incremental sync using modified_after cursor). Use this as a fallback or for initial backfill.

## Audit Classification

Incoming audits are auto-classified by template name:
- **Vehicle Check** — Daily vehicle walk-round (gates the pre-departure Checks step)
- **POWRA** — Point of Work Risk Assessment (gates the start-work step on arrival)
- **Equipment** — Plant/equipment check
- **General** — Any other audit

## Action Item Routing

When an audit contains failed items or action items, the system:
1. Classifies each action item (repair, fault, safety, general)
2. Looks up the Mitti Action Routing config
3. Creates an InboxItem for each matching recipient
4. Routes to specific staff or by job-title keywords (e.g. fitter, mechanic)

## Audit Dashboard

- Grid of all audit templates with pass/fail rates
- Filter by template, date range, or auditor
- Click any audit to see the full detail — scores, failed items, action items
- Export audit reports as PDF

## Template Management

- **Pinned templates** — Always shown in the grid (even with zero audits)
- **Hidden templates** — Never shown (hide sample/unused templates)
- **GC reference codes** — Filter the grid to only templates matching your codes (e.g. GC03EXT29)

## Shift Wizard Integration

Mitti forms appear as big tappable buttons in the crew Shift Wizard:
- **Checks step** — Daily vehicle check
- **Arrive step** — POWRA
- **Briefing step** — Equipment check, permit to dig

When Mitti is connected, the step gates until the matching audit webhook is received — so you know the crew completed the form before they proceed.`,
  },
  {
    title: 'Bob HR (Hibob) Integration',
    category: 'general',
    summary: 'Bidirectional time-off sync with Bob HR for absence management.',
    order: 20,
    tags: 'bob hr, hibob, absence, time off, sync, holiday',
    content: `# Bob HR (Hibob) Integration

Bob HR (Hibob) is the HR system. The integration syncs time-off (absence) data bidirectionally.

## Setup

1. Go to **Settings, Bob HR (Hibob)**
2. Enter your Bob HR API token
3. Configure the absence type mapping (map Bob HR time-off types to system absence reasons)
4. Enable the sync

## Bidirectional Sync

- **Pull** — Bob HR to System: Absences approved in Bob HR appear in the system
- **Push** — System to Bob HR: Absence requests approved in the system are pushed to Bob HR

## How It Works

### Pull (Bob HR to System)
The sync runs on a schedule and pulls all time-off requests from Bob HR:
- Matches each Bob HR request to a staff member by email
- Creates an Absence record with source=bob_hr
- Updates existing records if the Bob HR request changes

### Push (System to Bob HR)
When a manager approves an absence in the system:
- The **Real-time Absence Push to Bob HR** workflow fires
- Pushes the approved absence to Bob HR
- Stores the Bob HR request ID on the absence record for reconciliation

## Absence Management

- View all absences in the Staff Hub, Absences tab
- Filter by status (pending, approved, rejected), reason, and date range
- Approve or reject absence requests from the inbox
- Approved absences block the rota (staff cannot be assigned on those dates)

## Holiday Accrual

The system calculates holiday pay accruals per staff member:
- Accrual rate based on days worked
- Days taken vs days remaining
- Run the accrual calculation from Settings, Holiday Accrual Manager`,
  },
  {
    title: 'SAP Concur Integration',
    category: 'financial',
    summary: 'Pushing approved expenses and timesheets to SAP Concur, pulling GL codes.',
    order: 21,
    tags: 'concur, sap, expenses, gl codes, timesheets, export',
    content: `# SAP Concur Integration

SAP Concur is the expense management system. The integration pushes approved expenses and timesheets to Concur and pulls GL codes.

## Setup

1. Go to **Settings, SAP Concur**
2. Enter your Concur API credentials (client ID, client secret, refresh token)
3. Configure the GL code mapping
4. Enable the sync

## What Pushes to Concur

- **Approved expenses** — Staff expense claims are pushed to Concur for reimbursement
- **Approved timesheets** — Weekly timesheets are pushed as time entries

## GL Code Mapping

Map system cost categories to Concur GL codes:
- Labour to GL code for labour costs
- Equipment hire to GL code for plant hire
- Materials to GL code for materials
- Subcontractor to GL code for subcontractor costs
- Travel to GL code for travel expenses

The mapping is stored as an AppSetting and used when pushing data to Concur.

## Reconciliation

The **Concur Reverse Sync Weekly Reconcile** workflow:
1. Pulls approved expense reports from Concur
2. Matches them to system expense records
3. Flags any discrepancies (amount, category, or missing records)
4. Creates inbox alerts for discrepancies

## Expense Defaults

Configure expense defaults in **Settings, Expense Defaults**:
- Default amounts per category (e.g. 10 GBP lunch, 0.45 GBP/mile)
- Default VAT rates per category
- These pre-fill expense entries so crews only adjust when their spend differs`,
  },
  {
    title: 'HMRC CIS Verification',
    category: 'compliance',
    summary: 'Verifying subcontractors against the HMRC Construction Industry Scheme register.',
    order: 22,
    tags: 'cis, hmrc, verification, subcontractor, tax, gross, net',
    content: `# HMRC CIS Verification

The Construction Industry Scheme (CIS) requires verification of subcontractors before payment. The system verifies subcontractors against the HMRC CIS register.

## Setup

1. Go to **Settings, HMRC CIS**
2. Enter your HMRC credentials (or use the shared credentials)
3. Configure the verification frequency (monthly re-verification recommended)

## Verifying a Subcontractor

1. Open the subcontractor record in the Staff Hub, Contacts tab
2. Ensure the UTR (Unique Taxpayer Reference) and/or NINO is set
3. Click **Verify CIS**
4. The system calls the HMRC CIS verification API
5. The result is stored on the contractor record

## Verification Results

- **Verified Net** — 30% deduction applies. The subcontractor is a net payer.
- **Verified Gross** — 0% deduction. The subcontractor is a gross payer.
- **Unknown** — Subcontractor not found in HMRC records. Cannot verify.
- **Failed** — Verification error (wrong UTR, HMRC service down, etc.).
- **Pending** — Not yet verified.

## CIS Tax Rate

The CIS tax rate is stored on the contractor record and used in:
- Payroll export (CIS deduction applied to subcontractor payments)
- AFP line items (subcontractor costs show the CIS rate)
- Invoice generation (CIS deduction shown on the invoice)

## Monthly Re-Verification

The **Monthly CIS Re-Verification** workflow runs automatically:
1. Finds all approved subcontractors
2. Re-verifies each against HMRC
3. Updates the CIS status and tax rate
4. Alerts if a subcontractor status changed (e.g. gross to net)

## Bulk Verification

Use the **CIS Batch Verify** widget in the Billing Hub to verify multiple subcontractors at once:
1. Select the subcontractors to verify
2. Click **Batch Verify**
3. The system processes each in sequence
4. Results are displayed in a summary table`,
  },
  {
    title: 'Inbox and Approvals',
    category: 'app_usage',
    summary: 'Using the universal inbox — approvals, alerts, notifications, delegation, and SLA tracking.',
    order: 23,
    tags: 'inbox, approvals, alerts, notifications, delegation, sla, routing',
    content: `# Inbox and Approvals

The universal inbox is your central place for all items that need your attention — approvals, alerts, and notifications.

## Accessing the Inbox

Click the **Inbox** icon in the sidebar (or go to /inbox). The inbox badge shows the count of pending items.

## Item Types

### Approvals (need a yes/no decision)
- **AFP Review** — AFP submitted for manager review
- **AFP Dispute** — Client disputed a line item
- **Timesheet** — Weekly timesheet needs approval
- **Access Request** — New user waiting for access approval
- **Early Leave** — Crew member requested to leave site early
- **Delay Log** — Delay log needs approval
- **Absence** — Time-off request needs approval
- **Pricing Review** — Item needs a price set
- **Off-Hire** — Equipment off-hire needs approval
- **Compliance Doc** — Compliance document needs review

### Alerts (actionable warnings)
Compliance expiring, invoice overdue, failed audit, margin breach, etc.

### Notices (info-only)
Schedule published, new job created, crew message, weather warning, etc.

## Acting on an Item

1. Click an item to expand it
2. For approvals: add an optional note, then click **Approve** or **Reject**
3. For alerts: click **Dismiss** to clear, or **Open** to view the detail
4. For notices: click **Open** to view the detail

## Approval Routing

Configure who receives each approval type in **Settings, Approval Routing**:
- **Manager Chain** — Routes to the requester line manager
- **Specific Staff** — Routes to designated staff members
- **Role-based** — Routes to anyone with a specific role
- Set SLA timers (e.g. 48 hours) — overdue items are escalated
- Multiple sign-offs can be required for high-value items

## Delegation

Going on holiday? Delegate your approvals:
1. Open the inbox and click **Delegate**
2. Choose a colleague to handle your approvals while you are away
3. Set a delegation expiry date
4. All your pending items are reassigned to the delegate

## SLA Tracking

Each approval has an SLA (Service Level Agreement) timer:
- **Green** — Within SLA
- **Amber** — Approaching SLA deadline
- **Red** — Overdue (escalated to fallback approver)

The **Inbox SLA Escalation Check** workflow runs daily and escalates overdue items.

## Access Requests

When a new user signs in via Microsoft SSO for the first time:
1. Their access_status is set to pending
2. An inbox approval is sent to all designated approvers (staff with is_approver=true)
3. Approvers see the user name, email, and first-login time
4. Approve or reject from the inbox — the user is notified by email`,
  },
  {
    title: 'Permissions and Access Levels',
    category: 'general',
    summary: 'Permission groups, module-level access, field-level security, and role management.',
    order: 24,
    tags: 'permissions, access, roles, permission groups, security, rls, modules',
    content: `# Permissions and Access Levels

Access control is managed through **Permission Groups** — each group defines read/write access per module.

## Permission Groups

Each staff member is assigned a permission group (Staff.permission_group_id). The group controls:
- Which admin modules they can see (read access)
- Which modules they can edit (write access)
- Which settings pages they can access

### Standard Groups
- **Super Admin** — Full access to everything including settings
- **Management** — Most hubs except settings
- **Users** — Standard office access (jobs, calendar, compliance, staff)
- **Field Team** — Field app only (schedule, profile, scanner, inbox)
- **Read Only** — View-only access to all office modules
- **Scanner Only** — Scanner app only (book goods in/out)

### Custom Groups
Create custom permission groups in **Settings, Access Levels**:
1. Click **Add Group**
2. Name the group and set read/write per module
3. Assign staff to the group from their staff card

## Module-Level Access

Each module (jobs, scheduling, staff, assets, fleet, compliance, billing, reports, settings) has:
- **Read** — Can view the module data
- **Write** — Can create, edit, and delete records
- **None** — Cannot access the module at all

## Field-Level Security

- **Costs/Financials** — Hidden from field staff, drivers, and subcontractors
- **Staff sensitive fields** — Date of birth, NI number — admin only
- **Settings** — Most settings are admin-only

## Row-Level Security (RLS)

Data is isolated by division:
- Staff in Land and Water can only see Land and Water jobs, assets, and staff
- Enterprise admins can see multiple divisions (managed_division_ids)
- Admins (super_admin) bypass RLS entirely

## Access Approver

Designate staff as **Access Approvers** by toggling the flag on their staff card (super admins only). Approvers receive:
- An inbox item in the Universal Inbox (/inbox) when a new user signs in — approve or reject directly from the inbox
- Their name/email shown to the pending user on the waiting screen

Access requests are no longer managed from a standalone settings page — the Universal Inbox is the single approval surface for every request type.

## Syncing Roles

The system syncs the Staff record permission group to the platform user role:
- Super Admin to platform admin
- Field Team to platform user (field access only)
- This ensures permission parity between the Staff Manager and system access`,
  },
  {
    title: 'Client Portal',
    category: 'general',
    summary: 'Configuring and using the client portal — project visibility, documents, and feedback.',
    order: 25,
    tags: 'client portal, portal, client, documents, feedback, progress, visibility',
    content: `# Client Portal

The client portal gives your clients secure, read-only access to their project information — progress, schedule, documents, and milestones.

## Enabling the Portal

1. Open the job **Links** tab
2. Toggle **Enable Client Portal**
3. Choose which sections are visible (progress, schedule, notes, photos, milestones, documents, comments, team)
4. Click **Send Portal Invite** to email the client a secure login link

## What Clients See

### Progress
- Project status and percentage complete
- Drilling meterage vs target
- Timeline of key milestones

### Schedule
- The published rota (which crew, which days)
- Upcoming site visits

### Documents
- RAMS, site maps, scope of work (client-visible documents only)
- Download and review documents
- Approve/acknowledge documents (e.g. RAMS sign-off)

### Photos
- Site photos uploaded by the crew
- Time-lapse view of site progress

### Milestones
- Project milestones and their completion status
- Expected vs actual completion dates

### Comments
- Client can leave comments/feedback on the project
- Comments are visible to the project team

## Portal Access

Clients access the portal via:
- A secure link with a unique token (no login required)
- OR a secure login (email + password) if the portal user has been invited

## Portal Branding

Customise the portal appearance in **Settings, Portal Editor**:
- Logo and colours
- Which widgets appear
- Site sign-in configuration
- Daily log visibility
- KeyLogBook integration

## Portal Feedback

Client feedback on the portal:
- Star ratings and comments
- Auto-synced to the job status
- Visible in the Client Feedback dashboard widget

## Portal Sign-In

If enabled, clients can sign in on site using the portal:
- Captures the client representative name and time
- Records their GPS location
- Shows in the job site activity log`,
  },
];

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });

    const sr = base44.asServiceRole;

    // Fetch existing office help topics to avoid duplicates
    const existing = await sr.entities.HelpTopic.list('-created_date', 500);
    const existingTitles = new Set(existing.map((t: any) => t.title));

    const toCreate = TOPICS.filter((t) => !existingTitles.has(t.title));

    if (toCreate.length === 0) {
      return Response.json({
        success: true,
        message: 'All office help topics already exist',
        created: 0,
        skipped: TOPICS.length,
      });
    }

    const records = toCreate.map((t) => ({
      title: t.title,
      category: t.category,
      audience: 'office',
      summary: t.summary,
      content: t.content,
      order: t.order,
      tags: t.tags,
      is_active: true,
    }));

    const created = await sr.entities.HelpTopic.bulkCreate(records);

    return Response.json({
      success: true,
      message: 'Seeded ' + created.length + ' office help topics',
      created: created.length,
      skipped: TOPICS.length - toCreate.length,
    });
  } catch (error: any) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : String(error);
    return Response.json({ error: msg }, { status: 500 });
  }
}