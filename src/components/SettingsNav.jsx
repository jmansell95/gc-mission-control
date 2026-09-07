import React from 'react';
import { Search, Users, Truck, Building2, HardHat, Package, CalendarX, Timer, Mail, Zap, Wrench, Tag, Banknote, Boxes,   Palette, Database, Receipt, TrendingUp, TrendingDown, LayoutGrid, ListChecks,   ShieldCheck, KeyRound, FlaskConical, Clock, FileUp, ClipboardCheck, ShieldAlert, Scale, Sparkles, Gauge, BookOpen, Settings2, Landmark, FileSpreadsheet, ScrollText, History, Radio, ArrowUpDown, Satellite, QrCode, Link2, Cloud, MapPin, MessageCircle, CreditCard, GitBranch, FileText, FileBarChart, Star, CalendarDays, UserCheck, Warehouse, AlertOctagon, Coins, Bell, Webhook, Layers, Activity, Gift, Bot, Smartphone } from 'lucide-react';
import { normalizePermissions } from '@/utils/permissions';

// Items that have migrated to operational hubs (Financial Control, Compliance,
// Assets, Staff). They remain in allSettingsItems for access-control/lockdown
// purposes but are hidden from the Settings sidebar & Command Hub overview.
export const HUB_MIGRATED_ITEMS = new Set([
  // → Financial Control Hub
  'billing', 'data-exchange', 'overtime', 'business-rules',
  'expense-presets', 'subcon-markup', 'gl-mapping', 'billing-pipeline',
  'billing-contracts', 'purchase-orders', 'financial-audit', 'job-alerts',
  'payroll-export', 'custom-reports', 'client-progress-report', 'rate-card',
  // → Compliance Hub
  'compliance-rules', 'system-audit-log',
  // → Assets Hub
  'asset-manifests', 'equipment-library', 'asset-lifecycle', 'depreciation-profiles',
  // → Staff Hub
  'absences', 'holiday-accrual', 'staff-reviews',
  'timesheet-delegation',
]);

