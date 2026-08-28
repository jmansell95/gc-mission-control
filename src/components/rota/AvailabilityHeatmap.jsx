import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Calendar, Coffee, Stethoscope, Users, Warehouse, Loader2, ChevronLeft, ChevronRight, Filter, Briefcase,
} from 'lucide-react';
import { format, startOfWeek, addDays, parseISO, isWeekend } from 'date-fns';
import { useDivision } from '@/contexts/DivisionContext';

/**
 * AvailabilityHeatmap — redesigned modern calendar-grid view.
 *
 * Responsive week heatmap of crew availability with:
 *  - Color-coded cells (refined brand palette): on-job, leave, sick, training, depot, available
 *  - Team / crew-type filter
 *  - Per-person row summaries (status breakdown)
 *  - Per-day column totals (headcount by status)
 *  - Hover tooltips with detail
 *  - Legend
 */

const STATUS_CONFIG = {
  job:          { bg: 'bg-emerald-500', text: 'text-white', label: 'On Job',     icon: Briefcase },
  annual_leave: { bg: 'bg-blue-400',    text: 'text-white', label: 'Leave',      icon: Coffee },
  sick:         { bg: 'bg-rose-400',    text: 'text-white', label: 'Sick',       icon: Stethoscope },
  training:     { bg: 'bg-amber-400',   text: 'text-white', label: 'Training',   icon: Users },
  yard_depot:   { bg: 'bg-slate-400',   text: 'text-white', label: 'Depot',      icon: Warehouse },
  available:    { bg: 'bg-slate-100',   text: 'text-slate-400', label: 'Available', icon: null },
};

const STATUS_ORDER = ['job', 'annual_leave', 'sick', 'training', 'yard_depot', 'available'];

