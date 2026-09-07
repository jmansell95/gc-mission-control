import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * useReportData — pulls live data from every hub in parallel and exposes
 * blended/cross-cutting datasets for the Reports Hub. All entities are
 * division-scoped when a divisionId filter is set.
 */
export function useReportData(filters = {}) {
  const divQuery = filters.divisionId ? { division_id: filters.divisionId } : {};

  const divisions = useQuery({
    queryKey: ['report-divisions'],
    queryFn: () => base44.entities.Division.list('-sort_order', 100),
  });

  const jobs = useQuery({
    queryKey: ['report-jobs', filters.divisionId],
    queryFn: () => base44.entities.Job.filter(divQuery, '-created_date', 500),
  });

  const staff = useQuery({
    queryKey: ['report-staff', filters.divisionId],
    queryFn: () => base44.entities.Staff.filter(divQuery, '-created_date', 500),
  });

  const vehicles = useQuery({
    queryKey: ['report-vehicles', filters.divisionId],
    queryFn: () => base44.entities.Vehicle.filter(divQuery, '-created_date', 500),
  });

  const assets = useQuery({
    queryKey: ['report-assets', filters.divisionId],
    queryFn: () => base44.entities.SiteAsset.filter(divQuery, '-created_date', 500),
  });

  const afps = useQuery({
    queryKey: ['report-afps', filters.divisionId],
    queryFn: () => base44.entities.AFP.filter(divQuery, '-created_date', 500),
  });

  const timesheets = useQuery({
    queryKey: ['report-timesheets', filters.divisionId],
    queryFn: () => base44.entities.Timesheet.filter(divQuery, '-created_date', 500),
  });

  const deliveries = useQuery({
    queryKey: ['report-deliveries', filters.divisionId],
    queryFn: () => base44.entities.DeliveryLog.filter(divQuery, '-created_date', 500),
  });

  const invLogs = useQuery({
    queryKey: ['report-invlogs', filters.divisionId],
    queryFn: () => base44.entities.InvestigationLog.filter(divQuery, '-created_date', 500),
  });

  const safetyReports = useQuery({
    queryKey: ['report-safety-reports', filters.divisionId],
    queryFn: () => base44.entities.SafetyReport.list('-created_date', 500),
  });

  const isLoading = jobs.isLoading || staff.isLoading || vehicles.isLoading || assets.isLoading;

  return {
    divisions: divisions.data || [],
    jobs: jobs.data || [],
    staff: staff.data || [],
    vehicles: vehicles.data || [],
    assets: assets.data || [],
    afps: afps.data || [],
    timesheets: timesheets.data || [],
    deliveries: deliveries.data || [],
    invLogs: invLogs.data || [],
    safetyReports: safetyReports.data || [],
    isLoading,
  };
}

/** Apply date-range overlap filter to jobs. */
export function filterJobsByDate(jobs, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return jobs;
  return jobs.filter((j) => {
    const jStart = j.start_date || '';
    const jEnd = j.end_date || '';
    if (dateFrom && jEnd && jEnd < dateFrom) return false;
    if (dateTo && jStart && jStart > dateTo) return false;
    return true;
  });
}

/** Tally rows by a field, returning [{ name, value }] for charts. */
export function tally(rows, field) {
  const m = {};
  for (const r of rows) {
    const k = r[field] || 'Unassigned';
    m[k] = (m[k] || 0) + 1;
  }
  return Object.entries(m).map(([name, value]) => ({ name, value }));
}

/** Sum a numeric field across rows. */
export function sumField(rows, field) {
  return rows.reduce((s, r) => s + (Number(r[field]) || 0), 0);
}