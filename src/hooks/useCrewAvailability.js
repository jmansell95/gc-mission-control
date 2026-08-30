import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format, addDays, startOfWeek } from 'date-fns';

/**
 * useCrewAvailability — shared data + status logic for the crew availability
 * heatmap. Used by both the dashboard widget (compact preview) and the full
 * page so the status colours, labels, and stats stay identical.
 */
export function useCrewAvailability(weekStart) {
  const { data: staff = [], isLoading: staffLoading } = useQuery({
    queryKey: ['heatmap-staff'],
    queryFn: () => base44.entities.Staff.filter({ is_active: true }),
  });
  const { data: assignments = [] } = useQuery({
    queryKey: ['heatmap-assignments'],
    queryFn: () => base44.entities.RotaAssignment.list('-created_date', 500),
  });
  const { data: divisions = [] } = useQuery({
    queryKey: ['heatmap-divisions'],
    queryFn: () => base44.entities.Division.list(),
  });
  const { data: absences = [] } = useQuery({
    queryKey: ['heatmap-absences'],
    queryFn: () => base44.entities.Absence.filter({ status: 'approved' }),
  });

  const divMap = useMemo(() => Object.fromEntries(divisions.map(d => [d.id, d])), [divisions]);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );
  const dayStrs = days.map(d => format(d, 'yyyy-MM-dd'));

  const assignMap = useMemo(() => {
    const map = {};
    for (const a of assignments) {
      if (!map[a.staff_id]) map[a.staff_id] = {};
      map[a.staff_id][a.assigned_date] = a;
    }
    return map;
  }, [assignments]);

  const absenceMap = useMemo(() => {
    const map = {};
    for (const ab of absences) {
      if (!ab.staff_id) continue;
      if (!map[ab.staff_id]) map[ab.staff_id] = new Set();
      const start = new Date(ab.start_date);
      const end = new Date(ab.end_date || ab.start_date);
      for (let d = start; d <= end; d = addDays(d, 1)) {
        map[ab.staff_id].add(format(d, 'yyyy-MM-dd'));
      }
    }
    return map;
  }, [absences]);

  const getCellStatus = (staffId, dateStr) => {
    const a = assignMap[staffId]?.[dateStr];
    if (a) {
      if (a.assignment_type === 'annual_leave') return { status: 'leave', color: '#3b82f6', label: 'AL' };
      if (a.assignment_type === 'sick') return { status: 'sick', color: '#f43f5e', label: 'S' };
      if (a.assignment_type === 'training') return { status: 'training', color: '#f59e0b', label: 'T' };
      if (a.assignment_type === 'yard_depot') return { status: 'depot', color: '#64748b', label: 'D' };
      return { status: 'job', color: '#10b981', label: 'J' };
    }
    if (absenceMap[staffId]?.has(dateStr)) return { status: 'leave', color: '#3b82f6', label: 'AL' };
    return { status: 'free', color: null, label: '' };
  };

  const sortedStaff = useMemo(() => {
    return [...staff].sort((a, b) => {
      const aDiv = a.division_id || 'zzz';
      const bDiv = b.division_id || 'zzz';
      return aDiv.localeCompare(bDiv) || (a.name || '').localeCompare(b.name || '');
    });
  }, [staff]);

  const stats = useMemo(() => {
    let freeCount = 0, onJobCount = 0, leaveCount = 0;
    for (const s of sortedStaff) {
      for (const d of dayStrs) {
        const st = getCellStatus(s.id, d).status;
        if (st === 'free') freeCount++;
        else if (st === 'job') onJobCount++;
        else if (st === 'leave') leaveCount++;
      }
    }
    return { freeCount, onJobCount, leaveCount, total: sortedStaff.length };
  }, [sortedStaff, dayStrs, assignMap, absenceMap]);

  return {
    staff: sortedStaff,
    divisions,
    divMap,
    days,
    dayStrs,
    getCellStatus,
    stats,
    isLoading: staffLoading,
  };
}

export const HEATMAP_LEGEND = [
  { label: 'On Job', color: '#10b981' },
  { label: 'Free', color: '#cbd5e1' },
  { label: 'Annual Leave', color: '#3b82f6' },
  { label: 'Sick', color: '#f43f5e' },
  { label: 'Training', color: '#f59e0b' },
  { label: 'Depot', color: '#64748b' },
];