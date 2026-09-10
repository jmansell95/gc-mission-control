/**
 * kpiMetrics.js — the catalog of system-tracked performance metrics available
 * for the per-role KPI sets. Each metric has a key, label, unit, icon, and a
 * compute function that takes (staffId, ctx) and returns { value, display }.
 *
 * The RolePerformanceDashboard fetches all the raw data once (ctx), then runs
 * each metric's compute function to get the live value for the staff member.
 *
 * Metrics are department-agnostic — the admin picks which metrics belong in
 * each role's KPI set. Not every metric makes sense for every role (e.g.
 * meterage is drilling-only); the settings manager shows all metrics but the
 * admin chooses the relevant ones.
 */

import {
  Ruler, Compass, Clock, ShieldCheck, ClipboardCheck,
  Truck, PackageCheck, Wrench, CalendarCheck, Gauge,
} from 'lucide-react';

export const KPI_METRICS = [
  {
    key: 'meterage',
    label: 'Weekly Metrage',
    description: 'Total metres drilled this week (from InvestigationLog depth_to - depth_from).',
    unit: 'm',
    icon: Ruler,
    defaultTarget: 100,
    defaultWeight: 3,
    departments: ['field'],
    compute: (staffId, ctx) => {
      const weekStart = ctx.weekStart;
      const logs = (ctx.investigationLogs || []).filter(
        l => l.staff_id === staffId && l.date && l.date >= weekStart
      );
      const total = logs.reduce((s, l) => {
        if (l.depth_to != null && l.depth_from != null) return s + (l.depth_to - l.depth_from);
        return s;
      }, 0);
      return { value: Number(total.toFixed(1)), display: `${total.toFixed(1)}m` };
    },
  },
  {
    key: 'boreholes_count',
    label: 'Boreholes This Week',
    description: 'Number of distinct boreholes worked on this week.',
    unit: '',
    icon: Compass,
    defaultTarget: 5,
    defaultWeight: 2,
    departments: ['field'],
    compute: (staffId, ctx) => {
      const weekStart = ctx.weekStart;
      const refs = new Set(
        (ctx.investigationLogs || [])
          .filter(l => l.staff_id === staffId && l.date && l.date >= weekStart && l.borehole_ref)
          .map(l => l.borehole_ref)
      );
      return { value: refs.size, display: String(refs.size) };
    },
  },
  {
    key: 'on_time_arrival',
    label: 'On-Time Arrival',
    description: 'Percentage of shifts this week where the crew member arrived on site on time.',
    unit: '%',
    icon: Clock,
    defaultTarget: 95,
    defaultWeight: 3,
    departments: ['field'],
    compute: (staffId, ctx) => {
      const weekStart = ctx.weekStart;
      const assignments = (ctx.rotaAssignments || []).filter(
        a => a.staff_id === staffId && a.date && a.date >= weekStart
      );
      if (assignments.length === 0) return { value: 0, display: '—' };
      const onTime = assignments.filter(a => a.arrived_on_time !== false).length;
      const pct = Math.round((onTime / assignments.length) * 100);
      return { value: pct, display: `${pct}%` };
    },
  },
  {
    key: 'safety_checks',
    label: 'Safety Checks Completed',
    description: 'Number of Mitti safety checks / toolbox talks completed this week.',
    unit: 'checks',
    icon: ShieldCheck,
    defaultTarget: 5,
    defaultWeight: 3,
    departments: ['field', 'depot'],
    compute: (staffId, ctx) => {
      const weekStart = ctx.weekStart;
      const checks = (ctx.safetyReports || []).filter(
        s => s.staff_id === staffId && s.date && s.date >= weekStart
      );
      return { value: checks.length, display: String(checks.length) };
    },
  },
  {
    key: 'timesheet_compliance',
    label: 'Timesheet Compliance',
    description: 'Percentage of submitted timesheets this week that were submitted on time.',
    unit: '%',
    icon: ClipboardCheck,
    defaultTarget: 100,
    defaultWeight: 2,
    departments: ['field', 'depot', 'office'],
    compute: (staffId, ctx) => {
      const weekStart = ctx.weekStart;
      const ts = (ctx.timesheets || []).filter(
        t => t.staff_id === staffId && t.week_start && t.week_start >= weekStart
      );
      if (ts.length === 0) return { value: 0, display: '—' };
      const onTime = ts.filter(t => t.status === 'approved' || t.status === 'submitted').length;
      const pct = Math.round((onTime / ts.length) * 100);
      return { value: pct, display: `${pct}%` };
    },
  },
  {
    key: 'dispatch_accuracy',
    label: 'Dispatch Accuracy',
    description: 'Percentage of deliveries this week completed on the correct day.',
    unit: '%',
    icon: Truck,
    defaultTarget: 95,
    defaultWeight: 3,
    departments: ['logistics', 'depot'],
    compute: (staffId, ctx) => {
      const weekStart = ctx.weekStart;
      const deliveries = (ctx.deliveryLogs || []).filter(
        d => d.driver_staff_id === staffId && d.scheduled_date && d.scheduled_date >= weekStart
      );
      if (deliveries.length === 0) return { value: 0, display: '—' };
      const onTime = deliveries.filter(d => d.status === 'completed').length;
      const pct = Math.round((onTime / deliveries.length) * 100);
      return { value: pct, display: `${pct}%` };
    },
  },
  {
    key: 'stock_checks',
    label: 'Stock Checks',
    description: 'Number of consumable stock checks / goods-in receipts processed this week.',
    unit: 'checks',
    icon: PackageCheck,
    defaultTarget: 20,
    defaultWeight: 2,
    departments: ['depot', 'logistics'],
    compute: (staffId, ctx) => {
      const weekStart = ctx.weekStart;
      const receipts = (ctx.goodsInReceipts || []).filter(
        r => r.received_by_staff_id === staffId && r.received_date && r.received_date >= weekStart
      );
      return { value: receipts.length, display: String(receipts.length) };
    },
  },
  {
    key: 'vehicle_prep',
    label: 'Vehicle Prep',
    description: 'Number of vehicle pre-use checks completed this week.',
    unit: 'checks',
    icon: Wrench,
    defaultTarget: 5,
    defaultWeight: 2,
    departments: ['depot', 'logistics', 'field'],
    compute: (staffId, ctx) => {
      const weekStart = ctx.weekStart;
      const checks = (ctx.vehicleChecks || []).filter(
        c => c.staff_id === staffId && c.date && c.date >= weekStart
      );
      return { value: checks.length, display: String(checks.length) };
    },
  },
  {
    key: 'hours_worked',
    label: 'Hours This Week',
    description: 'Total working hours logged this week (from summary timesheets).',
    unit: 'hrs',
    icon: CalendarCheck,
    defaultTarget: 45,
    defaultWeight: 1,
    departments: ['field', 'depot', 'office'],
    compute: (staffId, ctx) => {
      const weekStart = ctx.weekStart;
      const mins = (ctx.timesheets || [])
        .filter(t => t.staff_id === staffId && t.week_start && t.week_start >= weekStart)
        .reduce((s, t) => s + (t.weekly_total_minutes || 0), 0);
      const hrs = Math.round(mins / 60);
      return { value: hrs, display: `${hrs}h` };
    },
  },
  {
    key: 'jobs_completed',
    label: 'Jobs Completed',
    description: 'Number of jobs moved to completed this week (for managers/office staff).',
    unit: 'jobs',
    icon: Gauge,
    defaultTarget: 3,
    defaultWeight: 2,
    departments: ['office', 'management'],
    compute: (staffId, ctx) => {
      const weekStart = ctx.weekStart;
      const jobs = (ctx.jobs || []).filter(
        j => j.project_manager_staff_id === staffId && j.status_changed_at && j.status_changed_at >= weekStart && j.status === 'completed'
      );
      return { value: jobs.length, display: String(jobs.length) };
    },
  },
];

export const KPI_METRIC_MAP = Object.fromEntries(KPI_METRICS.map(m => [m.key, m]));

export const DEPARTMENT_CONFIG = {
  field: { label: 'Field Crew', color: '#2E5A1A', icon: Ruler },
  depot: { label: 'Depot Staff', color: '#0369a1', icon: PackageCheck },
  office: { label: 'Office Staff', color: '#7c3aed', icon: ClipboardCheck },
  logistics: { label: 'Logistics', color: '#ea580c', icon: Truck },
  management: { label: 'Management', color: '#be185d', icon: Gauge },
};