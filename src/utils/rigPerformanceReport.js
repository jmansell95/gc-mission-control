// ============================================================
// Rig Performance Report — aggregates per-rig operational + financial
// data across a date range. Builds PDF sections and CSV rows.
// ============================================================
import { base44 } from '@/api/base44Client';
import { findRigRateCardItem } from '@/components/logistics/rigRateMatcher';

function countWorkingDays(from, to) {
  if (!from || !to) return 0;
  let count = 0;
  let d = new Date(from + 'T00:00:00');
  const end = new Date(to + 'T00:00:00');
  while (d <= end) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

function countDays(from, to) {
  if (!from || !to) return 0;
  return Math.max(1, Math.round((new Date(to + 'T00:00:00') - new Date(from + 'T00:00:00')) / 86400000) + 1);
}

function gbp(n) { return Math.round(Number(n) || 0).toLocaleString('en-GB'); }
function pct(n) { return (Number(n) || 0).toFixed(1) + '%'; }
function hrs(n) { return (Number(n) || 0).toFixed(1); }

export async function buildRigPerformanceReport(filters) {
  const { dateFrom, dateTo, divisionId, teamId, clientId, jobTypeId } = filters;

  const [rotas, rigs, timesheets, rateCards, staff, jobs] = await Promise.all([
    base44.entities.RotaAssignment.filter({}, '-assigned_date', 2000),
    base44.entities.SiteAsset.filter({ asset_type: 'rig' }, '-created_date', 500),
    base44.entities.Timesheet.filter({}, '-created_date', 2000),
    base44.entities.RateCardItem.filter({}, '-created_date', 500),
    base44.entities.Staff.filter({}, '-created_date', 500),
    base44.entities.Job.filter({}, '-created_date', 500),
  ]);

  // Build job filter set for team/client/jobType filtering
  let jobFilterFn = () => true;
  if (clientId || jobTypeId) {
    jobFilterFn = (job) => {
      if (clientId && job.client_id !== clientId) return false;
      if (jobTypeId && job.job_type !== jobTypeId) return false;
      return true;
    };
  }
  const validJobIds = new Set(jobs.filter(jobFilterFn).map(j => j.id));

  // Filter staff by team
  let validStaffIds = null;
  if (teamId) {
    validStaffIds = new Set(staff.filter(s => s.team_id === teamId).map(s => s.id));
  }

  // Filter rotas by date range + division + job/staff filters
  let filteredRotas = rotas.filter(r => {
    if (!r.rig_asset_id) return false;
    if (dateFrom && r.assigned_date && r.assigned_date < dateFrom) return false;
    if (dateTo && r.assigned_date && r.assigned_date > dateTo) return false;
    if (divisionId) {
      const job = jobs.find(j => j.id === r.job_id);
      if (job && job.division_id !== divisionId) return false;
    }
    if (validJobIds.size > 0 && r.job_id && !validJobIds.has(r.job_id)) return false;
    if (validStaffIds && r.staff_id && !validStaffIds.has(r.staff_id)) return false;
    return true;
  });

  const workingDays = countWorkingDays(dateFrom, dateTo);
  const totalDays = countDays(dateFrom, dateTo);

  const rigData = rigs.map(rig => {
    const rigRotas = filteredRotas.filter(r => r.rig_asset_id === rig.id);
    const rigStaffIds = new Set(rigRotas.map(r => r.staff_id));
    const crewNames = [...rigStaffIds]
      .map(sid => staff.find(s => s.id === sid)?.name)
      .filter(Boolean);

    // Timesheets for this rig's crew in the date range
    const rigTimesheets = timesheets.filter(t =>
      rigStaffIds.has(t.staff_id) &&
      (!dateFrom || (t.date && t.date >= dateFrom)) &&
      (!dateTo || (t.date && t.date <= dateTo))
    );

    const totalMeterage = rigTimesheets.reduce((s, t) => s + (Number(t.meterage) || 0), 0);
    const totalHours = rigTimesheets.reduce((s, t) => s + (Number(t.total_hours) || 0), 0);
    const daysDeployed = new Set(rigRotas.map(r => r.assigned_date)).size;
    const utilizationPct = workingDays > 0 ? (daysDeployed / workingDays) * 100 : 0;

    // Rate card matching
    const rateItem = findRigRateCardItem(rig, rateCards);
    const dayRate = rateItem ? Number(rateItem.price) || 0 : 0;
    const dayRateRevenue = dayRate * daysDeployed;
    const meterageRate = 0;
    const meterageRevenue = totalMeterage * meterageRate;
    const totalRevenue = dayRateRevenue + meterageRevenue;

    // Costs
    const maintenanceCost = 0;
    const depreciation = (Number(rig.annual_depreciation) || 0) / 365 * totalDays;
    const totalCost = maintenanceCost + depreciation;
    const profit = totalRevenue - totalCost;
    const marginPct = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

    return {
      name: rig.name || '—',
      type: rig.rig_type === 'cp' ? 'CP' : rig.rig_type === 'rotary' ? 'Rotary' : 'N/A',
      totalMeterage,
      totalHours,
      crewNames: crewNames.join(', ') || '—',
      compliance: rig.compliance_status || 'unknown',
      utilizationPct,
      daysDeployed,
      dayRate,
      dayRateRevenue,
      meterageRevenue,
      totalRevenue,
      maintenanceCost,
      depreciation,
      totalCost,
      profit,
      marginPct,
    };
  });

  // Only include rigs with activity in the range
  const activeRigs = rigData
    .filter(r => r.daysDeployed > 0 || r.totalHours > 0)
    .sort((a, b) => b.totalRevenue - a.totalRevenue);

  // Totals
  const totals = {
    totalMeterage: activeRigs.reduce((s, r) => s + r.totalMeterage, 0),
    totalHours: activeRigs.reduce((s, r) => s + r.totalHours, 0),
    dayRateRevenue: activeRigs.reduce((s, r) => s + r.dayRateRevenue, 0),
    meterageRevenue: activeRigs.reduce((s, r) => s + r.meterageRevenue, 0),
    totalRevenue: activeRigs.reduce((s, r) => s + r.totalRevenue, 0),
    maintenanceCost: activeRigs.reduce((s, r) => s + r.maintenanceCost, 0),
    depreciation: activeRigs.reduce((s, r) => s + r.depreciation, 0),
    totalCost: activeRigs.reduce((s, r) => s + r.totalCost, 0),
    profit: activeRigs.reduce((s, r) => s + r.profit, 0),
    avgUtilization: activeRigs.length > 0 ? activeRigs.reduce((s, r) => s + r.utilizationPct, 0) / activeRigs.length : 0,
  };
  totals.marginPct = totals.totalRevenue > 0 ? (totals.profit / totals.totalRevenue) * 100 : 0;

  return { rigData: activeRigs, totals };
}

// ── Build PDF sections ──
export function buildRigPdfSections(report) {
  const { rigData, totals } = report;

  const operational = {
    title: 'Operational Data',
    columns: [
      { label: 'Rig Name', align: 'left', width: 2 },
      { label: 'Type', align: 'left', width: 0.8 },
      { label: 'Meterage (m)', align: 'right', width: 1.2 },
      { label: 'Hours', align: 'right', width: 0.8 },
      { label: 'Crew', align: 'left', width: 2 },
      { label: 'Compliance', align: 'left', width: 1 },
      { label: 'Days', align: 'right', width: 0.7 },
      { label: 'Util %', align: 'right', width: 0.8 },
    ],
    rows: rigData.map(r => [
      r.name, r.type, r.totalMeterage.toFixed(1), hrs(r.totalHours),
      r.crewNames, r.compliance, r.daysDeployed, pct(r.utilizationPct),
    ]),
    totals: ['Total', '', totals.totalMeterage.toFixed(1), hrs(totals.totalHours), '', '', '', pct(totals.avgUtilization)],
  };

  const financial = {
    title: 'Financial Breakdown',
    columns: [
      { label: 'Rig Name', align: 'left', width: 2 },
      { label: 'Day Rate Rev', align: 'right', width: 1.3 },
      { label: 'Meterage Rev', align: 'right', width: 1.3 },
      { label: 'Total Revenue', align: 'right', width: 1.3 },
      { label: 'Maintenance', align: 'right', width: 1.2 },
      { label: 'Depreciation', align: 'right', width: 1.2 },
      { label: 'Total Cost', align: 'right', width: 1.2 },
      { label: 'Profit', align: 'right', width: 1.2 },
      { label: 'Margin %', align: 'right', width: 1 },
    ],
    rows: rigData.map(r => [
      r.name, '£' + gbp(r.dayRateRevenue), '£' + gbp(r.meterageRevenue), '£' + gbp(r.totalRevenue),
      '£' + gbp(r.maintenanceCost), '£' + gbp(r.depreciation), '£' + gbp(r.totalCost),
      '£' + gbp(r.profit), pct(r.marginPct),
    ]),
    totals: ['Total', '£' + gbp(totals.dayRateRevenue), '£' + gbp(totals.meterageRevenue),
      '£' + gbp(totals.totalRevenue), '£' + gbp(totals.maintenanceCost), '£' + gbp(totals.depreciation),
      '£' + gbp(totals.totalCost), '£' + gbp(totals.profit), pct(totals.marginPct)],
  };

  const summary = {
    title: 'Per-Rig Summary',
    columns: [
      { label: 'Rig Name', align: 'left', width: 2 },
      { label: 'Total Revenue', align: 'right', width: 1.5 },
      { label: 'Total Cost', align: 'right', width: 1.5 },
      { label: 'Profit', align: 'right', width: 1.5 },
      { label: 'Margin %', align: 'right', width: 1 },
      { label: 'Util %', align: 'right', width: 1 },
      { label: 'Meterage (m)', align: 'right', width: 1.2 },
    ],
    rows: rigData.map(r => [
      r.name, '£' + gbp(r.totalRevenue), '£' + gbp(r.totalCost), '£' + gbp(r.profit),
      pct(r.marginPct), pct(r.utilizationPct), r.totalMeterage.toFixed(1),
    ]),
    totals: ['Total', '£' + gbp(totals.totalRevenue), '£' + gbp(totals.totalCost),
      '£' + gbp(totals.profit), pct(totals.marginPct), pct(totals.avgUtilization),
      totals.totalMeterage.toFixed(1)],
  };

  return [operational, financial, summary];
}

// ── Build CSV columns + rows ──
export function buildRigCsvData(report) {
  const { rigData, totals } = report;
  const columns = [
    { key: 'name', label: 'Rig Name' },
    { key: 'type', label: 'Type' },
    { key: 'meterage', label: 'Meterage (m)' },
    { key: 'hours', label: 'Hours Worked' },
    { key: 'crew', label: 'Crew' },
    { key: 'compliance', label: 'Compliance Status' },
    { key: 'days', label: 'Days Deployed' },
    { key: 'util', label: 'Utilization %' },
    { key: 'dayRateRev', label: 'Day Rate Revenue (GBP)' },
    { key: 'meterageRev', label: 'Meterage Revenue (GBP)' },
    { key: 'totalRev', label: 'Total Revenue (GBP)' },
    { key: 'maintenance', label: 'Maintenance Cost (GBP)' },
    { key: 'depreciation', label: 'Depreciation Cost (GBP)' },
    { key: 'totalCost', label: 'Total Cost (GBP)' },
    { key: 'profit', label: 'Profit (GBP)' },
    { key: 'margin', label: 'Margin %' },
  ];
  const rows = rigData.map(r => ({
    name: r.name, type: r.type, meterage: r.totalMeterage.toFixed(2), hours: r.totalHours.toFixed(2),
    crew: r.crewNames, compliance: r.compliance, days: r.daysDeployed, util: r.utilizationPct.toFixed(1),
    dayRateRev: Math.round(r.dayRateRevenue), meterageRev: Math.round(r.meterageRevenue),
    totalRev: Math.round(r.totalRevenue), maintenance: Math.round(r.maintenanceCost),
    depreciation: Math.round(r.depreciation), totalCost: Math.round(r.totalCost),
    profit: Math.round(r.profit), margin: r.marginPct.toFixed(1),
  }));
  const totalsRow = {
    name: 'TOTAL', type: '', meterage: totals.totalMeterage.toFixed(2), hours: totals.totalHours.toFixed(2),
    crew: '', compliance: '', days: '', util: totals.avgUtilization.toFixed(1),
    dayRateRev: Math.round(totals.dayRateRevenue), meterageRev: Math.round(totals.meterageRevenue),
    totalRev: Math.round(totals.totalRevenue), maintenance: Math.round(totals.maintenanceCost),
    depreciation: Math.round(totals.depreciation), totalCost: Math.round(totals.totalCost),
    profit: Math.round(totals.profit), margin: totals.marginPct.toFixed(1),
  };
  rows.push(totalsRow);
  return { columns, rows };
}