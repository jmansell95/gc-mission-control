import {
  Briefcase, Percent, ClipboardCheck, ShieldAlert, Drill, Radio,
  Radar, AlertTriangle, AlertOctagon, Sparkles, PoundSterling, Gauge, ShieldCheck,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════
//  COMMAND CENTRE BLOCK REGISTRY
//  Every block on the dashboard — stat tiles, rig widget, site snapshot,
//  mission control, and insight widgets — is registered here so the
//  CommandCentreGrid can drag/resize/hide them uniformly.
// ═══════════════════════════════════════════════════════════════════

export const SECTIONS = [
  { id: 'operations', title: 'Operations', icon: Briefcase, accent: 'green' },
  { id: 'financial', title: 'Financial', icon: PoundSterling, accent: 'blue' },
  { id: 'safety', title: 'Safety & Compliance', icon: ShieldAlert, accent: 'rose' },
];

export const BLOCK_REGISTRY = {
  // ── Operations ──
  'stat-active-jobs':    { title: 'Active Jobs',        icon: Briefcase,      section: 'operations', defaultSize: 'sm' },
  'stat-crew-util':      { title: 'Crew Utilisation',    icon: Percent,        section: 'operations', defaultSize: 'sm' },
  'stat-timesheet-queue':{ title: 'Timesheet Queue',    icon: ClipboardCheck, section: 'operations', defaultSize: 'sm' },
  'rigs-on-site':        { title: 'Rigs on Site Today',  icon: Drill,          section: 'operations', defaultSize: 'xl' },
  'site-snapshot':       { title: 'Active Sites',        icon: Radio,          section: 'operations', defaultSize: 'xl' },
  'mission-control':    { title: 'Mission Control',     icon: Radar,          section: 'operations', defaultSize: 'xl' },
  'field-priorities':    { title: 'Field Priorities',    icon: AlertTriangle,  section: 'operations', defaultSize: 'md' },
  'exception-monitor':   { title: 'Needs Attention',     icon: AlertOctagon,   section: 'operations', defaultSize: 'md' },
  'ai-insights':         { title: 'AI Weekly Insights',  icon: Sparkles,       section: 'operations', defaultSize: 'md' },
  // ── Financial ──
  'stat-outstanding':    { title: 'Outstanding Invoices', icon: PoundSterling, section: 'financial', defaultSize: 'sm' },
  'stat-burn-rate':      { title: 'Burn Rate',            icon: Gauge,         section: 'financial', defaultSize: 'sm' },
  // ── Safety & Compliance ──
  'stat-overdue-actions':  { title: 'Overdue Actions',    icon: ShieldAlert,  section: 'safety', defaultSize: 'sm' },
  'stat-red-alerts':       { title: 'Red Alerts',         icon: ShieldAlert,  section: 'safety', defaultSize: 'sm' },
  'stat-fleet-compliance': { title: 'Fleet Compliance',   icon: ShieldCheck,  section: 'safety', defaultSize: 'sm' },
};

export const DEFAULT_SECTION_LAYOUT = {
  operations: [
    'stat-active-jobs', 'stat-crew-util', 'stat-timesheet-queue',
    'rigs-on-site', 'site-snapshot', 'mission-control',
    'field-priorities', 'exception-monitor', 'ai-insights',
  ],
  financial: ['stat-outstanding', 'stat-burn-rate'],
  safety: ['stat-overdue-actions', 'stat-red-alerts', 'stat-fleet-compliance'],
};

export const DEFAULT_HIDDEN_BLOCKS = [];
export const DEFAULT_BLOCK_SIZES = {};

// All known block IDs — used to ensure every block appears in exactly one section
export const ALL_BLOCK_IDS = Object.keys(BLOCK_REGISTRY);