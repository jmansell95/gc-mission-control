import {
  Briefcase, Percent, ClipboardCheck, ShieldAlert, Drill, Radio,
  Radar, AlertTriangle, AlertOctagon, PoundSterling, Gauge, ShieldCheck,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════
//  COMMAND CENTRE BLOCK REGISTRY — Split Column Layout
//  Two rails: left (30% — compact widgets) and
//  right (70% — big visual widgets). Stat tiles render in a fixed
//  strip above the rails. Every block is drag-to-reorder,
//  resizable, and hideable. Layout persists to DashboardLayout.
// ═══════════════════════════════════════════════════════════════════

export const SECTIONS = [
  { id: 'left',  title: 'Metrics & Alerts',  icon: Gauge, accent: 'green' },
  { id: 'right', title: 'Live Operations',  icon: Radar, accent: 'green' },
];

export const BLOCK_REGISTRY = {
  // ── Left rail — compact insight widgets (stat tiles render in the top strip) ──
  'stat-active-jobs':      { title: 'Active Jobs',           icon: Briefcase,      rail: 'left',  defaultSize: 'sm' },
  'stat-crew-util':       { title: 'Crew Utilisation',       icon: Percent,        rail: 'left',  defaultSize: 'sm' },
  'stat-timesheet-queue': { title: 'Timesheet Queue',       icon: ClipboardCheck, rail: 'left',  defaultSize: 'sm' },
  'stat-outstanding':     { title: 'Outstanding Invoices',  icon: PoundSterling,  rail: 'left',  defaultSize: 'sm' },
  'stat-burn-rate':       { title: 'Burn Rate',             icon: Gauge,          rail: 'left',  defaultSize: 'sm' },
  'stat-overdue-actions':  { title: 'Overdue Actions',       icon: ShieldAlert,    rail: 'left',  defaultSize: 'sm' },
  'stat-red-alerts':       { title: 'Red Alerts',            icon: ShieldAlert,    rail: 'left',  defaultSize: 'sm' },
  'stat-fleet-compliance': { title: 'Fleet Compliance',      icon: ShieldCheck,    rail: 'left',  defaultSize: 'sm' },
  'field-priorities':      { title: 'Field Priorities',      icon: AlertTriangle,  rail: 'left',  defaultSize: 'md' },
  'exception-monitor':     { title: 'Needs Attention',       icon: AlertOctagon,   rail: 'left',  defaultSize: 'md' },
  // ── Right rail — big visual widgets ──
  'rigs-on-site':         { title: 'Rigs on Site Today',    icon: Drill,           rail: 'right', defaultSize: 'xl' },
  'site-snapshot':        { title: 'Active Sites',          icon: Radio,           rail: 'right', defaultSize: 'xl' },
  'mission-control':      { title: 'Mission Control',       icon: Radar,           rail: 'right', defaultSize: 'xl' },
};

export const DEFAULT_SECTION_LAYOUT = {
  left: ['field-priorities', 'exception-monitor'],
  right: ['rigs-on-site', 'site-snapshot', 'mission-control'],
};

export const DEFAULT_HIDDEN_BLOCKS = [];
export const DEFAULT_BLOCK_SIZES = {};

// All known block IDs — used to ensure every block appears in exactly one rail
export const ALL_BLOCK_IDS = Object.keys(BLOCK_REGISTRY);