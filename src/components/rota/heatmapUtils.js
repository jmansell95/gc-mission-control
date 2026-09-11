import { format, addDays, isWeekend, startOfYear } from 'date-fns';

// Extended status config — adds 'maintenance' for rigs
export const STATUS_CONFIG = {
  job:          { bg: 'bg-emerald-500', label: 'On Job',      hex: '#10b981' },
  annual_leave: { bg: 'bg-blue-400',    label: 'Leave',       hex: '#3b82f6' },
  sick:         { bg: 'bg-rose-400',    label: 'Sick',        hex: '#f43f5e' },
  training:     { bg: 'bg-amber-400',   label: 'Training',    hex: '#f59e0b' },
  yard_depot:   { bg: 'bg-slate-400',   label: 'Depot',       hex: '#64748b' },
  maintenance:  { bg: 'bg-violet-500',  label: 'Maintenance', hex: '#8b5cf6' },
  available:    { bg: 'bg-slate-100',   label: 'Available',   hex: '#e2e8f0' },
  planning:     { bg: 'bg-planning',    label: 'Planning',   hex: '#f59e0b' },
};

export const STATUS_ORDER = ['job', 'annual_leave', 'sick', 'training', 'yard_depot', 'maintenance', 'planning', 'available'];

// Build per-resource per-day status maps from the backend matrix data.
// Priority: non-job assignment > absence > job assignment > available.
export function buildStatusMaps(data) {
  if (!data) return { staffStatus: new Map(), rigStatus: new Map() };

  const staffStatus = new Map();
  const rigStatus = new Map();
  (data.staff || []).forEach(s => staffStatus.set(s.id, new Map()));
  (data.rigs || []).forEach(r => rigStatus.set(r.id, new Map()));

  // 1. Non-job assignments (leave, sick, training, depot) — highest priority
  (data.assignments || []).forEach(a => {
    if (!a.assigned_date || !a.staff_id) return;
    const sm = staffStatus.get(a.staff_id);
    if (!sm) return;
    if (a.assignment_type !== 'job') {
      sm.set(a.assigned_date, {
        type: a.assignment_type,
        label: a.non_job_label || STATUS_CONFIG[a.assignment_type]?.label || '',
        job_name: '', job_reference: '',
      });
    }
  });

  // 2. Approved absences — only if no non-job assignment already set
  (data.absences || []).forEach(abs => {
    if (!abs.staff_id || !staffStatus.has(abs.staff_id)) return;
    const sm = staffStatus.get(abs.staff_id);
    const start = abs.start_date;
    const end = abs.end_date || start;
    if (!start || !end) return;
    let d = new Date(start + 'T00:00:00');
    const e = new Date(end + 'T00:00:00');
    while (d <= e) {
      const ds = d.toISOString().slice(0, 10);
      if (!sm.has(ds)) {
        const reason = abs.reason || 'holiday';
        const type = reason === 'sick' ? 'sick' : reason === 'training' ? 'training' : 'annual_leave';
        sm.set(ds, { type, label: type === 'sick' ? 'Sick' : type === 'training' ? 'Training' : 'AL', job_name: '', job_reference: '' });
      }
      d = addDays(d, 1);
    }
  });

  // 3. Job assignments — only if no status set yet
  (data.assignments || []).forEach(a => {
    if (!a.assigned_date) return;
    if (a.staff_id && staffStatus.has(a.staff_id) && a.assignment_type === 'job') {
      const sm = staffStatus.get(a.staff_id);
      if (!sm.has(a.assigned_date)) {
        sm.set(a.assigned_date, { type: 'job', label: 'Job', job_name: a.job_name || '', job_reference: a.job_reference || '' });
      }
    }
    if (a.rig_asset_id && rigStatus.has(a.rig_asset_id)) {
      const rm = rigStatus.get(a.rig_asset_id);
      rm.set(a.assigned_date, { type: 'job', label: 'On Job', job_name: a.job_name || '', job_reference: a.job_reference || '', crew_role: a.crew_role || '' });
    }
  });

  // 4. Maintenance — only if no job set
  (data.maintenance || []).forEach(m => {
    if (!m.asset_id || !rigStatus.has(m.asset_id)) return;
    const rm = rigStatus.get(m.asset_id);
    if (m.service_date && !rm.has(m.service_date)) {
      rm.set(m.service_date, { type: 'maintenance', label: 'Service', job_name: '', job_reference: '' });
    }
  });

  // 5. Planning blocks — lowest priority, only fill empty gaps.
  //    Tentative crew + tentative rig get a 'planning' ghost cell so planners
  //    can see where a potential job might sit without committing a real rota.
  (data.planning_blocks || []).forEach(pb => {
    if (!pb.start_date || !pb.end_date) return;
    let d = new Date(pb.start_date + 'T00:00:00');
    const e = new Date(pb.end_date + 'T00:00:00');
    while (d <= e) {
      const ds = d.toISOString().slice(0, 10);
      (pb.tentative_crew_ids || []).forEach(sid => {
        if (!staffStatus.has(sid)) return;
        const sm = staffStatus.get(sid);
        if (!sm.has(ds)) {
          sm.set(ds, { type: 'planning', label: 'Planning', job_name: pb.name || 'Tentative', block_id: pb.id, block_name: pb.name || '' });
        }
      });
      if (pb.rig_asset_id && rigStatus.has(pb.rig_asset_id)) {
        const rm = rigStatus.get(pb.rig_asset_id);
        if (!rm.has(ds)) {
          rm.set(ds, { type: 'planning', label: 'Planning', job_name: pb.name || 'Tentative', block_id: pb.id, block_name: pb.name || '' });
        }
      }
      d = addDays(d, 1);
    }
  });

  return { staffStatus, rigStatus };
}

