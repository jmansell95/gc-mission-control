import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format, addDays, startOfWeek, isSameDay } from 'date-fns';
import { Users, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * CrewAvailabilityHeatmap — enterprise-level heatmap showing every active
 * crew member × day, colour-coded by division. Directors can see at a glance
 * who is free, who is on leave, and who is cross-divisional.
 * Click a cell to draft a cross-division assignment.
 */
export default function CrewAvailabilityHeatmap() {
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedCell, setSelectedCell] = useState(null);

  const { data: staff = [] } = useQuery({ queryKey: ['heatmap-staff'], queryFn: () => base44.entities.Staff.filter({ is_active: true }) });
  const { data: assignments = [] } = useQuery({ queryKey: ['heatmap-assignments'], queryFn: () => base44.entities.RotaAssignment.list('-created_date', 500) });
  const { data: divisions = [] } = useQuery({ queryKey: ['heatmap-divisions'], queryFn: () => base44.entities.Division.list() });
  const { data: absences = [] } = useQuery({ queryKey: ['heatmap-absences'], queryFn: () => base44.entities.Absence.filter({ status: 'approved' }) });

  const divMap = Object.fromEntries(divisions.map(d => [d.id, d]));

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const dayStrs = days.map(d => format(d, 'yyyy-MM-dd'));

  // Build assignment map: staffId -> { date -> assignment }
  const assignMap = useMemo(() => {
    const map = {};
    for (const a of assignments) {
      if (!map[a.staff_id]) map[a.staff_id] = {};
      map[a.staff_id][a.assigned_date] = a;
    }
    return map;
  }, [assignments]);

  // Build absence map: staffId -> Set of date strings
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

  const sortedStaff = [...staff].sort((a, b) => {
    const aDiv = a.division_id || 'zzz';
    const bDiv = b.division_id || 'zzz';
    return aDiv.localeCompare(bDiv) || (a.name || '').localeCompare(b.name || '');
  });

  // Stats
  const freeCount = sortedStaff.reduce((sum, s) => {
    return sum + dayStrs.filter(d => getCellStatus(s.id, d).status === 'free').length;
  }, 0);
  const onJobCount = sortedStaff.reduce((sum, s) => {
    return sum + dayStrs.filter(d => getCellStatus(s.id, d).status === 'job').length;
  }, 0);
  const leaveCount = sortedStaff.reduce((sum, s) => {
    return sum + dayStrs.filter(d => getCellStatus(s.id, d).status === 'leave').length;
  }, 0);

  return (
    <div className="insight-card rounded-2xl p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Users className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Crew Availability Heatmap</h3>
            <p className="text-xs text-slate-500">All divisions · {sortedStaff.length} crew members</p>
          </div>
        </div>
        {/* Week navigation */}
        <div className="flex items-center gap-1">
          <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="p-1.5 rounded-lg hover:bg-slate-100 transition">
            <ChevronLeft className="w-4 h-4 text-slate-500" />
          </button>
          <span className="text-xs font-semibold text-slate-600 px-2">
            {format(weekStart, 'dd MMM')} — {format(addDays(weekStart, 6), 'dd MMM')}
          </span>
          <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="p-1.5 rounded-lg hover:bg-slate-100 transition">
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex gap-3 mb-3 text-xs">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500" /> On Job · {onJobCount}
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 ring-1 ring-slate-200">
          <span className="w-2 h-2 rounded-full bg-slate-300" /> Free · {freeCount}
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 ring-1 ring-blue-200">
          <span className="w-2 h-2 rounded-full bg-blue-500" /> Leave · {leaveCount}
        </div>
      </div>

      {/* Heatmap grid */}
      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="text-left font-semibold text-slate-500 pb-2 pr-2 sticky left-0 bg-white z-10 min-w-[120px]">
                Crew Member
              </th>
              {days.map(d => (
                <th key={d.toISOString()} className="text-center font-semibold text-slate-500 pb-2 px-1 min-w-[36px]">
                  <div className="text-[10px] uppercase">{format(d, 'EEE')}</div>
                  <div className="text-slate-400 font-normal">{format(d, 'dd')}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedStaff.slice(0, 30).map(s => {
              const divColor = divMap[s.division_id]?.color || '#94a3b8';
              return (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="py-1.5 pr-2 sticky left-0 bg-white z-10">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: divColor }} />
                      <span className="text-slate-700 font-medium truncate max-w-[100px]">{s.name}</span>
                    </div>
                  </td>
                  {dayStrs.map(dStr => {
                    const cell = getCellStatus(s.id, dStr);
                    return (
                      <td key={dStr} className="text-center py-1 px-1">
                        <button
                          onClick={() => setSelectedCell({ staffId: s.id, staffName: s.name, date: dStr, status: cell.status })}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-[9px] font-bold transition hover:scale-110"
                          style={{
                            background: cell.color || '#f1f5f9',
                            color: cell.color ? 'white' : '#cbd5e1',
                          }}
                          title={`${s.name} — ${cell.status}`}
                        >
                          {cell.label}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        {sortedStaff.length > 30 && (
          <p className="text-xs text-center text-slate-400 pt-2">
            +{sortedStaff.length - 30} more crew members…
          </p>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-100">
        {[
          { label: 'On Job', color: '#10b981' },
          { label: 'Free', color: '#cbd5e1' },
          { label: 'Annual Leave', color: '#3b82f6' },
          { label: 'Sick', color: '#f43f5e' },
          { label: 'Training', color: '#f59e0b' },
          { label: 'Depot', color: '#64748b' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1 text-[10px] text-slate-500">
            <span className="w-2.5 h-2.5 rounded" style={{ background: l.color }} />
            {l.label}
          </div>
        ))}
      </div>
    </div>
  );
}