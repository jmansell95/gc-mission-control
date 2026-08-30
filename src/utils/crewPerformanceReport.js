// ============================================================
// Crew Performance Report — aggregates per-staff hours + earnings
// across a date range. Builds PDF sections and CSV rows.
// ============================================================
import { base44 } from '@/api/base44Client';

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

function gbp(n) { return Math.round(Number(n) || 0).toLocaleString('en-GB'); }
function pct(n) { return (Number(n) || 0).toFixed(1) + '%'; }
function hrs(n) { return (Number(n) || 0).toFixed(1); }

export async function buildCrewPerformanceReport(filters) {
  const { dateFrom, dateTo, divisionId, teamId, clientId, jobTypeId } = filters;

  const [timesheets, staff, jobs, teams] = await Promise.all([
    base44.entities.Timesheet.filter({}, '-created_date', 2000),
    base44.entities.Staff.filter({}, '-created_date', 500),
    base44.entities.Job.filter({}, '-created_date', 500),
    base44.entities.Team.filter({}, '-created_date', 500),
  ]);

  // Build job filter
  let validJobIds = null;
  if (clientId || jobTypeId) {
    validJobIds = new Set(
      jobs.filter(j => {
        if (clientId && j.client_id !== clientId) return false;
        if (jobTypeId && j.job_type !== jobTypeId) return false;
        return true;
      }).map(j => j.id)
    );
  }

  // Filter staff by division/team
  let validStaffIds = null;
  if (divisionId || teamId) {
    validStaffIds = new Set(
      staff.filter(s => {
        if (teamId && s.team_id !== teamId) return false;
        if (divisionId && s.division_id !== divisionId) return false;
        return true;
      }).map(s => s.id)
    );
  }

  // Filter timesheets
  const filteredTs = timesheets.filter(t => {
    if (dateFrom && t.date && t.date < dateFrom) return false;
    if (dateTo && t.date && t.date > dateTo) return false;
    if (validStaffIds && t.staff_id && !validStaffIds.has(t.staff_id)) return false;
    if (validJobIds && t.job_id && !validJobIds.has(t.job_id)) return false;
    return true;
  });

  // Aggregate per staff
  const byStaff = {};
  filteredTs.forEach(t => {
    const sid = t.staff_id;
    if (!sid) return;
    if (!byStaff[sid]) byStaff[sid] = { timesheets: [], jobIds: new Set() };
    byStaff[sid].timesheets.push(t);
    if (t.job_id) byStaff[sid].jobIds.add(t.job_id);
  });

  const workingDays = countWorkingDays(dateFrom, dateTo);
  const availableHours = workingDays * 8;

  const crewData = Object.entries(byStaff).map(([sid, data]) => {
    const member = staff.find(s => s.id === sid);
    if (!member) return null;

    const totalHours = data.timesheets.reduce((s, t) => s + (Number(t.total_hours) || 0), 0);
    const overtimeHours = data.timesheets.reduce((s, t) =>
      s + (t.is_overtime ? (Number(t.total_hours) || 0) : 0), 0);
    const jobsWorked = data.jobIds.size;
    const meterage = data.timesheets.reduce((s, t) => s + (Number(t.meterage) || 0), 0);
    const revenue = data.timesheets.reduce((s, t) => s + (Number(t.charge_amount) || 0), 0);
    const utilizationPct = availableHours > 0 ? (totalHours / availableHours) * 100 : 0;

    return {
      name: member.name || '—',
      jobTitle: member.job_title || '—',
      team: teams.find(t => t.id === member.team_id)?.name || '—',
      totalHours,
      overtimeHours,
      jobsWorked,
      meterage,
      revenue,
      utilizationPct,
    };
  }).filter(Boolean);

  crewData.sort((a, b) => b.revenue - a.revenue);

  const totals = {
    totalHours: crewData.reduce((s, r) => s + r.totalHours, 0),
    overtimeHours: crewData.reduce((s, r) => s + r.overtimeHours, 0),
    jobsWorked: crewData.reduce((s, r) => s + r.jobsWorked, 0),
    meterage: crewData.reduce((s, r) => s + r.meterage, 0),
    revenue: crewData.reduce((s, r) => s + r.revenue, 0),
    avgUtilization: crewData.length > 0 ? crewData.reduce((s, r) => s + r.utilizationPct, 0) / crewData.length : 0,
  };

  return { crewData, totals };
}

// ── Build PDF section ──
export function buildCrewPdfSection(report) {
  const { crewData, totals } = report;
  return {
    title: 'Crew Performance',
    columns: [
      { label: 'Staff Name', align: 'left', width: 2 },
      { label: 'Job Title', align: 'left', width: 1.5 },
      { label: 'Team', align: 'left', width: 1.5 },
      { label: 'Total Hours', align: 'right', width: 1 },
      { label: 'OT Hours', align: 'right', width: 0.9 },
      { label: 'Jobs', align: 'right', width: 0.7 },
      { label: 'Meterage (m)', align: 'right', width: 1.2 },
      { label: 'Revenue', align: 'right', width: 1.3 },
      { label: 'Util %', align: 'right', width: 0.8 },
    ],
    rows: crewData.map(r => [
      r.name, r.jobTitle, r.team, hrs(r.totalHours), hrs(r.overtimeHours),
      r.jobsWorked, r.meterage.toFixed(1), '£' + gbp(r.revenue), pct(r.utilizationPct),
    ]),
    totals: ['Total', '', '', hrs(totals.totalHours), hrs(totals.overtimeHours),
      totals.jobsWorked, totals.meterage.toFixed(1), '£' + gbp(totals.revenue), pct(totals.avgUtilization)],
  };
}

// ── Build CSV columns + rows ──
export function buildCrewCsvData(report) {
  const { crewData, totals } = report;
  const columns = [
    { key: 'name', label: 'Staff Name' },
    { key: 'jobTitle', label: 'Job Title' },
    { key: 'team', label: 'Team' },
    { key: 'totalHours', label: 'Total Hours' },
    { key: 'otHours', label: 'Overtime Hours' },
    { key: 'jobs', label: 'Jobs Worked' },
    { key: 'meterage', label: 'Meterage (m)' },
    { key: 'revenue', label: 'Revenue Earned (GBP)' },
    { key: 'util', label: 'Utilization %' },
  ];
  const rows = crewData.map(r => ({
    name: r.name, jobTitle: r.jobTitle, team: r.team,
    totalHours: r.totalHours.toFixed(2), otHours: r.overtimeHours.toFixed(2),
    jobs: r.jobsWorked, meterage: r.meterage.toFixed(2),
    revenue: Math.round(r.revenue), util: r.utilizationPct.toFixed(1),
  }));
  rows.push({
    name: 'TOTAL', jobTitle: '', team: '',
    totalHours: totals.totalHours.toFixed(2), otHours: totals.overtimeHours.toFixed(2),
    jobs: totals.jobsWorked, meterage: totals.meterage.toFixed(2),
    revenue: Math.round(totals.revenue), util: totals.avgUtilization.toFixed(1),
  });
  return { columns, rows };
}