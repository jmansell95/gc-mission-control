import {
  AlertTriangle, AlertOctagon, Sparkles, GraduationCap, Cog, DollarSign,
  ShieldCheck, BarChart3, Drill, MapPin, TrendingUp, Users, Activity,
  CalendarClock, FileText, Truck, Wrench, Zap, Gauge, CloudSun, Bot,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════
//  FULLY CUSTOMISABLE DASHBOARD REGISTRY
//  Every widget the user can add, remove, reorder, and resize.
//  Each entry: { title, icon, fullWidth?, category, description }
// ═══════════════════════════════════════════════════════════════════
export const WIDGET_REGISTRY = {
  // ── Operational ──
  'active-sites': { title: 'Active Sites', icon: MapPin, fullWidth: true, category: 'operational', description: 'Live site cards with maps, crew, rigs & weather' },
  'rigs-on-site': { title: 'Rigs on Site', icon: Cog, category: 'operational', description: 'Count of active rigs across all live projects' },
  'boreholes-progress': { title: 'Boreholes in Progress', icon: Drill, category: 'operational', description: 'Active boreholes with completion status' },
  'field-priorities': { title: 'Field Priorities', icon: AlertTriangle, category: 'operational', description: 'Today\'s critical field actions' },
  'exception-monitor': { title: 'Needs Attention', icon: AlertOctagon, category: 'operational', description: 'Overdue items, expiring compliance, failed audits' },
  'live-crew': { title: 'Live Crew Status', icon: Users, category: 'operational', description: 'Who\'s on site, moving, or gone dark' },
  'deliveries-today': { title: 'Deliveries Today', icon: Truck, category: 'operational', description: 'Pending and active deliveries for today' },

  // ── Financial ──
  'live-revenue': { title: 'Live Drilling Revenue', icon: DollarSign, category: 'financial', description: 'Real-time revenue from meterage drilled today' },
  'billing-pipeline': { title: 'Billing Pipeline', icon: BarChart3, category: 'financial', description: 'AFP → CVR → Invoice flow status' },
  'revenue-velocity': { title: 'Revenue Velocity', icon: Gauge, category: 'financial', description: 'Meterage drilled vs target with projected completion' },
  'cash-flow': { title: 'Cash Flow Forecast', icon: TrendingUp, category: 'financial', description: 'Month-by-month inflow vs outflow projection' },
  'aged-debtors': { title: 'Aged Debtors', icon: DollarSign, category: 'financial', description: '30/60/90/120+ day outstanding invoice buckets' },

  // ── Safety & Compliance ──
  'safety-mitti': { title: 'Safety / Mitti', icon: ShieldCheck, category: 'safety', description: 'Latest audit scores and open action items' },
  'training-gaps': { title: 'Training Gaps', icon: GraduationCap, category: 'safety', description: 'Staff with expiring or missing certifications' },
  'compliance-expiry': { title: 'Compliance Expiry', icon: CalendarClock, category: 'safety', description: 'Upcoming certification & insurance expiries' },

  // ── Intelligence ──
  'ai-briefing': { title: 'AI Daily Briefing', icon: Bot, category: 'intelligence', description: 'Natural-language summary of what needs attention today' },
  'ai-insights': { title: 'AI Weekly Insights', icon: Sparkles, category: 'intelligence', description: 'Weekly AI-generated operational insights' },
  'weather': { title: 'Site Weather', icon: CloudSun, category: 'intelligence', description: 'Live weather conditions at active sites' },

  // ── Stats ──
  'key-metrics': { title: 'Key Metrics', icon: Activity, category: 'stats', description: 'Today\'s operational KPI snapshot' },
};

export const DEFAULT_WIDGETS = [
  'key-metrics',
  'active-sites',
  'rigs-on-site',
  'live-revenue',
  'safety-mitti',
  'billing-pipeline',
  'boreholes-progress',
  'exception-monitor',
  'revenue-velocity',
];

export const DEFAULT_HIDDEN = [];

export const WIDGET_CATEGORIES = [
  { key: 'operational', label: 'Operational', icon: Activity },
  { key: 'financial', label: 'Financial', icon: DollarSign },
  { key: 'safety', label: 'Safety & Compliance', icon: ShieldCheck },
  { key: 'intelligence', label: 'Intelligence', icon: Sparkles },
  { key: 'stats', label: 'Stats', icon: BarChart3 },
];

// Widgets that show company-wide data (not specific to a job).
export const GLOBAL_ONLY_WIDGETS = [
  'field-priorities', 'exception-monitor', 'ai-insights', 'training-gaps',
  'active-sites', 'rigs-on-site', 'live-revenue', 'billing-pipeline',
  'revenue-velocity', 'cash-flow', 'aged-debtors', 'key-metrics',
  'ai-briefing', 'weather', 'live-crew', 'deliveries-today',
  'compliance-expiry', 'safety-mitti', 'boreholes-progress',
];

// Backward compat
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