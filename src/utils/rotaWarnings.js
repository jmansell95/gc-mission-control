import { format, addDays } from 'date-fns';
import { timeToMinutes, detectOverlaps, SITE_OPEN_TIME_MIN, SITE_CLOSE_TIME_MIN } from '@/utils/rotaScheduling';

// Depot staff work 07:00–16:00 (different from site hours 08:00–17:00)
const DEPOT_OPEN_TIME_MIN = 7 * 60;    // 420
const DEPOT_CLOSE_TIME_MIN = 16 * 60;  // 960

/**
 * Compute smart warnings for a published/draft rota week.
 * Returns an array of { severity, type, title, message } warnings.
 *
 * Checks:
 *  1. Double-booking — same staff assigned to 2+ different jobs on the same date
 *  2. Unstaffed active jobs — jobs requiring teams but with no assignments this week
 *  3. Leave conflicts — staff scheduled on an approved-leave or recurring day-off
 *  4. Time overlaps — two shifts for the same person on the same day with overlapping times
 *  5. Out-of-hours — a shift starting before 08:00 or ending after 17:00
 *  6. Excessive hours — a staff member with more than 9 worked hours in a day
 */
export function computeRotaWarnings({ weekStartStr, rotas = [], staff = [], jobs = [], absences = [], recurring = [] }) {
  const warnings = [];
  const weekEndDate = format(addDays(new Date(weekStartStr + 'T00:00:00'), 6), 'yyyy-MM-dd');
  const staffMap = Object.fromEntries(staff.map(s => [s.id, s]));

  // 1. Double-booking
  const byStaffDate = {};
  rotas.forEach(r => {
    const k = `${r.staff_id}|${r.assigned_date}`;
    (byStaffDate[k] ||= []).push(r);
  });
  Object.entries(byStaffDate).forEach(([key, items]) => {
    const [staffId, date] = key.split('|');
    const jobIds = [...new Set(items.map(r => r.job_id).filter(Boolean))];
    if (jobIds.length > 1) {
      const member = staffMap[staffId];
      warnings.push({
        severity: 'critical',
        type: 'double_booking',
        title: `${member?.name || 'Staff member'} double-booked`,
        message: `Scheduled on ${jobIds.length} different jobs on ${format(new Date(date + 'T00:00:00'), 'EEE dd MMM')}.`,
      });
    }
  });

  // 2. Unstaffed active jobs overlapping this week
  const activeJobs = jobs.filter(j => {
    if (['completed', 'cancelled', 'on_hold'].includes(j.status)) return false;
    if (!j.required_team_ids || j.required_team_ids.length === 0) return false;
    const jStart = j.start_date || '1900-01-01';
    const jEnd = j.end_date || '2999-12-31';
    return jStart <= weekEndDate && jEnd >= weekStartStr;
  });
  const assignedJobIds = new Set(rotas.map(r => r.job_id));
  activeJobs.forEach(j => {
    if (!assignedJobIds.has(j.id)) {
      warnings.push({
        severity: 'warning',
        type: 'unstaffed_job',
        title: `${j.name} — no crew scheduled`,
        message: `Active job requires teams but nobody is assigned in this rota week.`,
      });
    }
  });

  // 3. Leave / day-off conflicts
  const leaveState = (staffId, dateStr) => {
    const dow = new Date(dateStr + 'T00:00:00').getDay();
    const rec = recurring.find(r => r.staff_id === staffId && r.is_active !== false && Array.isArray(r.days_of_week) && r.days_of_week.includes(dow));
    if (rec) return rec.label || 'Day Off';
    const leave = absences.some(a => a.staff_id === staffId && a.status === 'approved' && a.start_date <= dateStr && a.end_date >= dateStr);
    if (leave) return 'On Leave';
    return null;
  };
  const seenLeave = new Set();
  rotas.forEach(r => {
    const ls = leaveState(r.staff_id, r.assigned_date);
    if (ls) {
      const key = `${r.staff_id}|${r.assigned_date}`;
      if (seenLeave.has(key)) return;
      seenLeave.add(key);
      const member = staffMap[r.staff_id];
      warnings.push({
        severity: 'warning',
        type: 'leave_conflict',
        title: `${member?.name || 'Staff member'} scheduled during ${ls}`,
        message: `Assigned on ${format(new Date(r.assigned_date + 'T00:00:00'), 'EEE dd MMM')} but marked as ${ls.toLowerCase()}.`,
      });
    }
  });

  // 4. Time overlaps (same staff, same date, overlapping start/end)
  Object.entries(byStaffDate).forEach(([key, items]) => {
    const [staffId, date] = key.split('|');
    const overlaps = detectOverlaps(items, staffId, date);
    if (overlaps.length > 0) {
      const member = staffMap[staffId];
      const jobIds = [...new Set(overlaps.flatMap(o => [o.a.job_id, o.b.job_id]))];
      const jobNames = jobIds.map(id => jobs.find(j => j.id === id)?.name).filter(Boolean);
      warnings.push({
        severity: 'critical',
        type: 'time_overlap',
        title: `${member?.name || 'Staff member'} — overlapping shifts`,
        message: `On ${format(new Date(date + 'T00:00:00'), 'EEE dd MMM')}, two shifts overlap (${jobNames.join(' / ') || 'same time'}). Adjust the times so they don't clash.`,
      });
    }
  });

  // 5 & 6. Out-of-hours and excessive hours per staff/date
  Object.entries(byStaffDate).forEach(([key, items]) => {
    const [staffId, date] = key.split('|');
    let totalMins = 0;
    items.forEach(r => {
      const s = timeToMinutes(r.start_time);
      const e = timeToMinutes(r.end_time);
      if (s == null || e == null) return;
      if (e > s) totalMins += (e - s);
      const isDepot = r.assignment_type === 'yard_depot';
      const openMin = isDepot ? DEPOT_OPEN_TIME_MIN : SITE_OPEN_TIME_MIN;
      const closeMin = isDepot ? DEPOT_CLOSE_TIME_MIN : SITE_CLOSE_TIME_MIN;
      if (s < openMin || e > closeMin) {
        const member = staffMap[staffId];
        const hoursLabel = isDepot ? '07:00–16:00' : '08:00–17:00';
        warnings.push({
          severity: 'warning',
          type: 'out_of_hours',
          title: `${member?.name || 'Staff member'} — outside ${isDepot ? 'depot' : 'site'} hours`,
          message: `Shift on ${format(new Date(date + 'T00:00:00'), 'EEE dd MMM')} runs ${r.start_time}–${r.end_time}. ${isDepot ? 'Depot' : 'Site'} hours are ${hoursLabel}.`,
        });
      }
    });
    if (totalMins > 540) { // >9h
      const member = staffMap[staffId];
      const hrs = (totalMins / 60).toFixed(1);
      warnings.push({
        severity: 'warning',
        type: 'excessive_hours',
        title: `${member?.name || 'Staff member'} — long day (${hrs}h)`,
        message: `Total scheduled time on ${format(new Date(date + 'T00:00:00'), 'EEE dd MMM')} is ${hrs} hours. Consider splitting or marking as overtime.`,
      });
    }
  });

  return warnings;
}