// ============================================================
// Driller Productivity Report — aggregates per-driller operational
// + financial data from InvestigationLog records across a date range.
// Builds PDF sections and CSV rows for the Reporting Hub.
// ============================================================
import { base44 } from '@/api/base44Client';

function gbp(n) { return '£' + Math.round(Number(n) || 0).toLocaleString('en-GB'); }
function hrs(n) { return (Number(n) || 0).toFixed(1); }
function pct(n) { return (Number(n) || 0).toFixed(1) + '%'; }

function timeToMins(t) {
  if (!t) return null;
  const m = String(t).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

/**
 * Fetch and aggregate all InvestigationLog data for the selected filters.
 * Returns: { drillers, rigs, dailyData, boreholes, totals, rigCrewLinks }
 */
export async function buildDrillerProductivityReport(filters) {
  const { dateFrom, dateTo, divisionId, teamId, clientId, jobTypeId } = filters;

  const [logs, jobs, staff, rigs] = await Promise.all([
    base44.entities.InvestigationLog.filter({}, '-created_date', 2000),
    base44.entities.Job.filter({}, '-created_date', 500),
    base44.entities.Staff.filter({}, '-created_date', 500),
    base44.entities.SiteAsset.filter({ is_rig: true }, '-created_date', 500),
  ]);

  // Build job filter set
  let jobFilterFn = () => true;
  if (divisionId || clientId || jobTypeId) {
    jobFilterFn = (job) => {
      if (divisionId && job.division_id !== divisionId) return false;
      if (clientId && job.client_id !== clientId) return false;
      if (jobTypeId && job.job_type !== jobTypeId) return false;
      return true;
    };
  }
  const validJobIds = new Set(jobs.filter(jobFilterFn).map(j => j.id));
  const jobMap = new Map(jobs.map(j => [j.id, j]));

  // Filter staff by team
  let validStaffIds = null;
  if (teamId) {
    validStaffIds = new Set(staff.filter(s => s.team_id === teamId).map(s => s.id));
  }

  // Filter logs by date range + job
  let filteredLogs = logs.filter(log => {
    if (!validJobIds.has(log.job_id)) return false;
    if (dateFrom && log.date && log.date < dateFrom) return false;
    if (dateTo && log.date && log.date > dateTo) return false;
    return true;
  });

  // ── Per-driller aggregation ──
  const drillerMap = new Map();

  const getDriller = (name) => {
    if (!name) name = 'Unknown';
    if (!drillerMap.has(name)) {
      const staffRecord = staff.find(s => s.name === name);
      drillerMap.set(name, {
        name,
        staff_id: staffRecord?.id || '',
        day_rate: Number(staffRecord?.day_rate) || 0,
        jobs: new Set(),
        boreholes: new Set(),
        boreholesCompleted: new Set(),
        boreholesStarted: new Set(),
        totalMeterage: 0,
        drillingMinutes: 0,
        setupMinutes: 0,
        travelMinutes: 0,
        downtimeMinutes: 0,
        sptCount: 0,
        sampleCount: 0,
        coreCount: 0,
        strataCount: 0,
        chargeableRevenue: 0,
        logs: [],
        rigs: new Set(),
        dates: new Set(),
      });
    }
    return drillerMap.get(name);
  };

  // Classify an activity into drilling / setup / travel / downtime by description keywords
  function classifyActivity(desc) {
    const d = (desc || '').toLowerCase();
    if (/drill|bore|cable|percus|rotary|core|advance|penetrat/.test(d)) return 'drilling';
    if (/set.?up|rig.?up|assemble|install|prepare|start/.test(d)) return 'setup';
    if (/travel|drive|journey|depart|arrive|home|depot|yard/.test(d)) return 'travel';
    if (/lunch|break|wait|delay|down.?time|stand.?by|weather|issue|problem|repair/.test(d)) return 'downtime';
    return 'drilling'; // default to drilling for unclassified activities
  }

  for (const log of filteredLogs) {
    // Attribute to staff_name (primary driller) and each crew member
    const names = new Set();
    if (log.staff_name) names.add(log.staff_name);
    if (Array.isArray(log.crew_names)) log.crew_names.forEach(n => n && names.add(n));
    if (names.size === 0) names.add('Unknown');

    for (const name of names) {
      // Skip if team filter doesn't match
      if (validStaffIds) {
        const staffRecord = staff.find(s => s.name === name);
        if (staffRecord && !validStaffIds.has(staffRecord.id)) continue;
      }

      const d = getDriller(name);
      d.jobs.add(jobMap.get(log.job_id)?.name || log.job_id);
      d.dates.add(log.date);
      d.logs.push(log);

      if (log.device_name) d.rigs.add(log.device_name);

      if (log.borehole_ref) {
        d.boreholes.add(log.borehole_ref);
        if (log.borehole_status === 'complete') d.boreholesCompleted.add(log.borehole_ref);
        // Borehole "started" = has a borehole_progress log
        if (log.log_type === 'borehole_progress') d.boreholesStarted.add(log.borehole_ref);
      }

      // Meterage from borehole_progress logs (final depth)
      if (log.log_type === 'borehole_progress' && log.depth_to != null) {
        // Only count the final depth once per borehole (the LOCA log)
        d.totalMeterage = Math.max(d.totalMeterage, Number(log.depth_to) || 0);
      }

      // Time classification from keylogbook_remarks
      if (log.source === 'keylogbook_remarks' && log.duration_minutes) {
        const cat = classifyActivity(log.description);
        if (cat === 'drilling') d.drillingMinutes += log.duration_minutes;
        else if (cat === 'setup') d.setupMinutes += log.duration_minutes;
        else if (cat === 'travel') d.travelMinutes += log.duration_minutes;
        else d.downtimeMinutes += log.duration_minutes;
      }

      // Counts
      if (log.log_type === 'spt') d.sptCount++;
      if (log.log_type === 'sample_collection') d.sampleCount++;
      if (log.log_type === 'core_inspection') d.coreCount++;
      if (log.log_type === 'borehole_progress' && log.strata_descriptor) d.strataCount++;

      // Revenue
      if (log.chargeable && log.charge_amount) {
        d.chargeableRevenue += Number(log.charge_amount) || 0;
      }
    }
  }

  // Finalize driller data
  const drillers = [...drillerMap.values()].map(d => {
    const totalMinutes = d.drillingMinutes + d.setupMinutes + d.travelMinutes + d.downtimeMinutes;
    const daysWorked = d.dates.size;
    const labourCost = d.day_rate > 0 ? d.day_rate * daysWorked : 0;
    const margin = d.chargeableRevenue - labourCost;
    const utilisation = totalMinutes > 0 ? (d.drillingMinutes / totalMinutes) * 100 : 0;
    const avgMetersPerHour = d.drillingMinutes > 0 ? (d.totalMeterage / (d.drillingMinutes / 60)) : 0;

    return {
      name: d.name,
      staff_id: d.staff_id,
      day_rate: d.day_rate,
      jobCount: d.jobs.size,
      jobs: [...d.jobs],
      boreholeCount: d.boreholes.size,
      boreholesCompleted: d.boreholesCompleted.size,
      boreholesStarted: d.boreholesStarted.size,
      totalMeterage: d.totalMeterage,
      drillingMinutes: d.drillingMinutes,
      setupMinutes: d.setupMinutes,
      travelMinutes: d.travelMinutes,
      downtimeMinutes: d.downtimeMinutes,
      totalMinutes,
      utilisation,
      avgMetersPerHour,
      sptCount: d.sptCount,
      sampleCount: d.sampleCount,
      coreCount: d.coreCount,
      strataCount: d.strataCount,
      chargeableRevenue: d.chargeableRevenue,
      labourCost,
      margin,
      daysWorked,
      rigs: [...d.rigs],
      logCount: d.logs.length,
    };
  }).sort((a, b) => b.totalMeterage - a.totalMeterage);

  // ── Rig-crew linkage ──
  const rigCrewMap = new Map();
  for (const log of filteredLogs) {
    if (!log.device_name) continue;
    if (!rigCrewMap.has(log.device_name)) {
      const rigAsset = rigs.find(r => r.name === log.device_name);
      rigCrewMap.set(log.device_name, {
        rig: log.device_name,
        rig_id: rigAsset?.id || '',
        rig_type: rigAsset?.rig_type || '',
        crew: new Set(),
        boreholes: new Set(),
        dates: new Set(),
      });
    }
    const rc = rigCrewMap.get(log.device_name);
    if (log.staff_name) rc.crew.add(log.staff_name);
    if (Array.isArray(log.crew_names)) log.crew_names.forEach(n => n && rc.crew.add(n));
    if (log.borehole_ref) rc.boreholes.add(log.borehole_ref);
    if (log.date) rc.dates.add(log.date);
  }
  const rigCrewLinks = [...rigCrewMap.values()].map(rc => ({
    rig: rc.rig,
    rig_id: rc.rig_id,
    rig_type: rc.rig_type,
    crew: [...rc.crew].sort(),
    crewCount: rc.crew.size,
    boreholeCount: rc.boreholes.size,
    daysWorked: rc.dates.size,
  })).sort((a, b) => b.boreholeCount - a.boreholeCount);

  // ── Daily data (for timeline chart) ──
  const dailyMap = new Map();
  for (const log of filteredLogs) {
    if (!log.date) continue;
    if (!dailyMap.has(log.date)) {
      dailyMap.set(log.date, { date: log.date, meterage: 0, drillingMinutes: 0, activities: 0, drillers: new Set() });
    }
    const dd = dailyMap.get(log.date);
    if (log.log_type === 'borehole_progress' && log.depth_to != null) {
      dd.meterage = Math.max(dd.meterage, Number(log.depth_to) || 0);
    }
    if (log.source === 'keylogbook_remarks' && log.duration_minutes) {
      dd.drillingMinutes += log.duration_minutes;
    }
    dd.activities++;
    if (log.staff_name) dd.drillers.add(log.staff_name);
  }
  const dailyData = [...dailyMap.values()].map(d => ({
    date: d.date,
    meterage: d.meterage,
    drillingHours: d.drillingMinutes / 60,
    activities: d.activities,
    drillerCount: d.drillers.size,
  })).sort((a, b) => a.date.localeCompare(b.date));

  // ── Borehole summary ──
  const boreholeMap = new Map();
  for (const log of filteredLogs) {
    if (!log.borehole_ref) continue;
    if (!boreholeMap.has(log.borehole_ref)) {
      const job = jobMap.get(log.job_id);
      boreholeMap.set(log.borehole_ref, {
        ref: log.borehole_ref,
        job_name: job?.name || '',
        status: log.borehole_status || 'unchecked',
        drilling_method: log.drilling_method || 'unknown',
        final_depth: 0,
        crew: [],
        rig: log.device_name || '',
        start_date: log.borehole_start_date || '',
        end_date: log.borehole_end_date || '',
        spt_count: 0,
        sample_count: 0,
      });
    }
    const bh = boreholeMap.get(log.borehole_ref);
    if (log.depth_to != null && log.log_type === 'borehole_progress') {
      bh.final_depth = Math.max(bh.final_depth, Number(log.depth_to) || 0);
    }
    if (log.log_type === 'spt') bh.spt_count++;
    if (log.log_type === 'sample_collection') bh.sample_count++;
    if (log.staff_name && !bh.crew.includes(log.staff_name)) bh.crew.push(log.staff_name);
    if (Array.isArray(log.crew_names)) log.crew_names.forEach(n => n && !bh.crew.includes(n) && bh.crew.push(n));
    if (log.device_name && !bh.rig) bh.rig = log.device_name;
    if (log.borehole_status && bh.status === 'unchecked') bh.status = log.borehole_status;
  }
  const boreholes = [...boreholeMap.values()].sort((a, b) => a.ref.localeCompare(b.ref));

  // ── Totals ──
  const totals = {
    drillerCount: drillers.length,
    rigCount: rigCrewLinks.length,
    boreholeCount: boreholes.length,
    totalMeterage: drillers.reduce((s, d) => s + d.totalMeterage, 0),
    totalDrillingHours: drillers.reduce((s, d) => s + d.drillingMinutes, 0) / 60,
    totalRevenue: drillers.reduce((s, d) => s + d.chargeableRevenue, 0),
    totalLabourCost: drillers.reduce((s, d) => s + d.labourCost, 0),
    totalMargin: drillers.reduce((s, d) => s + d.margin, 0),
    totalSpt: drillers.reduce((s, d) => s + d.sptCount, 0),
    totalSamples: drillers.reduce((s, d) => s + d.sampleCount, 0),
    avgUtilisation: drillers.length > 0 ? drillers.reduce((s, d) => s + d.utilisation, 0) / drillers.length : 0,
  };

  return { drillers, rigCrewLinks, dailyData, boreholes, totals };
}

// ── PDF Sections ──
export function buildDrillerPdfSections(report) {
  const { drillers, rigCrewLinks, boreholes, totals } = report;

  const sections = [];

  // Summary KPI section
  sections.push({
    title: 'Executive Summary',
    columns: [
      { label: 'Metric', align: 'left', width: 3 },
      { label: 'Value', align: 'right', width: 2 },
    ],
    rows: [
      ['Drillers', String(totals.drillerCount)],
      ['Rigs', String(totals.rigCount)],
      ['Boreholes', String(totals.boreholeCount)],
      ['Total Meterage', `${totals.totalMeterage.toFixed(1)} m`],
      ['Total Drilling Hours', `${totals.totalDrillingHours.toFixed(1)} h`],
      ['Avg Utilisation', pct(totals.avgUtilisation)],
      ['SPT Tests', String(totals.totalSpt)],
      ['Samples', String(totals.totalSamples)],
      ['Chargeable Revenue', gbp(totals.totalRevenue)],
      ['Labour Cost', gbp(totals.totalLabourCost)],
      ['Net Margin', gbp(totals.totalMargin)],
    ],
    totals: null,
  });

  // Per-driller table
  sections.push({
    title: 'Driller Productivity Breakdown',
    columns: [
      { label: 'Driller', align: 'left', width: 2.5 },
      { label: 'Boreholes', align: 'center', width: 1 },
      { label: 'Meterage', align: 'right', width: 1 },
      { label: 'Drill Hrs', align: 'right', width: 1 },
      { label: 'Util %', align: 'right', width: 0.8 },
      { label: 'SPTs', align: 'center', width: 0.6 },
      { label: 'Samples', align: 'center', width: 0.8 },
      { label: 'Revenue', align: 'right', width: 1.2 },
      { label: 'Margin', align: 'right', width: 1.2 },
    ],
    rows: drillers.map(d => [
      d.name,
      String(d.boreholeCount),
      `${d.totalMeterage.toFixed(1)} m`,
      hrs(d.drillingMinutes / 60),
      pct(d.utilisation),
      String(d.sptCount),
      String(d.sampleCount),
      gbp(d.chargeableRevenue),
      gbp(d.margin),
    ]),
    totals: [
      'Total',
      String(totals.boreholeCount),
      `${totals.totalMeterage.toFixed(1)} m`,
      hrs(totals.totalDrillingHours),
      pct(totals.avgUtilisation),
      String(totals.totalSpt),
      String(totals.totalSamples),
      gbp(totals.totalRevenue),
      gbp(totals.totalMargin),
    ],
  });

  // Rig-crew linkage
  sections.push({
    title: 'Rig → Crew Linkage',
    columns: [
      { label: 'Rig', align: 'left', width: 2 },
      { label: 'Type', align: 'center', width: 1 },
      { label: 'Crew', align: 'left', width: 4 },
      { label: 'Boreholes', align: 'center', width: 1 },
      { label: 'Days', align: 'center', width: 1 },
    ],
    rows: rigCrewLinks.map(rc => [
      rc.rig,
      rc.rig_type === 'cp' ? 'CP' : rc.rig_type === 'rotary' ? 'Rotary' : '—',
      rc.crew.join(', ') || '—',
      String(rc.boreholeCount),
      String(rc.daysWorked),
    ]),
    totals: null,
  });

  // Borehole summary
  if (boreholes.length > 0) {
    const bhRows = boreholes.slice(0, 50); // cap for PDF
    sections.push({
      title: `Borehole Summary (${boreholes.length > 50 ? 'first 50 of ' : ''}${boreholes.length} total)`,
      columns: [
        { label: 'Ref', align: 'left', width: 1.8 },
        { label: 'Job', align: 'left', width: 2.5 },
        { label: 'Type', align: 'center', width: 0.8 },
        { label: 'Status', align: 'center', width: 1 },
        { label: 'Depth', align: 'right', width: 0.8 },
        { label: 'Rig', align: 'left', width: 1.5 },
        { label: 'Crew', align: 'left', width: 2.5 },
      ],
      rows: bhRows.map(bh => [
        bh.ref,
        bh.job_name || '—',
        bh.drilling_method === 'cp' ? 'CP' : bh.drilling_method === 'rotary' ? 'Rotary' : bh.drilling_method === 'window_sampling' ? 'WS' : '—',
        bh.status === 'complete' ? 'Complete' : bh.status === 'in_progress' ? 'In Progress' : 'Unchecked',
        `${bh.final_depth.toFixed(1)} m`,
        bh.rig || '—',
        bh.crew.join(', ') || '—',
      ]),
      totals: null,
    });
  }

  return sections;
}

// ── CSV Data ──
export function buildDrillerCsvData(report) {
  const { drillers, rigCrewLinks, boreholes } = report;

  // Sheet 1: Per-driller summary
  const drillerColumns = [
    { key: 'name', label: 'Driller' },
    { key: 'jobCount', label: 'Jobs' },
    { key: 'boreholeCount', label: 'Boreholes' },
    { key: 'boreholesCompleted', label: 'Completed' },
    { key: 'totalMeterage', label: 'Meterage (m)' },
    { key: 'drillingHours', label: 'Drilling Hours' },
    { key: 'setupHours', label: 'Setup Hours' },
    { key: 'travelHours', label: 'Travel Hours' },
    { key: 'downtimeHours', label: 'Downtime Hours' },
    { key: 'utilisation', label: 'Utilisation %' },
    { key: 'avgMetersPerHour', label: 'Avg m/hr' },
    { key: 'sptCount', label: 'SPTs' },
    { key: 'sampleCount', label: 'Samples' },
    { key: 'coreCount', label: 'Core Runs' },
    { key: 'chargeableRevenue', label: 'Revenue (GBP)' },
    { key: 'labourCost', label: 'Labour Cost (GBP)' },
    { key: 'margin', label: 'Margin (GBP)' },
    { key: 'daysWorked', label: 'Days Worked' },
    { key: 'rigs', label: 'Rigs' },
  ];
  const drillerRows = drillers.map(d => ({
    ...d,
    drillingHours: hrs(d.drillingMinutes / 60),
    setupHours: hrs(d.setupMinutes / 60),
    travelHours: hrs(d.travelMinutes / 60),
    downtimeHours: hrs(d.downtimeMinutes / 60),
    utilisation: d.utilisation.toFixed(1),
    avgMetersPerHour: d.avgMetersPerHour.toFixed(1),
    rigs: d.rigs.join('; '),
  }));

  // Sheet 2: Rig-crew linkage
  const rigColumns = [
    { key: 'rig', label: 'Rig' },
    { key: 'rig_type', label: 'Type' },
    { key: 'crew', label: 'Crew' },
    { key: 'crewCount', label: 'Crew Count' },
    { key: 'boreholeCount', label: 'Boreholes' },
    { key: 'daysWorked', label: 'Days Worked' },
  ];
  const rigRows = rigCrewLinks.map(rc => ({
    ...rc,
    crew: rc.crew.join('; '),
  }));

  // Sheet 3: Borehole summary
  const boreholeColumns = [
    { key: 'ref', label: 'Borehole Ref' },
    { key: 'job_name', label: 'Job' },
    { key: 'drilling_method', label: 'Method' },
    { key: 'status', label: 'Status' },
    { key: 'final_depth', label: 'Final Depth (m)' },
    { key: 'rig', label: 'Rig' },
    { key: 'crew', label: 'Crew' },
    { key: 'start_date', label: 'Start Date' },
    { key: 'end_date', label: 'End Date' },
    { key: 'spt_count', label: 'SPTs' },
    { key: 'sample_count', label: 'Samples' },
  ];
  const boreholeRows = boreholes.map(bh => ({
    ...bh,
    crew: bh.crew.join('; '),
  }));

  return [
    { filename: 'driller-productivity-summary.csv', columns: drillerColumns, rows: drillerRows },
    { filename: 'rig-crew-linkage.csv', columns: rigColumns, rows: rigRows },
    { filename: 'borehole-summary.csv', columns: boreholeColumns, rows: boreholeRows },
  ];
}