export const settingsGroups = [
  {
    label: 'Overview',
    items: [
      { id: 'hub', label: 'Command Hub', icon: LayoutGrid, desc: 'At-a-glance overview of every settings area with live counts' },
    ],
  },
  // Enterprise-level items (Divisions, Integrations, Readiness, Backup & Restore) have
  // been moved to Enterprise Settings (/enterprise/settings). They are no longer shown
  // in the division-level settings sidebar to avoid split-brain configuration.

  {
    label: 'Autopilot',
    items: [
      { id: 'autopilot', label: 'Autopilot Control', icon: Bot, desc: 'Autonomous agents that decide and act — billing, scheduling, compliance, logistics & financial. Pause, configure aggressiveness, and review every decision in the audit trail.', roles: ['admin'] },
    ],
  },
  {
    label: 'Ground Investigation',
    items: [
      { id: 'ags-import', label: 'KeyLogBook', icon: FileUp, desc: 'Dedicated KeyLogBook integration page — AGS webhook config, auto-sync, and manual upload for this business stream' },
      { id: 'openground-sync', label: 'OpenGround', icon: Database, desc: 'Dedicated OpenGround integration page — push approved borehole logs from this stream to Bentley OpenGround cloud database' },
    ],
  },
  {
    label: 'Integrations',
    items: [
      { id: 'geotab-sync', label: 'Geotab GPS', icon: Satellite, desc: 'Live vehicle locations + specs via Geotab API — connect this stream\'s own Geotab account' },
      { id: 'phone-gps', label: 'Phone GPS Tracking', icon: Smartphone, desc: 'FREE background GPS tracking for field crew via GPSLogger / OwnTracks — no Capacitor build needed. Tracks even with app closed', external: '/background-tracking-setup', roles: ['admin'] },
      { id: 'holman-sync', label: 'Holman Fleet', icon: Radio, desc: 'MOT, service dates & mileage from Holman fleet management — this stream\'s account' },
      { id: 'asset-panda', label: 'Asset Panda', icon: Database, desc: 'Live stock levels, warehouse locations & asset matching for this stream' },
      { id: 'bob-hr', label: 'Bob HR (Hibob)', icon: Users, desc: 'Bidirectional time-off sync with Bob HR for this stream\'s staff' },
      { id: 'concur-sync', label: 'SAP Concur', icon: Landmark, desc: 'Push approved expenses & timesheets, pull GL codes — this stream\'s Concur' },
      { id: 'safety-culture', label: 'Mitti', icon: ShieldAlert, desc: 'Sync site safety audits & inspection forms from Mitti for this stream' },
      { id: 'cis-verification', label: 'HMRC CIS', icon: ShieldCheck, desc: 'Verify this stream\'s subcontractors against the HMRC CIS register' },
      { id: 'payroll-export', label: 'Payroll Export', icon: FileSpreadsheet, desc: 'Export this stream\'s approved weekly timesheets to Sage / Xero / CSV' },
      { id: 'met-office', label: 'Open-Meteo Weather', icon: Cloud, desc: 'Free daily weather forecasts for this stream\'s active sites' },
      { id: 'google-maps', label: 'Google Maps', icon: MapPin, desc: 'Geocoding for job sites + travel route optimisation — this stream\'s API key' },
      { id: 'whatsapp', label: 'WhatsApp Business', icon: MessageCircle, desc: 'Push critical alerts to this stream\'s crew via WhatsApp Business API' },
      { id: 'accounting-sync', label: 'Xero / Sage', icon: FileSpreadsheet, desc: 'Push this stream\'s invoices & purchase costs to Xero or Sage accounting' },
      { id: 'payment-gateway', label: 'Stripe Payments', icon: CreditCard, desc: 'Accept client invoice payments via Stripe for this stream' },
      { id: 'microsoft-365', label: 'Microsoft 365', icon: CalendarDays, desc: 'Unified SSO for Outlook Calendar, SharePoint, Teams & OneDrive for this stream' },
      { id: 'zapier-webhooks', label: 'Zapier / Make', icon: Webhook, desc: 'Register outbound webhook URLs to receive this stream\'s system events' },
    ],
  },
  {
    label: 'Planning & Briefing',
    items: [
      { id: 'azure-migration', label: 'Azure Migration Plan', icon: Cloud, desc: '13-week 1:1 migration roadmap to Azure-native architecture with A3 wall chart and parity matrix', external: '/azure-migration-plan', roles: ['admin'] },
      { id: 'presentation-pack', label: 'Team Briefing Pack', icon: FileText, desc: 'Full platform walkthrough — why we built it, every hub, and recent major work. Download a print-ready PDF', external: '/presentation-pack', roles: ['admin'] },
    ],
  },
  {
    label: 'System Configuration',
    items: [
      { id: 'division-check-config', label: 'Compliance Check Config', icon: ShieldCheck, desc: 'Configure which Mitti safety checks each division requires — vehicle, POWRA, equipment & general audits. Assign specific Mitti templates per division', roles: ['admin'] },
      { id: 'daily-checklists', label: 'Daily Checklists', icon: ClipboardCheck, desc: 'Configure the pre-work checklist crew complete before each shift — vehicle, plant, PPE checks per crew type' },
      { id: 'dropdowns', label: 'Dropdown Manager', icon: ListChecks, desc: 'Add, rename, reorder or remove options in every dropdown — qualifications, asset types, revenue streams & more' },
      { id: 'global-branding', label: 'Global Branding', icon: Palette, desc: 'Default colours, banner and footer for all automated emails' },
      { id: 'login-branding', label: 'Login Page Customiser', icon: Palette, desc: 'Customise the staff login page — background, colours, logo, welcome text & live preview', roles: ['admin'] },
      { id: 'portal-branding', label: 'Portal Branding Editor', icon: Palette, desc: 'Customise the client portal & subcontractor onboarding portal — welcome text, logo, colours, support contacts & live preview', roles: ['admin'] },
      { id: 'email-templates', label: 'Email Builder', icon: Mail, desc: 'Modern branded email template builder — live preview, design kit, tables, pills & buttons. Every email uses the same GC Mission Control design' },
      { id: 'report-templates', label: 'Report Builder', icon: FileBarChart, desc: 'Modern report template builder — mirrors the Email Builder. Pick data source, fields, chart type, filters & scheduling with a live layout preview' },
      { id: 'email-alerts', label: 'Email Alerts', icon: Mail, desc: 'Edit templates, recipients and timing for each automated email' },
      { id: 'automations', label: 'Automations', icon: Zap, desc: 'Background automations & alerts' },
      { id: 'incremental-import', label: 'Incremental Import', icon: Layers, desc: 'Non-destructive smart imports' },
      { id: 'system-guide', label: 'System Logic Guide', icon: BookOpen, desc: 'Download a PDF explaining every stat, rule and automation in the system', roles: ['admin', 'manager', 'viewer'] },
      { id: 'rewards', label: 'Rewards Manager', icon: Gift, desc: 'Create gift cards & rewards for the points catalogue, and fulfil staff redemptions', roles: ['admin'] },
      { id: 'expense-defaults', label: 'Expense Defaults', icon: Receipt, desc: 'Global default amounts & VAT rates per expense category — pre-fill every staff expense entry so crews only adjust when their spend differs', roles: ['admin'] },
      { id: 'coming-soon-manager', label: 'Coming Soon Manager', icon: Clock, desc: 'Control which integrations display as "Coming Soon" on the Settings overview — display flag only, does not disable functionality', roles: ['admin'] },
    ],
  },
  // Hidden groups — items remain here for access control / lockdown but are
  // not shown in the Settings sidebar or Hub overview. They render inside
  // their operational hub pages (Financial Control, Compliance, Assets, Staff).
  {
    label: '_hidden_migrated',
    items: [
      { id: 'billing', label: 'Billing Rules', icon: Banknote, desc: 'Delivery, task & consumable pricing rules' },
      { id: 'data-exchange', label: 'Data Exchange', icon: ArrowUpDown, desc: 'Bulk import/export rate cards, billing rules & BOQ data via CSV' },
      { id: 'overtime', label: 'Overtime', icon: Timer, desc: 'Overtime multipliers by day' },
      { id: 'business-rules', label: 'Business Rules', icon: Scale, desc: 'Core working rules — required daily hours & travel deductions — that drive the timesheet engine' },
      { id: 'expense-presets', label: 'Expense Presets', icon: Receipt, desc: 'Quick-add buttons crews see on the End-of-Shift expense step — fuel, subsistence, materials & GL codes' },
      { id: 'subcon-markup', label: 'Sub-Con Markup Rules', icon: TrendingUp, desc: 'Default markup percentages for subcontractor costs — guardrails prevent zero-margin billing' },
      { id: 'gl-mapping', label: 'GL Code Mapping', icon: FileSpreadsheet, desc: 'Map internal expense categories to SAP Concur General Ledger codes' },
      { id: 'billing-pipeline', label: 'Billing Pipeline', icon: GitBranch, desc: 'Lifecycle command view — contract stages, renewals due, vendor reconciliation & retention at a glance', roles: ['admin'] },
      { id: 'billing-contracts', label: 'Billing Contracts', icon: ScrollText, desc: 'Locked per-job billing terms — version-controlled contracts with rate snapshots, POA items & retention' },
      { id: 'purchase-orders', label: 'Purchase Orders', icon: FileText, desc: 'Create, track & match POs against supplier invoices with three-way matching — draft, send, receive & close', roles: ['admin'] },
      { id: 'financial-audit', label: 'Financial Audit Log', icon: History, desc: 'Tamper-evident record of every change to locked rate cards, SORs, billing rules, presets & contracts', roles: ['admin'] },
      { id: 'job-alerts', label: 'Job Budget Alerts', icon: Gauge, desc: 'Automated alerts when active jobs breach budget, margin or profit thresholds', roles: ['admin'] },
      { id: 'payroll-export', label: 'Payroll Export', icon: FileSpreadsheet, desc: 'Export approved weekly timesheets to CSV / Xero / Sage 50 — locks records after export', roles: ['admin'] },
      { id: 'custom-reports', label: 'Report Builder', icon: FileBarChart, desc: 'Build custom reports from 60+ data sources — pick columns, filter, and export to CSV or PDF', roles: ['admin', 'manager', 'viewer'] },
      { id: 'client-progress-report', label: 'Client Progress Report', icon: Star, desc: 'Generate a branded client-facing progress report for any job', roles: ['admin', 'manager'] },
      { id: 'rate-card', label: 'Price List', icon: Receipt, desc: 'Master Price List & project rate cards' },
      { id: 'compliance-rules', label: 'Compliance Rules', icon: Gauge, desc: 'Default LOLER, PUWER & PAT inspection intervals & expiry warnings', roles: ['admin'] },
      { id: 'system-audit-log', label: 'System Audit Log', icon: ShieldCheck, desc: 'ISO 27001 tamper-evident audit trail with SHA-256 record hashing & chain linking for non-repudiation', roles: ['admin'] },
      { id: 'audit-trail', label: 'Audit Trail & Job Packs', icon: History, desc: 'ISO-compliant audit trail — search for a job and expand its full Job Pack', roles: ['admin'] },

      { id: 'asset-manifests', label: 'Van Manifest QRs', icon: QrCode, desc: 'Create QR print-outs for bulky items (casing, rig tooling) — crews scan one sheet to log returns', roles: ['admin'] },
      { id: 'equipment-library', label: 'Equipment Sets', icon: Package, desc: 'Pre-built equipment sets (presets) — individual items now sync from Asset Panda' },
      { id: 'asset-lifecycle', label: 'Asset Lifecycle', icon: Wrench, desc: 'Track assets from acquisition to disposal — depreciation, book value & replacement planning', roles: ['admin'] },
      { id: 'depreciation-profiles', label: 'Depreciation Profiles', icon: TrendingDown, desc: 'Configure default depreciation methods & rules per asset type — straight-line, reducing balance, units of production', roles: ['admin'] },
      { id: 'absences', label: 'Absences', icon: CalendarX, desc: 'Manage staff absences and leave' },
      { id: 'holiday-accrual', label: 'Absence Accrual', icon: CalendarDays, desc: 'Track holiday pay accruals for staff' },
      { id: 'staff-reviews', label: 'Performance Reviews', icon: Star, desc: 'Manage staff performance reviews' },
      { id: 'timesheet-delegation', label: 'Approval Delegation', icon: UserCheck, desc: 'Manage timesheet approval delegations' },
      { id: 'vehicles', label: 'Vehicles', icon: Truck, desc: 'Manage vehicle fleet' },
      { id: 'clients', label: 'Clients', icon: Building2, desc: 'Manage clients' },
      { id: 'contractors', label: 'Subcontractors', icon: HardHat, desc: 'Manage subcontractors' },
      { id: 'suppliers', label: 'Suppliers', icon: Package, desc: 'Manage suppliers' },
      { id: 'teams', label: 'Crew Types', icon: Users, desc: 'Manage crew types / teams' },
      { id: 'staff', label: 'Staff', icon: Users, desc: 'Manage staff members' },
      { id: 'timesheets', label: 'Timesheets', icon: Clock, desc: 'Manage timesheets' },
      { id: 'invoicing', label: 'Invoicing', icon: Banknote, desc: 'Invoice management' },
      { id: 'compliance', label: 'Compliance', icon: ShieldCheck, desc: 'Compliance management' },
    ],
  },
];

export const allSettingsItems = settingsGroups.flatMap(g => g.items);

// Items visible to a given resolved role. Items without a `roles` array are
// admin-only (the default for all existing configuration tabs). Items that
// managers/viewers need (compliance, log-qc, timesheets) declare `roles`.
// If the profile has a permission group, the 'settings' module level is
// checked first — 'none' hides the entire settings area.
export function accessibleSettingsItems(role, profile) {
  if (!role) return [];

  // Super admins see everything — including the permission groups page
  // which is locked to super_admin only.
  if (role === 'super_admin') return allSettingsItems;

  // Permission group gate: if the group grants no access to the settings
  // module, hide every settings item.
  if (profile?.permission_group) {
    const settingsLevel = normalizePermissions(profile.permission_group.permissions).settings;
    if (settingsLevel === 'none') return [];
  }

  return allSettingsItems.filter(i => !i.roles || i.roles.includes(role));
}

// The sidebar nav UI component has been removed — the Settings Command Hub
// overview (SettingsHubOverview) now provides all navigation. The helper
// exports above (settingsGroups, allSettingsItems, accessibleSettingsItems)
// remain and are used by SettingsPage to resolve accessible tabs.