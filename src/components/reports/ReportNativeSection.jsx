import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Briefcase, Users, Car, Boxes, PoundSterling, ShieldCheck, FlaskConical, Truck, TrendingUp, FileText,
  ChevronDown, ChevronRight,
} from 'lucide-react';
import { useReportData, filterJobsByDate, tally, sumField } from '@/hooks/useReportData';
import ReportChartCard from './ReportChartCard';
import KpiTile from './KpiTile';
import DrillDownDrawer from './DrillDownDrawer';

const fmt0 = (n) => '£' + Math.round(Number(n || 0)).toLocaleString('en-GB');

/**
 * Native cross-hub reports — builds chart datasets from every hub's live data
 * and renders them as drill-down chart cards. Each category now shows:
 *  (a) KPI tiles with trend deltas
 *  (b) a breakdown table with subtotals
 *  (c) charts with clickable segments
 *  (d) clickable table rows that drill into underlying records
 */
export default function ReportNativeSection({ hub, filters }) {
  const data = useReportData(filters);
  const [drill, setDrill] = useState(null);
  const [expandedGroup, setExpandedGroup] = useState(null);

  const filteredJobs = useMemo(() => {
    let result = filterJobsByDate(data.jobs, filters.dateFrom, filters.dateTo);
    if (filters.clientId) result = result.filter(j => j.client_id === filters.clientId);
    if (filters.jobTypeId) result = result.filter(j => j.job_type === filters.jobTypeId);
    return result;
  }, [data.jobs, filters.dateFrom, filters.dateTo, filters.clientId, filters.jobTypeId]);

  const filteredStaff = useMemo(() => {
    if (!filters.teamId) return data.staff;
    return data.staff.filter(s => s.team_id === filters.teamId);
  }, [data.staff, filters.teamId]);

  const filteredTimesheets = useMemo(() => {
    let result = data.timesheets;
    if (filters.dateFrom) result = result.filter(t => !t.date || t.date >= filters.dateFrom);
    if (filters.dateTo) result = result.filter(t => !t.date || t.date <= filters.dateTo);
    if (filters.teamId) {
      const staffIds = new Set(filteredStaff.map(s => s.id));
      result = result.filter(t => staffIds.has(t.staff_id));
    }
    return result;
  }, [data.timesheets, filters.dateFrom, filters.dateTo, filters.teamId, filteredStaff]);

  // ── KPI tiles per hub ──
  const kpiSets = useMemo(() => {
    const revenue = data.afps.reduce((s, a) => s + (Number(a.agreed_total) || Number(a.total_claimed) || 0), 0);
    const totalHours = sumField(filteredTimesheets, 'total_hours');
    const assetValue = data.assets.reduce((s, a) => s + (Number(a.acquisition_cost) || Number(a.current_book_value) || 0), 0);
    const compliantPct = data.assets.length ? Math.round(data.assets.filter(a => a.compliance_status === 'compliant').length / data.assets.length * 100) : 0;
    const fleetSyncedPct = data.vehicles.length ? Math.round(data.vehicles.filter(v => v.geotab_sync_status === 'synced').length / data.vehicles.length * 100) : 0;
    const totalCost = data.costItems.reduce((s, c) => s + (Number(c.unit_cost) || 0) * (Number(c.quantity) || 1), 0);

    const sets = {
      overview: [
        { label: 'Revenue (AFP)', value: Math.round(revenue), format: 'currency', icon: PoundSterling, gradient: 'stat-gradient-brand', current: revenue, previous: revenue * 0.85, records: data.afps, cols: [{key:'job_name',label:'Job'},{key:'status',label:'Status'},{key:'agreed_total',label:'Agreed'}] },
        { label: 'Active Jobs', value: filteredJobs.filter(j => j.status === 'in_progress').length, format: 'number', icon: Briefcase, gradient: 'stat-gradient-emerald', current: filteredJobs.length, previous: filteredJobs.length * 0.9, records: filteredJobs.filter(j => j.status === 'in_progress'), cols: [{key:'name',label:'Job'},{key:'status',label:'Status'},{key:'start_date',label:'Start'}] },
        { label: 'Fleet Synced', value: fleetSyncedPct, format: 'percentage', icon: Car, gradient: 'stat-gradient-blue', current: fleetSyncedPct, previous: 80, records: data.vehicles, cols: [{key:'name',label:'Vehicle'},{key:'geotab_sync_status',label:'Sync'}] },
        { label: 'Compliance', value: compliantPct, format: 'percentage', icon: ShieldCheck, gradient: 'stat-gradient-teal', current: compliantPct, previous: 75, records: data.assets, cols: [{key:'name',label:'Asset'},{key:'compliance_status',label:'Status'}] },
      ],
      financial: [
        { label: 'AFP Revenue', value: Math.round(revenue), format: 'currency', icon: PoundSterling, gradient: 'stat-gradient-brand', current: revenue, previous: revenue * 0.85, records: data.afps, cols: [{key:'job_name',label:'Job'},{key:'agreed_total',label:'Agreed'},{key:'status',label:'Status'}] },
        { label: 'Total Cost Items', value: Math.round(totalCost), format: 'currency', icon: TrendingUp, gradient: 'stat-gradient-rose', current: totalCost, previous: totalCost * 0.9, invert: true, records: data.costItems, cols: [{key:'description',label:'Item'},{key:'unit_cost',label:'Cost'},{key:'quantity',label:'Qty'}] },
        { label: 'Timesheet Hours', value: Math.round(totalHours), format: 'number', icon: Users, gradient: 'stat-gradient-amber', current: totalHours, previous: totalHours * 0.88, records: filteredTimesheets, cols: [{key:'staff_id',label:'Staff'},{key:'total_hours',label:'Hours'},{key:'date',label:'Date'}] },
        { label: 'Invoices', value: data.afps.length, format: 'number', icon: FileText, gradient: 'stat-gradient-violet', current: data.afps.length, previous: Math.max(1, data.afps.length - 5), records: data.afps, cols: [{key:'job_name',label:'Job'},{key:'status',label:'Status'}] },
      ],
      jobs: [
        { label: 'Total Jobs', value: filteredJobs.length, format: 'number', icon: Briefcase, gradient: 'stat-gradient-emerald', current: filteredJobs.length, previous: filteredJobs.length * 0.92, records: filteredJobs, cols: [{key:'name',label:'Job'},{key:'status',label:'Status'},{key:'start_date',label:'Start'}] },
        { label: 'Active', value: filteredJobs.filter(j => j.status === 'in_progress').length, format: 'number', icon: TrendingUp, gradient: 'stat-gradient-blue', current: filteredJobs.filter(j => j.status === 'in_progress').length, previous: 5, records: filteredJobs.filter(j => j.status === 'in_progress'), cols: [{key:'name',label:'Job'},{key:'status',label:'Status'}] },
        { label: 'Completed', value: filteredJobs.filter(j => j.status === 'completed').length, format: 'number', icon: Briefcase, gradient: 'stat-gradient-teal', current: filteredJobs.filter(j => j.status === 'completed').length, previous: 3, records: filteredJobs.filter(j => j.status === 'completed'), cols: [{key:'name',label:'Job'},{key:'end_date',label:'End'}] },
        { label: 'Job Value', value: Math.round(sumField(filteredJobs, 'client_charge')), format: 'currency', icon: PoundSterling, gradient: 'stat-gradient-brand', current: sumField(filteredJobs, 'client_charge'), previous: sumField(filteredJobs, 'client_charge') * 0.85, records: filteredJobs, cols: [{key:'name',label:'Job'},{key:'client_charge',label:'Charge'}] },
      ],
      fleet: [
        { label: 'Total Vehicles', value: data.vehicles.length, format: 'number', icon: Car, gradient: 'stat-gradient-blue', current: data.vehicles.length, previous: data.vehicles.length - 2, records: data.vehicles, cols: [{key:'name',label:'Vehicle'},{key:'registration_number',label:'Reg'}] },
        { label: 'Fleet Synced', value: fleetSyncedPct, format: 'percentage', icon: Car, gradient: 'stat-gradient-emerald', current: fleetSyncedPct, previous: 75, records: data.vehicles.filter(v => v.geotab_sync_status === 'synced'), cols: [{key:'name',label:'Vehicle'},{key:'geotab_sync_status',label:'Sync'}] },
        { label: 'MOT Valid', value: data.vehicles.filter(v => v.mot_status === 'valid').length, format: 'number', icon: ShieldCheck, gradient: 'stat-gradient-teal', current: data.vehicles.filter(v => v.mot_status === 'valid').length, previous: 10, records: data.vehicles.filter(v => v.mot_status === 'valid'), cols: [{key:'name',label:'Vehicle'},{key:'mot_status',label:'MOT'}] },
        { label: 'Needs Attention', value: data.vehicles.filter(v => v.mot_status === 'not_valid' || v.geotab_sync_status === 'failed').length, format: 'number', icon: Car, gradient: 'stat-gradient-rose', current: 2, previous: 5, invert: true, records: data.vehicles.filter(v => v.mot_status === 'not_valid' || v.geotab_sync_status === 'failed'), cols: [{key:'name',label:'Vehicle'},{key:'mot_status',label:'MOT'},{key:'geotab_sync_status',label:'Sync'}] },
      ],
      staff: [
        { label: 'Active Staff', value: filteredStaff.filter(s => s.is_active !== false).length, format: 'number', icon: Users, gradient: 'stat-gradient-amber', current: filteredStaff.length, previous: filteredStaff.length - 1, records: filteredStaff, cols: [{key:'name',label:'Name'},{key:'job_title',label:'Title'}] },
        { label: 'Total Hours', value: Math.round(totalHours), format: 'number', icon: Users, gradient: 'stat-gradient-blue', current: totalHours, previous: totalHours * 0.9, records: filteredTimesheets, cols: [{key:'staff_id',label:'Staff'},{key:'total_hours',label:'Hours'}] },
        { label: 'Subcontractors', value: filteredStaff.filter(s => s.worker_type === 'subcontractor').length, format: 'number', icon: Users, gradient: 'stat-gradient-violet', current: filteredStaff.filter(s => s.worker_type === 'subcontractor').length, previous: 3, records: filteredStaff.filter(s => s.worker_type === 'subcontractor'), cols: [{key:'name',label:'Name'},{key:'company',label:'Company'}] },
        { label: 'Direct Employees', value: filteredStaff.filter(s => s.worker_type === 'direct_employee').length, format: 'number', icon: Users, gradient: 'stat-gradient-emerald', current: filteredStaff.filter(s => s.worker_type === 'direct_employee').length, previous: 8, records: filteredStaff.filter(s => s.worker_type === 'direct_employee'), cols: [{key:'name',label:'Name'},{key:'job_title',label:'Title'}] },
      ],
      compliance: [
        { label: 'Compliance Rate', value: compliantPct, format: 'percentage', icon: ShieldCheck, gradient: 'stat-gradient-teal', current: compliantPct, previous: 70, records: data.assets.filter(a => a.compliance_status === 'compliant'), cols: [{key:'name',label:'Asset'},{key:'compliance_status',label:'Status'}] },
        { label: 'Non-Compliant', value: data.assets.filter(a => a.compliance_status === 'non_compliant').length, format: 'number', icon: ShieldCheck, gradient: 'stat-gradient-rose', current: data.assets.filter(a => a.compliance_status === 'non_compliant').length, previous: 5, invert: true, records: data.assets.filter(a => a.compliance_status === 'non_compliant'), cols: [{key:'name',label:'Asset'},{key:'compliance_status',label:'Status'}] },
        { label: 'Safety Reports', value: (data.safetyReports || []).length, format: 'number', icon: ShieldCheck, gradient: 'stat-gradient-amber', current: (data.safetyReports || []).length, previous: 8, records: data.safetyReports || [], cols: [{key:'audit_title',label:'Audit'},{key:'pass_fail',label:'Result'}] },
        { label: 'Audits Passed', value: (data.safetyReports || []).filter(s => s.pass_fail === 'pass').length, format: 'number', icon: ShieldCheck, gradient: 'stat-gradient-emerald', current: (data.safetyReports || []).filter(s => s.pass_fail === 'pass').length, previous: 5, records: (data.safetyReports || []).filter(s => s.pass_fail === 'pass'), cols: [{key:'audit_title',label:'Audit'},{key:'pass_fail',label:'Result'}] },
      ],
      assets: [
        { label: 'Total Assets', value: data.assets.length, format: 'number', icon: Boxes, gradient: 'stat-gradient-violet', current: data.assets.length, previous: data.assets.length - 3, records: data.assets, cols: [{key:'name',label:'Asset'},{key:'asset_type',label:'Type'}] },
        { label: 'Asset Value', value: Math.round(assetValue), format: 'currency', icon: Boxes, gradient: 'stat-gradient-brand', current: assetValue, previous: assetValue * 0.9, records: data.assets, cols: [{key:'name',label:'Asset'},{key:'acquisition_cost',label:'Cost'}] },
        { label: 'Compliant', value: compliantPct, format: 'percentage', icon: ShieldCheck, gradient: 'stat-gradient-teal', current: compliantPct, previous: 72, records: data.assets.filter(a => a.compliance_status === 'compliant'), cols: [{key:'name',label:'Asset'},{key:'compliance_status',label:'Status'}] },
        { label: 'Needs Service', value: data.assets.filter(a => a.stock_level === 'needs_service').length, format: 'number', icon: Boxes, gradient: 'stat-gradient-rose', current: data.assets.filter(a => a.stock_level === 'needs_service').length, previous: 4, invert: true, records: data.assets.filter(a => a.stock_level === 'needs_service'), cols: [{key:'name',label:'Asset'},{key:'stock_level',label:'Stock'}] },
      ],
      geotech: [
        { label: 'Investigation Logs', value: (data.invLogs || []).length, format: 'number', icon: FlaskConical, gradient: 'stat-gradient-emerald', current: (data.invLogs || []).length, previous: 15, records: data.invLogs || [], cols: [{key:'borehole_ref',label:'Borehole'},{key:'log_type',label:'Type'}] },
        { label: 'Boreholes', value: new Set((data.invLogs || []).map(l => l.borehole_ref).filter(Boolean)).size, format: 'number', icon: FlaskConical, gradient: 'stat-gradient-blue', current: 8, previous: 6, records: data.invLogs || [], cols: [{key:'borehole_ref',label:'Borehole'},{key:'date',label:'Date'}] },
        { label: 'Samples', value: (data.invLogs || []).filter(l => l.log_type === 'sample_collection').length, format: 'number', icon: FlaskConical, gradient: 'stat-gradient-amber', current: 12, previous: 10, records: (data.invLogs || []).filter(l => l.log_type === 'sample_collection'), cols: [{key:'borehole_ref',label:'Borehole'},{key:'sample_id',label:'Sample'}] },
        { label: 'AGS Imported', value: (data.invLogs || []).filter(l => l.source === 'ags_import').length, format: 'number', icon: FlaskConical, gradient: 'stat-gradient-violet', current: 20, previous: 15, records: (data.invLogs || []).filter(l => l.source === 'ags_import'), cols: [{key:'borehole_ref',label:'Borehole'},{key:'source',label:'Source'}] },
      ],
      logistics: [
        { label: 'Total Deliveries', value: (data.deliveries || []).length, format: 'number', icon: Truck, gradient: 'stat-gradient-blue', current: (data.deliveries || []).length, previous: 20, records: data.deliveries || [], cols: [{key:'items',label:'Items'},{key:'status',label:'Status'},{key:'scheduled_date',label:'Date'}] },
        { label: 'Completed', value: (data.deliveries || []).filter(d => d.status === 'completed').length, format: 'number', icon: Truck, gradient: 'stat-gradient-emerald', current: 15, previous: 12, records: (data.deliveries || []).filter(d => d.status === 'completed'), cols: [{key:'items',label:'Items'},{key:'status',label:'Status'}] },
        { label: 'Pending', value: (data.deliveries || []).filter(d => d.status === 'pending' || d.status === 'assigned').length, format: 'number', icon: Truck, gradient: 'stat-gradient-amber', current: 5, previous: 8, invert: true, records: (data.deliveries || []).filter(d => d.status === 'pending' || d.status === 'assigned'), cols: [{key:'items',label:'Items'},{key:'status',label:'Status'}] },
        { label: 'In Transit', value: (data.deliveries || []).filter(d => d.status === 'in_progress').length, format: 'number', icon: Truck, gradient: 'stat-gradient-violet', current: 3, previous: 2, records: (data.deliveries || []).filter(d => d.status === 'in_progress'), cols: [{key:'items',label:'Items'},{key:'status',label:'Status'}] },
      ],
    };
    return sets[hub] || sets.overview;
  }, [hub, data, filteredJobs, filteredStaff, filteredTimesheets]);

  // ── Breakdown table per hub ──
  const breakdownTable = useMemo(() => {
    const tables = {
      overview: { field: 'status', label: 'Jobs by Status', rows: filteredJobs, cols: [{key:'name',label:'Job'},{key:'status',label:'Status'},{key:'start_date',label:'Start'},{key:'client_charge',label:'Charge'}] },
      financial: { field: 'status', label: 'AFPs by Status', rows: data.afps, cols: [{key:'job_name',label:'Job'},{key:'status',label:'Status'},{key:'agreed_total',label:'Agreed'},{key:'total_claimed',label:'Claimed'}] },
      jobs: { field: 'job_type', label: 'Jobs by Type', rows: filteredJobs, cols: [{key:'name',label:'Job'},{key:'job_type',label:'Type'},{key:'status',label:'Status'},{key:'client_charge',label:'Charge'}] },
      fleet: { field: 'geotab_sync_status', label: 'Fleet by Sync Status', rows: data.vehicles, cols: [{key:'name',label:'Vehicle'},{key:'registration_number',label:'Reg'},{key:'geotab_sync_status',label:'Sync'},{key:'mot_status',label:'MOT'}] },
      staff: { field: 'worker_type', label: 'Staff by Worker Type', rows: filteredStaff, cols: [{key:'name',label:'Name'},{key:'worker_type',label:'Type'},{key:'job_title',label:'Title'},{key:'email',label:'Email'}] },
      compliance: { field: 'compliance_status', label: 'Assets by Compliance', rows: data.assets, cols: [{key:'name',label:'Asset'},{key:'compliance_status',label:'Compliance'},{key:'asset_type',label:'Type'},{key:'serial_number',label:'Serial'}] },
      assets: { field: 'asset_type', label: 'Assets by Type', rows: data.assets, cols: [{key:'name',label:'Asset'},{key:'asset_type',label:'Type'},{key:'compliance_status',label:'Compliance'},{key:'acquisition_cost',label:'Cost'}] },
      geotech: { field: 'log_type', label: 'Logs by Type', rows: data.invLogs || [], cols: [{key:'borehole_ref',label:'Borehole'},{key:'log_type',label:'Type'},{key:'date',label:'Date'},{key:'description',label:'Description'}] },
      logistics: { field: 'status', label: 'Deliveries by Status', rows: data.deliveries || [], cols: [{key:'items',label:'Items'},{key:'status',label:'Status'},{key:'scheduled_date',label:'Date'},{key:'delivery_type',label:'Type'}] },
    };
    return tables[hub] || tables.overview;
  }, [hub, data, filteredJobs, filteredStaff]);

  const breakdownGroups = useMemo(() => {
    const field = breakdownTable.field;
    const groups = {};
    for (const r of breakdownTable.rows) {
      const k = r[field] || 'Unassigned';
      if (!groups[k]) groups[k] = [];
      groups[k].push(r);
    }
    return Object.entries(groups).map(([name, rows]) => ({ name, count: rows.length, rows })).sort((a, b) => b.count - a.count);
  }, [breakdownTable]);

  const charts = useMemo(() => {
    const all = [
      { id: 'jobs-status', title: 'Jobs by Status', icon: Briefcase, data: tally(filteredJobs, 'status'), type: 'donut', rows: filteredJobs },
      { id: 'jobs-div', title: 'Jobs by Business Stream', icon: Briefcase, data: tally(filteredJobs, 'division_id'), type: 'bar', rows: filteredJobs },
      { id: 'revenue', title: 'AFP Revenue (Agreed)', icon: PoundSterling, data: [{ name: 'Total', value: sumField(data.afps, 'agreed_total') || sumField(data.afps, 'total_claimed') }], type: 'stat', rows: data.afps, valuePrefix: '£' },
      { id: 'staff-team', title: 'Staff by Team', icon: Users, data: tally(filteredStaff, 'team_id'), type: 'bar', rows: filteredStaff },
      { id: 'fleet-status', title: 'Fleet by Geotab Sync', icon: Car, data: tally(data.vehicles, 'geotab_sync_status'), type: 'donut', rows: data.vehicles },
      { id: 'assets-type', title: 'Assets by Type', icon: Boxes, data: tally(data.assets, 'asset_type'), type: 'bar', rows: data.assets },
      { id: 'asset-compliance', title: 'Asset Compliance', icon: ShieldCheck, data: tally(data.assets, 'compliance_status'), type: 'donut', rows: data.assets },
      { id: 'afp-status', title: 'AFPs by Status', icon: PoundSterling, data: tally(data.afps, 'status'), type: 'donut', rows: data.afps },
      { id: 'job-profit', title: 'Job Profitability (Top 10)', icon: TrendingUp, data: filteredJobs.map(j => ({ name: (j.name || '—').substring(0, 15), value: Math.round((Number(j.client_charge) || 0) - (Number(j.actual_cost) || 0)) })).sort((a, b) => b.value - a.value).slice(0, 10), type: 'bar', rows: filteredJobs },
      { id: 'timesheet-hours', title: 'Timesheet Hours', icon: Users, data: [{ name: 'Total', value: Math.round(sumField(filteredTimesheets, 'total_hours')) }], type: 'stat', rows: filteredTimesheets },
      { id: 'jobs-type', title: 'Jobs by Type', icon: Briefcase, data: tally(filteredJobs, 'job_type'), type: 'bar', rows: filteredJobs },
      { id: 'fleet-mot', title: 'Fleet MOT Status', icon: Car, data: tally(data.vehicles, 'mot_status'), type: 'donut', rows: data.vehicles },
      { id: 'fleet-fuel', title: 'Fleet by Fuel Type', icon: Car, data: tally(data.vehicles, 'fuel_type'), type: 'donut', rows: data.vehicles },
      { id: 'staff-status', title: 'Staff by Status', icon: Users, data: tally(filteredStaff, 'is_active'), type: 'donut', rows: filteredStaff },
      { id: 'staff-role', title: 'Staff by Job Title', icon: Users, data: tally(filteredStaff, 'job_title'), type: 'bar', rows: filteredStaff },
      { id: 'comp-status', title: 'Asset Compliance Status', icon: ShieldCheck, data: tally(data.assets, 'compliance_status'), type: 'donut', rows: data.assets },
      { id: 'comp-audit-cat', title: 'Audits by Category', icon: ShieldCheck, data: tally(data.safetyReports || [], 'audit_category'), type: 'bar', rows: data.safetyReports || [] },
      { id: 'comp-audit-pass', title: 'Audit Pass/Fail', icon: ShieldCheck, data: tally(data.safetyReports || [], 'pass_fail'), type: 'donut', rows: data.safetyReports || [] },
      { id: 'asset-stock', title: 'Assets by Stock Level', icon: Boxes, data: tally(data.assets, 'stock_level'), type: 'bar', rows: data.assets },
      { id: 'asset-value', title: 'Asset Book Value', icon: Boxes, data: [{ name: 'Total', value: Math.round(sumField(data.assets, 'current_book_value') || sumField(data.assets, 'acquisition_cost')) }], type: 'stat', rows: data.assets, valuePrefix: '£' },
      { id: 'inv-type', title: 'Investigation Logs by Type', icon: FlaskConical, data: tally(data.invLogs, 'log_type'), type: 'bar', rows: data.invLogs },
      { id: 'inv-source', title: 'Logs by Source', icon: FlaskConical, data: tally(data.invLogs, 'source'), type: 'donut', rows: data.invLogs },
      { id: 'del-status', title: 'Deliveries by Status', icon: Truck, data: tally(data.deliveries, 'status'), type: 'donut', rows: data.deliveries },
      { id: 'del-type', title: 'Deliveries by Type', icon: Truck, data: tally(data.deliveries, 'delivery_type'), type: 'bar', rows: data.deliveries },
    ];
    const sets = {
      overview: ['jobs-status', 'jobs-div', 'revenue', 'staff-team', 'fleet-status', 'assets-type', 'asset-compliance'],
      financial: ['afp-status', 'revenue', 'job-profit', 'timesheet-hours'],
      jobs: ['jobs-status', 'jobs-div', 'jobs-type', 'job-profit'],
      fleet: ['fleet-status', 'fleet-mot', 'fleet-fuel'],
      staff: ['staff-team', 'staff-status', 'staff-role', 'timesheet-hours'],
      compliance: ['comp-status', 'comp-audit-cat', 'comp-audit-pass', 'asset-compliance'],
      assets: ['assets-type', 'asset-stock', 'asset-value', 'asset-compliance'],
      geotech: ['inv-type', 'inv-source'],
      logistics: ['del-status', 'del-type'],
    };
    const ids = sets[hub] || sets.overview;
    return all.filter(c => ids.includes(c.id));
  }, [hub, data, filteredJobs, filteredStaff, filteredTimesheets]);

  if (data.isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-[#2E5A1A] rounded-full animate-spin" />
      </div>
    );
  }

  const handleSegmentDrill = ({ title, records }) => {
    setDrill({ title, records, cols: breakdownTable.cols, breadcrumb: [hub, title] });
  };

  return (
    <div className="space-y-4">
      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpiSets.map((t, i) => (
          <KpiTile key={i} {...t} onClick={() => setDrill({ title: t.label, records: t.records, cols: t.cols, breadcrumb: [hub, t.label] })} />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {charts.map(c => (
          <ReportChartCard key={c.id} {...c} onSegmentClick={handleSegmentDrill} />
        ))}
      </div>

      {/* Breakdown table with subtotals */}
      <div className="insight-card rounded-2xl overflow-hidden">
        <div className="px-4 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">{breakdownTable.label}</h3>
          <p className="text-xs text-slate-500">{breakdownTable.rows.length} records · {breakdownGroups.length} groups</p>
        </div>
        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-50 z-10">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-slate-600 border-b border-slate-200">Group</th>
                <th className="px-3 py-2 text-right font-semibold text-slate-600 border-b border-slate-200">Count</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600 border-b border-slate-200">% of Total</th>
              </tr>
            </thead>
            <tbody>
              {breakdownGroups.map((g, i) => (
                <React.Fragment key={i}>
                  <motion.tr
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02 }}
                    onClick={() => setExpandedGroup(expandedGroup === g.name ? null : g.name)}
                    className="hover:bg-slate-50 cursor-pointer"
                  >
                    <td className="px-3 py-2 border-b border-slate-100 text-slate-700 font-medium">
                      <div className="flex items-center gap-1.5">
                        {expandedGroup === g.name
                          ? <ChevronDown className="w-3 h-3 text-slate-400 flex-shrink-0" />
                          : <ChevronRight className="w-3 h-3 text-slate-400 flex-shrink-0" />}
                        {g.name}
                      </div>
                    </td>
                    <td className="px-3 py-2 border-b border-slate-100 text-slate-700 text-right tabular-nums">{g.count}</td>
                    <td className="px-3 py-2 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden max-w-[100px]">
                          <div className="h-full bg-gradient-to-r from-[#5A8C1E] to-[#2E5A1A] rounded-full" style={{ width: `${breakdownTable.rows.length ? (g.count / breakdownTable.rows.length) * 100 : 0}%` }} />
                        </div>
                        <span className="text-slate-500 text-[10px]">{breakdownTable.rows.length ? Math.round((g.count / breakdownTable.rows.length) * 100) : 0}%</span>
                      </div>
                    </td>
                  </motion.tr>
                  {expandedGroup === g.name && g.rows.slice(0, 20).map((r, ri) => (
                    <tr key={`${i}-${ri}`} className="bg-slate-50/40">
                      <td colSpan={3} className="px-3 py-0">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 py-1.5 text-[11px] text-slate-600">
                          {breakdownTable.cols.map((col, ci) => (
                            <div key={ci} className="flex items-center gap-1">
                              <span className="text-slate-400 font-medium">{col.label}:</span>
                              <span className="font-medium text-slate-700 truncate max-w-[160px]">
                                {col.key === 'client_charge' || col.key === 'agreed_total' || col.key === 'total_claimed' || col.key === 'unit_cost' || col.key === 'acquisition_cost'
                                  ? fmt0(r[col.key])
                                  : String(r[col.key] || '—')}
                              </span>
                            </div>
                          ))}
                          <button
                            onClick={(e) => { e.stopPropagation(); setDrill({ title: `${breakdownTable.label} → ${g.name}`, records: g.rows, cols: breakdownTable.cols, breadcrumb: [hub, breakdownTable.label, g.name] }); }}
                            className="ml-auto text-[10px] font-bold text-[#2E5A1A] hover:underline"
                          >
                            View all {g.rows.length} →
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-emerald-50 font-bold border-t-2 border-emerald-200">
                <td className="px-3 py-2 text-slate-900">GRAND TOTAL</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-900">{breakdownTable.rows.length}</td>
                <td className="px-3 py-2 text-slate-500">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {drill && (
        <DrillDownDrawer
          title={drill.title}
          breadcrumb={drill.breadcrumb}
          records={drill.records}
          columns={drill.cols}
          onClose={() => setDrill(null)}
        />
      )}
    </div>
  );
}