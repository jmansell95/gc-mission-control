import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import {
  ClipboardCheck, MapPin, ShieldCheck, Briefcase, Search,
  Users, CheckCircle2, AlertTriangle, Loader2, ChevronDown,
  Activity,
} from 'lucide-react';
import { getShiftPipeline, getStageColors, SHIFT_STAGES } from '@/utils/shiftStatus';
import { Skeleton } from '@/components/StateViews';

const ICONS = { ClipboardCheck, MapPin, ShieldCheck, Briefcase };

/**
 * CrewShiftStatusWidget — Compliance Hub widget showing every active crew
 * member's shift pipeline progress (checks → arrive → briefing → working).
 *
 * Dark "Mission Control" themed. Live-refreshes via RotaAssignment realtime
 * subscription. Summary ribbon at top, filterable crew cards below.
 */
export default function CrewShiftStatusWidget() {
  const [search, setSearch] = useState('');
  const [jobFilter, setJobFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const queryClient = useQueryClient();

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // Fetch today's job assignments
  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['crew-shift-status', todayStr],
    queryFn: async () => {
      const list = await base44.entities.RotaAssignment.filter({ assigned_date: todayStr });
      return list.filter(a => !a.assignment_type || a.assignment_type === 'job');
    },
  });

  const { data: staff = [] } = useQuery({
    queryKey: ['staff-active-shift'],
    queryFn: () => base44.entities.Staff.filter({ is_active: true }, 'name', 500),
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs-for-shift-status'],
    queryFn: () => base44.entities.Job.list('-created_date', 500),
  });

  // Realtime subscription — auto-refresh when assignments change
  useEffect(() => {
    const unsub = base44.entities.RotaAssignment.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['crew-shift-status', todayStr] });
    });
    return () => { if (unsub) unsub(); };
  }, [queryClient, todayStr]);

  // Build enriched crew rows
  const crewRows = useMemo(() => {
    return assignments.map(a => {
      const member = staff.find(s => s.id === a.staff_id);
      const job = jobs.find(j => j.id === a.job_id);
      return { ...a, staffName: member?.name || 'Unknown', jobName: job?.name || 'Unassigned', job };
    });
  }, [assignments, staff, jobs]);

  // Summary counts
  const summary = useMemo(() => {
    let checks = 0, arrived = 0, briefed = 0, working = 0;
    crewRows.forEach(a => {
      if (a.daily_checks_completed) checks++;
      if (a.arrived_on_site_at) arrived++;
      if (a.briefing_signed) briefed++;
      if ((a.status || 'assigned') === 'started' || (a.status || 'assigned') === 'completed') working++;
    });
    return { total: crewRows.length, checks, arrived, briefed, working };
  }, [crewRows]);

  // Filter
  const filtered = useMemo(() => {
    let rows = crewRows;
    if (jobFilter !== 'all') rows = rows.filter(r => r.job_id === jobFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(r => r.staffName.toLowerCase().includes(q) || r.jobName.toLowerCase().includes(q));
    }
    // Sort: not-started first (most attention needed), then by completedCount asc
    return rows.sort((a, b) => {
      const pa = getShiftPipeline(a).completedCount;
      const pb = getShiftPipeline(b).completedCount;
      if (pa !== pb) return pa - pb;
      return a.staffName.localeCompare(b.staffName);
    });
  }, [crewRows, jobFilter, search]);

  const jobOptions = useMemo(() => {
    const map = {};
    crewRows.forEach(r => { if (r.job_id && r.jobName) map[r.job_id] = r.jobName; });
    return Object.entries(map).sort((a, b) => a[1].localeCompare(b[1]));
  }, [crewRows]);

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-slate-900 border border-slate-700/50 p-5">
        <Skeleton className="h-6 w-48 mb-4 bg-slate-700/50" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl bg-slate-800/50" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-700/50 overflow-hidden shadow-xl">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-700/50 flex items-center gap-3 flex-wrap">
        <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
          <Activity className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">Crew Shift Status</h3>
          <p className="text-[11px] text-slate-400">Live shift pipeline · {format(new Date(), 'EEEE dd MMM')}</p>
        </div>
        <span className="ml-auto text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
          {summary.working}/{summary.total} working
        </span>
      </div>

      {/* Summary ribbon */}
      <div className="px-5 py-3 grid grid-cols-4 gap-2 border-b border-slate-700/50 bg-slate-800/30">
        {SHIFT_STAGES.map((stage, i) => {
          const counts = [summary.checks, summary.arrived, summary.briefed, summary.working];
          const Icon = ICONS[stage.icon];
          return (
            <div key={stage.id} className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-slate-700/40 flex items-center justify-center flex-shrink-0">
                <Icon className="w-3.5 h-3.5 text-slate-300" />
              </div>
              <div>
                <p className="text-base font-bold text-white leading-none tabular-nums">{counts[i]}</p>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5">{stage.short}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter bar */}
      <div className="px-5 py-3 flex items-center gap-2 border-b border-slate-700/50 bg-slate-800/20">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search crew or job…"
            className="w-full pl-9 pr-3 py-2 text-sm bg-slate-800 border border-slate-700 text-white rounded-lg focus:outline-none focus:border-emerald-500 placeholder:text-slate-500"
          />
        </div>
        <select
          value={jobFilter}
          onChange={e => setJobFilter(e.target.value)}
          className="px-3 py-2 text-sm bg-slate-800 border border-slate-700 text-white rounded-lg focus:outline-none focus:border-emerald-500 max-w-[160px]"
        >
          <option value="all">All jobs</option>
          {jobOptions.map(([jid, jname]) => (
            <option key={jid} value={jid}>{jname}</option>
          ))}
        </select>
      </div>

      {/* Crew cards grid */}
      <div className="p-4 max-h-[600px] overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="w-8 h-8 text-slate-600 mb-2" />
            <p className="text-sm text-slate-400 font-medium">
              {crewRows.length === 0 ? 'No crew on rota today' : 'No crew match your filters'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(a => (
              <CrewShiftCard
                key={a.id}
                assignment={a}
                expanded={expandedId === a.id}
                onToggle={() => setExpandedId(expandedId === a.id ? null : a.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Single crew card with 4-step pipeline ──
function CrewShiftCard({ assignment, expanded, onToggle }) {
  const { stages, currentStage, completedCount } = getShiftPipeline(assignment);

  return (
    <div
      className={`rounded-xl border transition cursor-pointer ${
        completedCount === 0
          ? 'bg-slate-800/40 border-slate-700/50 hover:border-slate-600'
          : completedCount === 4
            ? 'bg-emerald-900/20 border-emerald-700/40 hover:border-emerald-600/60'
            : 'bg-slate-800/60 border-slate-700/50 hover:border-amber-600/40'
      }`}
      onClick={onToggle}
    >
      {/* Card header — avatar + name + job */}
      <div className="px-3.5 py-3 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center flex-shrink-0 text-white font-bold text-xs">
          {assignment.staffName?.charAt(0) || '?'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white truncate">{assignment.staffName}</p>
          <p className="text-[11px] text-slate-400 truncate">{assignment.jobName}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-[10px] font-bold text-slate-400 tabular-nums">{completedCount}/4</span>
          <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* 4-step pipeline indicator */}
      <div className="px-3.5 pb-3">
        <div className="flex items-center">
          {stages.map((stage, i) => {
            const colors = getStageColors(stage, currentStage?.id === stage.id);
            const Icon = ICONS[stage.icon];
            return (
              <React.Fragment key={stage.id}>
                {/* Dot */}
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center ring-2 ring-offset-2 ring-offset-slate-800 ${colors.dot} ${colors.ring} transition-all`}
                    title={stage.done && stage.timestamp ? `${stage.label}: ${format(new Date(stage.timestamp), 'HH:mm')}` : stage.label}
                  >
                    {stage.done ? (
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    ) : (
                      <Icon className={`w-3.5 h-3.5 ${colors.text}`} />
                    )}
                  </div>
                </div>
                {/* Connecting line */}
                {i < stages.length - 1 && (
                  <div className={`h-0.5 flex-1 rounded-full ${stage.done ? 'bg-emerald-500' : 'bg-slate-700'} transition-all`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
        {/* Stage labels */}
        <div className="flex items-center mt-1.5">
          {stages.map((stage, i) => (
            <React.Fragment key={stage.id}>
              <div className="w-7 flex-shrink-0 text-center">
                <span className={`text-[9px] font-bold ${stage.done ? 'text-emerald-400' : currentStage?.id === stage.id ? 'text-amber-400' : 'text-slate-500'}`}>
                  {stage.short}
                </span>
              </div>
              {i < stages.length - 1 && <div className="flex-1" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Expanded detail — timestamps + blocking stage */}
      {expanded && (
        <div className="px-3.5 pb-3.5 border-t border-slate-700/40 pt-2.5 space-y-1.5">
          {stages.map(stage => (
            <div key={stage.id} className="flex items-center gap-2 text-[11px]">
              {stage.done ? (
                <>
                  <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                  <span className="text-slate-300 font-medium">{stage.label}</span>
                  {stage.timestamp && (
                    <span className="text-slate-500 ml-auto tabular-nums">{format(new Date(stage.timestamp), 'HH:mm')}</span>
                  )}
                </>
              ) : (
                <>
                  <div className="w-3 h-3 rounded-full border-2 border-slate-600 flex-shrink-0" />
                  <span className={`font-medium ${currentStage?.id === stage.id ? 'text-amber-400' : 'text-slate-500'}`}>
                    {stage.label}
                    {currentStage?.id === stage.id && ' — pending'}
                  </span>
                </>
              )}
            </div>
          ))}
          {completedCount === 0 && (
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-700/40">
              <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0" />
              <span className="text-[11px] text-amber-400 font-medium">Not started — shift wizard not opened</span>
            </div>
          )}
          {currentStage && completedCount > 0 && completedCount < 4 && (
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-700/40">
              <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0" />
              <span className="text-[11px] text-amber-400 font-medium">
                Blocked at: {currentStage.label}
              </span>
            </div>
          )}
          {completedCount === 4 && (
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-700/40">
              <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
              <span className="text-[11px] text-emerald-400 font-medium">Fully signed on</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}