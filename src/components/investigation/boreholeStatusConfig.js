import { CheckCircle2, Loader2, CircleDashed, Mountain } from 'lucide-react';

// Borehole completion status config — shared across BoreholeDrillDown,
// InvestigationHub, InvestigationGroupCard, and the dashboard widget.
// Status comes from the AGS LOCA_STAT field (COMPLETE / INPROG / UNCHECKED).

export const BOREHOLE_STATUS_CONFIG = {
  complete: {
    label: 'Completed',
    short: 'Done',
    icon: CheckCircle2,
    badge: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
    tile: 'stat-gradient-emerald',
  },
  in_progress: {
    label: 'In Progress',
    short: 'Active',
    icon: Loader2,
    badge: 'bg-amber-100 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
    tile: 'stat-gradient-amber',
  },
  unchecked: {
    label: 'Unchecked',
    short: 'Unknown',
    icon: CircleDashed,
    badge: 'bg-slate-100 text-slate-600 border-slate-200',
    dot: 'bg-slate-400',
    tile: 'stat-gradient-slate',
  },
};

export const BOREHOLE_STATUS_ORDER = ['in_progress', 'unchecked', 'complete'];

// Missing-data group definitions — each key maps to a label shown on the
// borehole card when that data group is absent for an in-progress borehole.
export const MISSING_DATA_GROUPS = [
  { key: 'strata', label: 'No strata' },
  { key: 'samples', label: 'No samples' },
  { key: 'spt', label: 'No SPT' },
  { key: 'installations', label: 'No installations' },
  { key: 'remarks', label: 'No remarks' },
  { key: 'finalDepth', label: 'No final depth' },
];