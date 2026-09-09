import { AlertTriangle, AlertOctagon, Sparkles, GraduationCap } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════
//  STREAMLINED DASHBOARD REGISTRY
//  Only widgets that DON'T have a dedicated hub live on the dashboard.
//  Removed:
//   - live-site-map → integrated into Site Snapshot Grid (active job cards)
//   - workload-ownership → integrated into Manage Jobs page
//  Moved to dedicated hubs:
//   - borehole-progress, geo-heatmap → Investigation Hub
//   - site-weather → Compliance Hub
//   - system-health → Settings
//   - executive-snapshot → merged into Command Centre / Mission Control
// ═══════════════════════════════════════════════════════════════════
export const WIDGET_REGISTRY = {
  'field-priorities': { title: 'Field Priorities', icon: AlertTriangle },
  'exception-monitor': { title: 'Needs Attention', icon: AlertOctagon },
  'ai-insights': { title: 'AI Weekly Insights', icon: Sparkles },
  'training-gap-scheduler': { title: 'Training Gaps', icon: GraduationCap },
};

export const DEFAULT_WIDGETS = [
  'field-priorities',
  'exception-monitor',
  'training-gap-scheduler',
  'ai-insights',
];

export const DEFAULT_HIDDEN = [];

// Widgets that show company-wide data (not specific to a job).
// Hidden when the dashboard is focused on a single job.
export const GLOBAL_ONLY_WIDGETS = [
  'field-priorities', 'exception-monitor', 'ai-insights', 'training-gap-scheduler',
];

// Backward compat — kept for any code still importing these
export const TIER_GLANCE = DEFAULT_WIDGETS;
export const TIER_INSIGHTS = [];
export const DEFAULT_WIDGETS_FLAT = DEFAULT_WIDGETS;
export const TIER_META = {};
export const WIDGET_TIER = {};
export const TIER_OPERATIONAL = DEFAULT_WIDGETS;
export const TIER_ALERTS = [];
export const TIER_ANALYTICS = [];
export const PRIMARY_WIDGETS = DEFAULT_WIDGETS;
export const SECONDARY_WIDGETS = [];
export const COST_WIDGETS = [];