// Count days in each status category for a resource
export function getRowSummary(statusMap, days) {
  const counts = { job: 0, annual_leave: 0, sick: 0, training: 0, yard_depot: 0, maintenance: 0, planning: 0, available: 0 };
  days.forEach(d => {
    const s = statusMap.get(d.dateStr);
    if (s) counts[s.type] = (counts[s.type] || 0) + 1;
    else counts.available++;
  });
  return counts;
}

// Build the days array for a year
export function getYearDays(year) {
  const jan1 = startOfYear(new Date(year, 0, 1));
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const numDays = isLeap ? 366 : 365;
  return Array.from({ length: numDays }).map((_, i) => {
    const date = addDays(jan1, i);
    return {
      dateStr: format(date, 'yyyy-MM-dd'),
      date,
      day: format(date, 'd'),
      month: format(date, 'MMM'),
      monthNum: date.getMonth(),
      quarter: Math.floor(date.getMonth() / 3) + 1,
      isWeekend: isWeekend(date),
      isToday: format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd'),
    };
  });
}

// Build the days array for a single month
export function getMonthDays(year, month) {
  const start = new Date(year, month, 1);
  const numDays = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: numDays }).map((_, i) => {
    const date = addDays(start, i);
    return {
      dateStr: format(date, 'yyyy-MM-dd'),
      date,
      day: format(date, 'd'),
      weekday: format(date, 'EEE'),
      weekdayNum: date.getDay(),
      monthNum: date.getMonth(),
      isWeekend: isWeekend(date),
      isToday: format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd'),
    };
  });
}

// Build the days array for a single week (starting Monday)
export function getWeekDays(weekStart) {
  return Array.from({ length: 7 }).map((_, i) => {
    const date = addDays(weekStart, i);
    return {
      dateStr: format(date, 'yyyy-MM-dd'),
      date,
      day: format(date, 'd'),
      dayNum: date.getDate(),
      weekday: format(date, 'EEE'),
      weekdayNum: date.getDay(),
      monthNum: date.getMonth(),
      isWeekend: isWeekend(date),
      isToday: format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd'),
    };
  });
}

// Compute analytics for a set of resources across a range of days.
// Returns team-wide counts + per-resource stats with utilization %.
export function computeRangeAnalytics(staffRows, rigRows, staffStatus, rigStatus, days) {
  let jobCount = 0, leaveCount = 0, availableCount = 0, maintenanceCount = 0;
  const resourceStats = [];

  const allRows = [
    ...staffRows.map(s => ({ resource: s, statusMap: staffStatus.get(s.id) || new Map(), isRig: false })),
    ...rigRows.map(r => ({ resource: r, statusMap: rigStatus.get(r.id) || new Map(), isRig: true })),
  ];

  for (const { resource, statusMap, isRig } of allRows) {
    let job = 0, leave = 0, available = 0, maintenance = 0;
    for (const d of days) {
      if (d.isWeekend) continue;
      const s = statusMap.get(d.dateStr);
      if (s) {
        if (s.type === 'job') job++;
        else if (s.type === 'maintenance') maintenance++;
        else if (s.type === 'planning') available++; // tentative blocks don't count as booked
        else leave++;
      } else {
        available++;
      }
    }
    jobCount += job; leaveCount += leave; availableCount += available; maintenanceCount += maintenance;
    const workDays = job + available;
    const util = workDays > 0 ? Math.round((job / workDays) * 100) : 0;
    resourceStats.push({ resource, isRig, job, leave, available, maintenance, util });
  }

  const totalWorkable = jobCount + availableCount;
  const utilPct = totalWorkable > 0 ? Math.round((jobCount / totalWorkable) * 100) : 0;
  return { jobCount, leaveCount, availableCount, maintenanceCount, utilPct, resourceStats };
}

// Find resources that are completely free (no assignment) across a date range.
export function findAvailableResources(staffRows, rigRows, staffStatus, rigStatus, dateFrom, dateTo) {
  if (!dateFrom || !dateTo) return [];
  const days = [];
  let d = new Date(dateFrom + 'T00:00:00');
  const end = new Date(dateTo + 'T00:00:00');
  while (d <= end) {
    days.push(d.toISOString().slice(0, 10));
    d = addDays(d, 1);
  }

  const results = [];
  for (const s of staffRows) {
    const sm = staffStatus.get(s.id) || new Map();
    if (days.every(ds => !sm.has(ds) || sm.get(ds)?.type === 'available')) {
      results.push({ ...s, type: 'staff' });
    }
  }
  for (const r of rigRows) {
    const rm = rigStatus.get(r.id) || new Map();
    if (days.every(ds => !rm.has(ds) || rm.get(ds)?.type === 'available')) {
      results.push({ ...r, type: 'rig' });
    }
  }
  return results;
}

// ── Worker-type grouping for the Resource Planner ──────────────────────────
// Staff rows are grouped into three collapsible sections: Direct Employees,
// Subcontractors, Agency Workers — each with a count badge.
export const WORKER_TYPE_GROUPS = [
  { key: 'direct_employee', label: 'Direct Employees', shortLabel: 'Direct', color: 'text-[#2E5A1A]' },
  { key: 'subcontractor', label: 'Subcontractors', shortLabel: 'Subbies', color: 'text-amber-600' },
  { key: 'agency', label: 'Agency Workers', shortLabel: 'Agency', color: 'text-violet-600' },
];

export function groupStaffByWorkerType(staffRows) {
  const groups = { direct_employee: [], subcontractor: [], agency: [] };
  (staffRows || []).forEach(s => {
    const wt = s.worker_type || 'direct_employee';
    if (groups[wt]) groups[wt].push(s);
    else groups.direct_employee.push(s);
  });
  return groups;
}