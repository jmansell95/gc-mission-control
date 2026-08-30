import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Calendar, Coffee, Stethoscope, Users, Warehouse, Loader2, ChevronLeft, ChevronRight, Filter, Briefcase,
} from 'lucide-react';
import { format, startOfWeek, addDays, parseISO, isWeekend } from 'date-fns';
import { useScopedEntity } from '@/hooks/useScopedEntity';

/**
 * AvailabilityHeatmap — card-per-staff week view of crew availability.
 *
 * Each crew member renders as a full-width card with their 7-day week strip
 * inside, so the layout is mobile-friendly with no horizontal page scroll.
 * Keeps the team filter, week navigation, division-scoped assignments, and
 * the existing status colours / logic.
 */

const STATUS_CONFIG = {
  job:          { bg: 'bg-emerald-500', text: 'text-white', label: 'On Job',     icon: Briefcase, hex: '#10b981' },
  annual_leave: { bg: 'bg-blue-400',    text: 'text-white', label: 'Leave',      icon: Coffee,    hex: '#3b82f6' },
  sick:         { bg: 'bg-rose-400',    text: 'text-white', label: 'Sick',       icon: Stethoscope, hex: '#f43f5e' },
  training:     { bg: 'bg-amber-400',   text: 'text-white', label: 'Training',   icon: Users,     hex: '#f59e0b' },
  yard_depot:   { bg: 'bg-slate-400',   text: 'text-white', label: 'Depot',      icon: Warehouse, hex: '#64748b' },
  available:    { bg: 'bg-slate-100',   text: 'text-slate-400', label: 'Available', icon: null,   hex: '#cbd5e1' },
};

const STATUS_ORDER = ['job', 'annual_leave', 'sick', 'training', 'yard_depot', 'available'];

export default function AvailabilityHeatmap({ weekStart: propWeekStart }) {
  const [weekStart, setWeekStart] = useState(propWeekStart || format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [teamFilter, setTeamFilter] = useState('all');

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ['heatmap-staff'],
    queryFn: async () => { const r = await base44.entities.Staff.filter({ is_active: true }, 'full_name', 200); return r.data || r || []; },
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => base44.entities.Team.list(),
  });

  const { data: assignments = [] } = useScopedEntity('RotaAssignment', {
    queryKey: ['heatmap-assignments', weekStart],
    filter: { week_start: weekStart },
    sort: 'assigned_date',
    limit: 500,
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
    if (absence) {
      const reason = absence.reason || 'holiday';
      const type = reason === 'sick' ? 'sick' : reason === 'training' ? 'training' : 'annual_leave';
      return { type, label: type === 'sick' ? 'Sick' : type === 'training' ? 'Train' : 'AL' };
    }

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

  // Aggregate stats across all filtered staff for the week
  const weekStats = useMemo(() => {
    let onJob = 0, available = 0, off = 0;
    filteredStaff.forEach((s) => {
      const sum = rowSummary(s.id);
      onJob += sum.job;
      available += sum.available;
      off += sum.annual_leave + sum.sick + sum.training + sum.yard_depot;
    });
    return { onJob, available, off, total: filteredStaff.length };
  }, [filteredStaff, days, assignments, absences]);

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
            <Calendar className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Availability Heatmap</h3>
            <p className="text-xs text-slate-400">{weekLabel} · {weekStats.total} crew</p>
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

      {/* Week stats bar */}
      <div className="flex flex-wrap gap-2 mb-4 pb-3 border-b border-slate-100 text-xs">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500" /> On Job · {weekStats.onJob}
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 ring-1 ring-slate-200">
          <span className="w-2 h-2 rounded-full bg-slate-300" /> Available · {weekStats.available}
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 ring-1 ring-blue-200">
          <span className="w-2 h-2 rounded-full bg-blue-400" /> Off · {weekStats.off}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-4">
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
        <div className="space-y-2">
          {filteredStaff.map((s) => {
            const summary = rowSummary(s.id);
            const team = teamMap[s.team_id];
            const initials = (s.full_name || s.name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
            return (
              <div key={s.id} className="rounded-2xl border border-slate-100 bg-white overflow-hidden">
                {/* Header row */}
                <div className="flex items-center gap-3 p-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{s.full_name || s.name}</p>
                    <p className="text-xs text-slate-500 truncate">{team?.name || 'Unassigned'}</p>
                  </div>
                  {/* Week mini-summary */}
                  <div className="flex items-center gap-1.5 flex-shrink-0 text-xs">
                    <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold">
                      {summary.job}<span className="hidden sm:inline"> jobs</span>
                    </span>
                    <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 text-slate-500 font-bold">
                      {summary.available}<span className="hidden sm:inline"> free</span>
                    </span>
                  </div>
                </div>

                {/* 7-day strip */}
                <div className="px-3 pb-3">
                  <div className="grid grid-cols-7 gap-1.5">
                    {days.map((d) => {
                      const status = getDayStatus(s.id, d.dateStr);
                      const cfg = STATUS_CONFIG[status.type] || STATUS_CONFIG.available;
                      const weekend = isWeekend(d.date);
                      return (
                        <div key={d.dateStr} className="flex flex-col items-center gap-1">
                          <span className={`text-[10px] font-bold uppercase ${weekend ? 'text-slate-300' : 'text-slate-400'}`}>{d.label}</span>
                          <span className={`text-[10px] tabular-nums ${weekend ? 'text-slate-300' : 'text-slate-400'}`}>{d.dayNum}</span>
                          <div
                            title={`${s.full_name || s.name} · ${format(d.date, 'EEE dd')} · ${cfg.label}${status.label ? ` (${status.label})` : ''}`}
                            className={`w-full aspect-square min-h-[36px] rounded-lg flex items-center justify-center text-[10px] font-extrabold ${cfg.bg} ${cfg.text} ${weekend ? 'opacity-60' : ''} transition hover:scale-[1.06] cursor-default`}
                          >
                            {status.type === 'job' ? 'J' : status.type === 'available' ? '' : (status.label || cfg.label.slice(0, 3))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}