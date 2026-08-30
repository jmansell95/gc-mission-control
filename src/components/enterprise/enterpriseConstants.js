// Shared constants for the enterprise dashboard

export const STATUS_STYLES = {
  active: { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200', label: 'Active', dot: 'bg-emerald-500' },
  setup: { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200', label: 'Setup', dot: 'bg-amber-500' },
  on_hold: { bg: 'bg-slate-100', text: 'text-slate-600', ring: 'ring-slate-200', label: 'On Hold', dot: 'bg-slate-400' },
};

export const WIDGET_STORAGE_KEY = 'gc-enterprise-widgets';
export const DEFAULT_WIDGETS = {
  divisionHealth: true,
  financialRollup: true,
  pipelineOverview: true,
  fleetAssets: true,
  rigPerformance: true,
  workforceOverview: true,
  operationsHub: true,
  financialHub: true,
  complianceHub: true,
};