import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * useLocationLogs — shared date-range query hook for StaffLocationLog.
 *
 * Replaces the duplicated client-side filter pattern that was in LiveCrewTab,
 * CrewDetailDrawer, and checkDarkCrew. Each of those fetched 500 logs sorted
 * by -recorded_at then filtered by date in JavaScript — which breaks when
 * there are more than 500 records in the time window (the oldest get cut off
 * before the filter runs).
 *
 * This hook does the date filtering server-side via a $gte query operator so
 * only records within the window are fetched. It also subscribes to realtime
 * StaffLocationLog events so the query cache is invalidated instantly when
 * new points arrive — no more 30s polling lag.
 *
 * @param {object} opts
 * @param {string} [opts.staffId]    — filter to a single staff member
 * @param {string} [opts.divisionId] — filter to a single division (null = all)
 * @param {string} opts.startDate    — ISO string, earliest record to fetch
 * @param {string} [opts.endDate]    — ISO string, latest record (default: now)
 * @param {number} [opts.limit]      — max records (default 500)
 * @param {boolean} [opts.enabled]   — gate the query (default true)
 * @param {boolean} [opts.subscribe] — enable realtime subscription (default true)
 * @param {number} [opts.refetchInterval] — polling fallback interval ms (default 30000)
 */
export function useLocationLogs({
  staffId,
  divisionId,
  startDate,
  endDate,
  limit = 500,
  enabled = true,
  subscribe = true,
  refetchInterval = 30_000,
} = {}) {
  const queryClient = useQueryClient();

  const queryKey = ['staff-location-logs', { staffId, divisionId, startDate, endDate, limit }];

  const { data = [], isLoading, isFetching, dataUpdatedAt, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const filter = {};
      if (staffId) filter.staff_id = staffId;
      if (divisionId) filter.division_id = divisionId;
      if (startDate) filter.recorded_at = { $gte: startDate };
      if (endDate) filter.recorded_at = { ...filter.recorded_at, $lte: endDate };

      const logs = await base44.entities.StaffLocationLog.filter(filter, '-recorded_at', limit);
      return logs;
    },
    enabled,
    refetchInterval,
  });

  // Realtime subscription — invalidate the cache when new location logs arrive
  // so the map updates instantly instead of waiting for the next poll.
  useEffect(() => {
    if (!subscribe || !enabled) return;
    const unsubscribe = base44.entities.StaffLocationLog.subscribe((event) => {
      queryClient.invalidateQueries({ queryKey: ['staff-location-logs'] });
    });
    return unsubscribe;
  }, [subscribe, enabled, queryClient]);

  return { data, isLoading, isFetching, dataUpdatedAt, refetch };
}