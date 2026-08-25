import React, { useMemo } from 'react';
import {
  Briefcase, Users, Car, Boxes, PoundSterling, ShieldCheck, FlaskConical, Truck, TrendingUp,
} from 'lucide-react';
import { useReportData, filterJobsByDate, tally, sumField } from '@/hooks/useReportData';
import ReportChartCard from './ReportChartCard';

/**
 * Native cross-hub reports — builds chart datasets from every hub's live data
 * and renders them as drill-down chart cards. Each category shows a different
 * set of charts. Cross-cutting reports blend multiple hubs.
 */
export default function ReportNativeSection({ hub, filters }) {
  const data = useReportData(filters);

  const filteredJobs = useMemo(() => filterJobsByDate(data.jobs, filters.dateFrom, filters.dateTo), [data.jobs, filters.dateFrom, filters.dateTo]);

  const charts = useMemo(() => {
    const all = [
      // ── Overview ──
      { id: 'jobs-status', title: 'Jobs by Status', icon: Briefcase, data: tally(filteredJobs, 'status'), type: 'pie', rows: filteredJobs,
        drillDown: { route: '/admin', params: { status: '' } } },
      { id: 'jobs-div', title: 'Jobs by Business Stream', icon: Briefcase, data: tally(filteredJobs, 'division_id'), type: 'bar', rows: filteredJobs },
      { id: 'revenue', title: 'AFP Revenue (Agreed)', icon: PoundSterling, data: [{ name: 'Total', value: sumField(data.afps, 'agreed_total') || sumField(data.afps, 'total_claimed') }], type: 'stat', rows: data.afps, valuePrefix: '£',
        drillDown: { route: '/billing' } },
      { id: 'staff-team', title: 'Staff by Team', icon: Users, data: tally(data.staff, 'team_id'), type: 'bar', rows: data.staff,
        drillDown: { route: '/staff' } },
      { id: 'fleet-status', title: 'Fleet by Geotab Sync', icon: Car, data: tally(data.vehicles, 'geotab_sync_status'), type: 'pie', rows: data.vehicles,
        drillDown: { route: '/fleet' } },
      { id: 'assets-type', title: 'Assets by Type', icon: Boxes, data: tally(data.assets, 'asset_type'), type: 'bar', rows: data.assets,
        drillDown: { route: '/assets' } },
      { id: 'asset-compliance', title: 'Asset Compliance', icon: ShieldCheck, data: tally(data.assets, 'compliance_status'), type: 'pie', rows: data.assets,
        drillDown: { route: '/assets' } },

      // ── Financial ──
      { id: 'afp-status', title: 'AFPs by Status', icon: PoundSterling, data: tally(data.afps, 'status'), type: 'pie', rows: data.afps,
        drillDown: { route: '/billing' } },
      { id: 'afp-revenue', title: 'AFP Agreed Total', icon: PoundSterling, data: [{ name: 'Agreed', value: sumField(data.afps, 'agreed_total') }], type: 'stat', rows: data.afps, valuePrefix: '£' },
      { id: 'job-profit', title: 'Job Profitability', icon: TrendingUp, data: filteredJobs.map(j => ({ name: j.name || '—', value: (Number(j.client_charge) || 0) - (Number(j.actual_cost) || 0) })).sort((a, b) => b.value - a.value).slice(0, 10), type: 'bar', rows: filteredJobs,
        drillDown: { route: '/billing' } },
      { id: 'timesheet-hours', title: 'Timesheet Hours', icon: Users, data: [{ name: 'Total Hours', value: sumField(data.timesheets, 'total_hours') }], type: 'stat', rows: data.timesheets },

      // ── Jobs ──
      { id: 'jobs-type', title: 'Jobs by Type', icon: Briefcase, data: tally(filteredJobs, 'job_type'), type: 'bar', rows: filteredJobs },
      { id: 'jobs-pm', title: 'Jobs by Project Manager', icon: Briefcase, data: tally(filteredJobs, 'project_manager'), type: 'bar', rows: filteredJobs },

      // ── Fleet ──
      { id: 'fleet-mot', title: 'Fleet MOT Status', icon: Car, data: tally(data.vehicles, 'mot_status'), type: 'pie', rows: data.vehicles,
        drillDown: { route: '/fleet' } },
      { id: 'fleet-fuel', title: 'Fleet by Fuel Type', icon: Car, data: tally(data.vehicles, 'fuel_type'), type: 'pie', rows: data.vehicles },

      // ── Staff ──
      { id: 'staff-status', title: 'Staff by Status', icon: Users, data: tally(data.staff, 'status'), type: 'pie', rows: data.staff,
        drillDown: { route: '/staff' } },
      { id: 'staff-role', title: 'Staff by Job Title', icon: Users, data: tally(data.staff, 'job_title'), type: 'bar', rows: data.staff },

      // ── Compliance ──
      { id: 'comp-status', title: 'Asset Compliance Status', icon: ShieldCheck, data: tally(data.assets, 'compliance_status'), type: 'pie', rows: data.assets,
        drillDown: { route: '/compliance' } },
      { id: 'comp-maint', title: 'Maintenance Status', icon: ShieldCheck, data: tally(data.assets, 'maintenance_status'), type: 'pie', rows: data.assets },

      // ── Assets ──
      { id: 'asset-stock', title: 'Assets by Stock Level', icon: Boxes, data: tally(data.assets, 'stock_level'), type: 'bar', rows: data.assets },
      { id: 'asset-value', title: 'Asset Book Value', icon: Boxes, data: [{ name: 'Total', value: sumField(data.assets, 'current_book_value') || sumField(data.assets, 'acquisition_cost') }], type: 'stat', rows: data.assets, valuePrefix: '£' },

      // ── Geotech ──
      { id: 'inv-type', title: 'Investigation Logs by Type', icon: FlaskConical, data: tally(data.invLogs, 'log_type'), type: 'bar', rows: data.invLogs },
      { id: 'inv-source', title: 'Logs by Source', icon: FlaskConical, data: tally(data.invLogs, 'source'), type: 'pie', rows: data.invLogs },

      // ── Logistics ──
      { id: 'del-status', title: 'Deliveries by Status', icon: Truck, data: tally(data.deliveries, 'status'), type: 'pie', rows: data.deliveries },
      { id: 'del-type', title: 'Deliveries by Type', icon: Truck, data: tally(data.deliveries, 'delivery_type'), type: 'bar', rows: data.deliveries },
    ];

    const sets = {
      overview: ['jobs-status', 'jobs-div', 'revenue', 'staff-team', 'fleet-status', 'assets-type', 'asset-compliance'],
      financial: ['afp-status', 'afp-revenue', 'job-profit', 'timesheet-hours', 'revenue'],
      jobs: ['jobs-status', 'jobs-div', 'jobs-type', 'jobs-pm', 'job-profit'],
      fleet: ['fleet-status', 'fleet-mot', 'fleet-fuel'],
      staff: ['staff-team', 'staff-status', 'staff-role', 'timesheet-hours'],
      compliance: ['comp-status', 'comp-maint', 'asset-compliance'],
      assets: ['assets-type', 'asset-stock', 'asset-value', 'asset-compliance'],
      geotech: ['inv-type', 'inv-source'],
      logistics: ['del-status', 'del-type'],
    };
    const ids = sets[hub] || sets.overview;
    return all.filter(c => ids.includes(c.id));
  }, [hub, data, filteredJobs]);

  if (data.isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-[#2E5A1A] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {charts.map(c => <ReportChartCard key={c.id} {...c} />)}
    </div>
  );
}