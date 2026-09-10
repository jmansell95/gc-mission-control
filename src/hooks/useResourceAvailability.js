import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isWithinInterval, parseISO } from 'date-fns';
import { buildStatusMaps } from '@/components/rota/heatmapUtils';

/**
 * useResourceAvailability — rig-focused availability data for the resource
 * heatmap and gap finder. Wraps getAvailabilityMatrix (full-year data) and
 * provides rig status maps, gap scanning, and summary stats for any date
 * range within the fetched year.
 *
 * @param {Date} rangeStart — start of the visible window
 * @param {Date} rangeEnd   — end of the visible window
 * @param {string} divisionId — optional division filter
 */
export function useResourceAvailability(rangeStart, rangeEnd, divisionId = '') {
  const year = rangeStart.getFullYear();

  const { data, isLoading } = useQuery({
    queryKey: ['availability-matrix', year, divisionId],
    queryFn: async () => {
      const res = await base44.functions.invoke('getAvailabilityMatrix', { year, division_id: divisionId || '' });
      return res.data;
    },
  });

  const { staffStatus, rigStatus } = useMemo(() => buildStatusMaps(data), [data]);

  // Build the days array for the visible range
  const days = useMemo(() => {
    const start = startOfWeek(rangeStart, { weekStartsOn: 1 });
    const end = endOfWeek(rangeEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end }).map(d => ({
      dateStr: format(d, 'yyyy-MM-dd'),
      date: d,
      dayName: format(d, 'EEE'),
      dayNum: format(d, 'dd'),
      month: format(d, 'MMM'),
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
      isToday: format(d, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd'),
    }));
  }, [rangeStart, rangeEnd]);

  const dayStrs = days.map(d => d.dateStr);

  // Rigs sorted by division then name
  const rigs = useMemo(() => {
    if (!data?.rigs) return [];
    return [...data.rigs].sort((a, b) => {
      const aName = a.name || '';
      const bName = b.name || '';
      return aName.localeCompare(bName);
    });
  }, [data]);

  // Staff for crew lookup
  const staff = useMemo(() => data?.staff || [], [data]);

  // Get the status of a rig on a specific date
  const getRigStatus = (rigId, dateStr) => {
    const sm = rigStatus.get(rigId);
    if (!sm) return null;
    return sm.get(dateStr) || null;
  };

  // Summary stats for the visible range
  const stats = useMemo(() => {
    let onSite = 0, available = 0, maintenance = 0, upcoming = 0;
    for (const rig of rigs) {
      for (const d of dayStrs) {
        const s = getRigStatus(rig.id, d);
        if (!s) available++;
        else if (s.type === 'job') onSite++;
        else if (s.type === 'maintenance') maintenance++;
        else if (s.type === 'upcoming') upcoming++;
      }
    }
    return { onSite, available, maintenance, upcoming, total: rigs.length };
  }, [rigs, dayStrs, rigStatus]);

  // Gap finder: scan all rigs for availability within a date range
  const findAvailableRigs = (fromDate, toDate, rigTypeFilter = 'all') => {
    if (!fromDate || !toDate) return [];
    const from = typeof fromDate === 'string' ? fromDate : format(fromDate, 'yyyy-MM-dd');
    const to = typeof toDate === 'string' ? toDate : format(toDate, 'yyyy-MM-dd');

    const results = [];
    for (const rig of rigs) {
      // Filter by rig type if specified
      if (rigTypeFilter !== 'all' && rig.rig_type && rig.rig_type !== rigTypeFilter) continue;

      const sm = rigStatus.get(rig.id);
      const conflicts = [];
      let allFree = true;

      let d = parseISO(from);
      const endD = parseISO(to);
      while (d <= endD) {
        const ds = format(d, 'yyyy-MM-dd');
        const s = sm?.get(ds);
        if (s) {
          allFree = false;
          conflicts.push({ date: ds, type: s.type, jobName: s.job_name || '' });
        }
        d = addDays(d, 1);
      }

      results.push({
        rig,
        fullyAvailable: allFree,
        conflictCount: conflicts.length,
        conflicts,
        freeDays: (Math.round((endD - parseISO(from)) / 86400000) + 1) - conflicts.length,
      });
    }

    // Sort: fully available first, then by fewest conflicts
    return results.sort((a, b) => {
      if (a.fullyAvailable !== b.fullyAvailable) return a.fullyAvailable ? -1 : 1;
      return a.conflictCount - b.conflictCount;
    });
  };

  return {
    rigs,
    staff,
    days,
    dayStrs,
    rigStatus,
    staffStatus,
    getRigStatus,
    stats,
    isLoading,
    findAvailableRigs,
  };
}