export default function AvailabilityHeatmap({ weekStart: propWeekStart }) {
  const [weekStart, setWeekStart] = useState(propWeekStart || format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [teamFilter, setTeamFilter] = useState('all');
  const { activeDivisionId } = useDivision();

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ['heatmap-staff'],
    queryFn: async () => { const r = await base44.entities.Staff.filter({ is_active: true }, 'full_name', 200); return r.data || r || []; },
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => base44.entities.Team.list(),
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ['heatmap-assignments', weekStart, activeDivisionId || 'overview'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getDivisionScopedData', { entity: 'RotaAssignment', division_id: activeDivisionId, filter: { week_start: weekStart }, sort: 'assigned_date', limit: 500 });
      return res.data?.data || [];
    },
  });

  const { data: absences = [] } = useQuery({
    queryKey: ['heatmap-absences'],
    queryFn: async () => { const r = await base44.entities.Absence.filter({ status: 'approved' }, 'start_date', 200); return r.data || r || []; },
  });

  const teamMap = useMemo(() => {
    const m = {};
    teams.forEach((t) => { m[t.id] = t; });
    return m;
  }, [teams]);

  const days = useMemo(() => (
    Array.from({ length: 7 }).map((_, i) => {
      const date = addDays(new Date(weekStart), i);
      return { date, dateStr: format(date, 'yyyy-MM-dd'), label: format(date, 'EEE'), dayNum: format(date, 'dd') };
    })
  ), [weekStart]);

  // Resolve the status for a staff member on a given date
  const getDayStatus = (staffId, dateStr) => {
    const dayAssignments = assignments.filter((a) => a.staff_id === staffId && a.assigned_date === dateStr);
    const nonJob = dayAssignments.find((a) => a.assignment_type !== 'job');
    if (nonJob) return { type: nonJob.assignment_type, label: nonJob.non_job_label || STATUS_CONFIG[nonJob.assignment_type]?.label || '' };

    // Approved absences
    const absence = absences.find((a) => {
      if (a.staff_id !== staffId) return false;
      const start = parseISO(a.start_date);
      const end = a.end_date ? parseISO(a.end_date) : start;
      const d = parseISO(dateStr);
      return d >= start && d <= end;
    });
    if (absence) return { type: absence.absence_type || 'annual_leave', label: absence.absence_type === 'sick' ? 'Sick' : 'AL' };

    const hasJob = dayAssignments.some((a) => a.assignment_type === 'job');
    if (hasJob) return { type: 'job', label: 'Job' };
    return { type: 'available', label: '' };
  };

  // Filter staff by team
  const filteredStaff = useMemo(() => {
    if (teamFilter === 'all') return staff;
    return staff.filter((s) => s.team_id === teamFilter);
  }, [staff, teamFilter]);

  // Per-person row summary: count of each status across the week
  const rowSummary = (staffId) => {
    const counts = { job: 0, annual_leave: 0, sick: 0, training: 0, yard_depot: 0, available: 0 };
    days.forEach((d) => {
      const st = getDayStatus(staffId, d.dateStr);
      counts[st.type] = (counts[st.type] || 0) + 1;
    });
    return counts;
  };

  // Per-day column totals: headcount on job / unavailable / available
  const dayTotals = useMemo(() => {
    return days.map((d) => {
      const counts = { job: 0, annual_leave: 0, sick: 0, training: 0, yard_depot: 0, available: 0 };
      filteredStaff.forEach((s) => {
        const st = getDayStatus(s.id, d.dateStr);
        counts[st.type] = (counts[st.type] || 0) + 1;
      });
      return { ...d, counts };
    });
  }, [days, filteredStaff, assignments, absences]);

  const prevWeek = () => setWeekStart(format(addDays(new Date(weekStart), -7), 'yyyy-MM-dd'));
  const nextWeek = () => setWeekStart(format(addDays(new Date(weekStart), 7), 'yyyy-MM-dd'));
  const thisWeek = () => setWeekStart(format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));

  const weekLabel = `${format(new Date(weekStart), 'd MMM')} – ${format(addDays(new Date(weekStart), 6), 'd MMM yyyy')}`;

  return (
    <div className="insight-card rounded-2xl p-4 md:p-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl stat-gradient-brand flex items-center justify-center">
            <Calendar className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Availability Heatmap</h3>
            <p className="text-xs text-slate-400">{weekLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Team filter */}
          <div className="relative">
            <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#2E5A1A] transition"
            >
              <option value="all">All Crews</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          {/* Week nav */}
          <div className="flex items-center gap-1 bg-white rounded-lg border border-slate-200 p-0.5">
            <button onClick={prevWeek} className="p-1.5 rounded-md hover:bg-slate-100 transition"><ChevronLeft className="w-4 h-4 text-slate-500" /></button>
            <button onClick={thisWeek} className="px-2.5 py-1 text-xs font-semibold rounded-md bg-[#2E5A1A]/10 text-[#2E5A1A] hover:bg-[#2E5A1A]/15 transition">Today</button>
            <button onClick={nextWeek} className="p-1.5 rounded-md hover:bg-slate-100 transition"><ChevronRight className="w-4 h-4 text-slate-500" /></button>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-4 pb-3 border-b border-slate-100">
        {STATUS_ORDER.map((key) => {
          const cfg = STATUS_CONFIG[key];
          return (
            <div key={key} className="flex items-center gap-1.5">
              <div className={`w-3.5 h-3.5 rounded ${cfg.bg}`} />
              <span className="text-xs font-medium text-slate-600">{cfg.label}</span>
            </div>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-[#2E5A1A] animate-spin" /></div>
      ) : filteredStaff.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Users className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm">No active staff in this crew type.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            {/* Day headers + column totals */}
            <div className="grid gap-1.5 mb-1.5" style={{ gridTemplateColumns: `180px repeat(7, minmax(70px, 1fr))` }}>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-end pb-1">Crew Member</div>
              {dayTotals.map((d) => {
                const weekend = isWeekend(d.date);
                const onJob = d.counts.job;
                const off = d.counts.annual_leave + d.counts.sick + d.counts.training + d.counts.yard_depot;
                return (
                  <div key={d.dateStr} className={`text-center rounded-lg py-1.5 ${weekend ? 'bg-slate-50' : ''}`}>
                    <p className={`text-xs font-bold ${weekend ? 'text-slate-400' : 'text-slate-700'}`}>{d.label}</p>
                    <p className="text-[10px] text-slate-400 tabular-nums">{d.dayNum}</p>
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <span className="text-[9px] font-bold text-emerald-600 tabular-nums">{onJob}</span>
                      {off > 0 && <span className="text-[9px] font-bold text-slate-400 tabular-nums">·{off}</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Rows */}
            <div className="space-y-1.5">
              {filteredStaff.slice(0, 30).map((s) => {
                const summary = rowSummary(s.id);
                const team = teamMap[s.team_id];
                const initials = (s.full_name || s.name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
                return (
                  <div key={s.id} className="grid gap-1.5 items-center" style={{ gridTemplateColumns: `180px repeat(7, minmax(70px, 1fr))` }}>
                    {/* Name + summary */}
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate">{s.full_name || s.name}</p>
                        <p className="text-[10px] text-slate-400 truncate">{team?.name || 'Unassigned'}</p>
                      </div>
                    </div>
                    {/* Day cells */}
                    {days.map((d) => {
                      const status = getDayStatus(s.id, d.dateStr);
                      const cfg = STATUS_CONFIG[status.type] || STATUS_CONFIG.available;
                      const weekend = isWeekend(d.date);
                      return (
                        <div
                          key={d.dateStr}
                          title={`${s.full_name || s.name} · ${format(d.date, 'EEE dd')} · ${cfg.label}${status.label ? ` (${status.label})` : ''}`}
                          className={`h-9 rounded-lg flex items-center justify-center text-[10px] font-bold ${cfg.bg} ${cfg.text} ${weekend ? 'opacity-60' : ''} transition hover:scale-[1.08] hover:shadow-md cursor-default`}
                        >
                          {status.type === 'job' ? 'J' : status.type === 'available' ? '' : (status.label || cfg.label.slice(0, 3))}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {filteredStaff.length > 30 && (
              <p className="text-center text-xs text-slate-400 mt-3">Showing first 30 of {filteredStaff.length} staff</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}