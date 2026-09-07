import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useDivision } from '@/contexts/DivisionContext';
import { format } from 'date-fns';
import {
  Car, ShieldCheck, HardHat, FileCheck, Search, Users,
  CheckCircle2, AlertTriangle, XCircle, Loader2, ChevronDown,
  Calendar, Activity, Settings,
} from 'lucide-react';
import { Skeleton } from '@/components/StateViews';

const CHECK_META = {
  vehicle_check: { label: 'Vehicle', icon: Car, short: 'Veh', color: 'blue' },
  powra: { label: 'POWRA', icon: ShieldCheck, short: 'POW', color: 'amber' },
  equipment: { label: 'Equipment', icon: HardHat, short: 'Equip', color: 'emerald' },
  general: { label: 'General', icon: FileCheck, short: 'Gen', color: 'violet' },
};

export default function MissingChecksTab() {
  const queryClient = useQueryClient();
  const { activeDivisionId, activeDivision } = useDivision();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [search, setSearch] = useState('');
  const [jobFilter, setJobFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);

  // Fetch division check config
  const { data: checkConfig, isLoading: configLoading } = useQuery({
    queryKey: ['division-check-config', activeDivisionId],
    queryFn: async () => {
      if (!activeDivisionId) return null;
      const list = await base44.entities.DivisionCheckConfig.filter({ division_id: activeDivisionId });
      return list[0] || null;
    },
    enabled: !!activeDivisionId,
  });

  const enabledCategories = useMemo(() => {
    if (!checkConfig?.check_configs) return [];
    return checkConfig.check_configs.filter(c => c.enabled);
  }, [checkConfig]);

  // Fetch rota assignments for the selected date + division
  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ['missing-checks-assignments', selectedDate, activeDivisionId],
    queryFn: async () => {
      let list = await base44.entities.RotaAssignment.filter({ assigned_date: selectedDate });
      // Filter by division + job type
      list = list.filter(a => (!a.assignment_type || a.assignment_type === 'job'));
      if (activeDivisionId) {
        list = list.filter(a => !a.division_id || a.division_id === activeDivisionId);
      }
      return list;
    },
    enabled: !!selectedDate,
  });

  // Fetch staff
  const { data: staff = [] } = useQuery({
    queryKey: ['staff-for-missing-checks'],
    queryFn: () => base44.entities.Staff.filter({ is_active: true }, 'name', 500),
  });

  // Fetch jobs
  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs-for-missing-checks'],
    queryFn: () => base44.entities.Job.list('-created_date', 500),
  });

  // Fetch safety reports for the selected date (for general audits)
  const { data: safetyReports = [] } = useQuery({
    queryKey: ['safety-reports-for-date', selectedDate],
    queryFn: async () => {
      const list = await base44.entities.SafetyReport.list('-created_date', 200);
      return list.filter(r => {
        if (!r.conducted_at) return false;
        return r.conducted_at.slice(0, 10) === selectedDate;
      });
    },
    enabled: !!selectedDate,
  });

  // Realtime subscription
  useEffect(() => {
    const unsub = base44.entities.RotaAssignment.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['missing-checks-assignments', selectedDate, activeDivisionId] });
    });
    return () => { if (unsub) unsub(); };
  }, [queryClient, selectedDate, activeDivisionId]);

  // Build crew rows with check status
  const crewRows = useMemo(() => {
    return assignments.map(a => {
      const member = staff.find(s => s.id === a.staff_id);
      const job = jobs.find(j => j.id === a.job_id);

      // Build check status per enabled category
      const checks = {};
      enabledCategories.forEach(cat => {
        let done = false;
        let timestamp = null;
        let matchedAudit = null;

        if (cat.category === 'vehicle_check') {
          done = !!a.mitti_vehicle_check_at;
          timestamp = a.mitti_vehicle_check_at;
        } else if (cat.category === 'powra') {
          done = !!a.mitti_powra_at;
          timestamp = a.mitti_powra_at;
        } else if (cat.category === 'equipment') {
          done = !!a.mitti_equipment_check_at;
          timestamp = a.mitti_equipment_check_at;
        } else if (cat.category === 'general') {
          // Match by auditor_email or auditor_name against staff name
          const matching = safetyReports.find(r => {
            if (r.audit_category === 'general' || r.report_type === 'safetyculture_audit') {
              if (r.auditor_email && member?.email && r.auditor_email.toLowerCase() === member.email.toLowerCase()) return true;
              if (r.auditor_name && member?.name && r.auditor_name.toLowerCase() === member.name.toLowerCase()) return true;
            }
            return false;
          });
          done = !!matching;
          timestamp = matching?.conducted_at;
          matchedAudit = matching;
        }

        checks[cat.category] = { done, timestamp, matchedAudit };
      });

      const completedCount = Object.values(checks).filter(c => c.done).length;
      const totalCount = enabledCategories.length;

      return {
        ...a,
        staffName: member?.name || 'Unknown',
        staffEmail: member?.email || '',
        jobName: job?.name || 'Unassigned',
        job,
        checks,
        completedCount,
        totalCount,
      };
    });
  }, [assignments, staff, jobs, safetyReports, enabledCategories]);

  // Summary
  const summary = useMemo(() => {
    const total = crewRows.length;
    const allDone = crewRows.filter(r => r.totalCount > 0 && r.completedCount === r.totalCount).length;
    const partial = crewRows.filter(r => r.completedCount > 0 && r.completedCount < r.totalCount).length;
    const none = crewRows.filter(r => r.completedCount === 0).length;
    return { total, allDone, partial, none };
  }, [crewRows]);

  // Filter + sort (most outstanding first)
  const filtered = useMemo(() => {
    let rows = crewRows;
    if (jobFilter !== 'all') rows = rows.filter(r => r.job_id === jobFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(r => r.staffName.toLowerCase().includes(q) || r.jobName.toLowerCase().includes(q));
    }
    return rows.sort((a, b) => {
      if (a.completedCount !== b.completedCount) return a.completedCount - b.completedCount;
      return a.staffName.localeCompare(b.staffName);
    });
  }, [crewRows, jobFilter, search]);

  const jobOptions = useMemo(() => {
    const map = {};
    crewRows.forEach(r => { if (r.job_id && r.jobName) map[r.job_id] = r.jobName; });
    return Object.entries(map).sort((a, b) => a[1].localeCompare(b[1]));
  }, [crewRows]);

  // No config state
  if (!configLoading && enabledCategories.length === 0) {
    return (
      <div className="rounded-2xl bg-slate-900 border border-slate-700/50 p-8">
        <div className="flex flex-col items-center text-center max-w-md mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/15 flex items-center justify-center mb-4">
            <Settings className="w-7 h-7 text-amber-400" />
          </div>
          <h3 className="text-sm font-bold text-white mb-2">No checks configured for {activeDivision?.name || 'this division'}</h3>
          <p className="text-xs text-slate-400 mb-4">
            Go to <span className="text-emerald-400 font-semibold">Settings → Compliance Check Config</span> to toggle which Mitti check types this division requires.
          </p>
          <a href="/admin" className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition">
            <Settings className="w-3.5 h-3.5" /> Configure Checks
          </a>
        </div>
      </div>
    );
  }

  if (assignmentsLoading || configLoading) {
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
        <div className="w-9 h-9 rounded-lg bg-rose-500/15 flex items-center justify-center flex-shrink-0">
          <Activity className="w-5 h-5 text-rose-400" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">Missing Checks</h3>
          <p className="text-[11px] text-slate-400">
            {activeDivision?.name || 'All divisions'} · {format(new Date(selectedDate), 'EEEE dd MMM yyyy')}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-slate-800 border border-slate-700 text-white rounded-lg focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Summary ribbon */}
      <div className="px-5 py-3 grid grid-cols-3 gap-2 border-b border-slate-700/50 bg-slate-800/30">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-rose-500/15 flex items-center justify-center flex-shrink-0">
            <XCircle className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div>
            <p className="text-base font-bold text-white leading-none tabular-nums">{summary.none}</p>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">No checks</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div>
            <p className="text-base font-bold text-white leading-none tabular-nums">{summary.partial}</p>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">Partial</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div>
            <p className="text-base font-bold text-white leading-none tabular-nums">{summary.allDone}</p>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">All done</p>
          </div>
        </div>
      </div>

      {/* Check type legend */}
      <div className="px-5 py-2 flex items-center gap-3 border-b border-slate-700/50 bg-slate-800/20 flex-wrap">
        <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">Required:</span>
        {enabledCategories.map(cat => {
          const meta = CHECK_META[cat.category];
          if (!meta) return null;
          const Icon = meta.icon;
          return (
            <span key={cat.category} className="inline-flex items-center gap-1 text-[11px] text-slate-300 font-medium">
              <Icon className="w-3 h-3 text-slate-400" />
              {cat.label || meta.label}
            </span>
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
              {crewRows.length === 0 ? 'No crew on rota for this date' : 'No crew match your filters'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(row => (
              <MissingCheckCard
                key={row.id}
                row={row}
                enabledCategories={enabledCategories}
                expanded={expandedId === row.id}
                onToggle={() => setExpandedId(expandedId === row.id ? null : row.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Single crew card ──
function MissingCheckCard({ row, enabledCategories, expanded, onToggle }) {
  const allDone = row.totalCount > 0 && row.completedCount === row.totalCount;
  const noneDone = row.completedCount === 0;

  return (
    <div
      className={`rounded-xl border transition cursor-pointer ${
        allDone
          ? 'bg-emerald-900/20 border-emerald-700/40 hover:border-emerald-600/60'
          : noneDone
            ? 'bg-rose-900/15 border-rose-700/40 hover:border-rose-600/50'
            : 'bg-amber-900/15 border-amber-700/40 hover:border-amber-600/50'
      }`}
      onClick={onToggle}
    >
      {/* Header */}
      <div className="px-3.5 py-3 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center flex-shrink-0 text-white font-bold text-xs">
          {row.staffName?.charAt(0) || '?'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white truncate">{row.staffName}</p>
          <p className="text-[11px] text-slate-400 truncate">{row.jobName}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className={`text-[10px] font-bold tabular-nums ${
            allDone ? 'text-emerald-400' : noneDone ? 'text-rose-400' : 'text-amber-400'
          }`}>
            {row.completedCount}/{row.totalCount}
          </span>
          <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Check pills */}
      <div className="px-3.5 pb-3 flex flex-wrap gap-1.5">
        {enabledCategories.map(cat => {
          const meta = CHECK_META[cat.category];
          const check = row.checks[cat.category];
          const Icon = meta?.icon || FileCheck;

          return (
            <div
              key={cat.category}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold ${
                check?.done
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
              }`}
            >
              {check?.done ? (
                <CheckCircle2 className="w-3 h-3" />
              ) : (
                <XCircle className="w-3 h-3" />
              )}
              {cat.label || meta?.label || cat.category}
            </div>
          );
        })}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-3.5 pb-3.5 border-t border-slate-700/40 pt-2.5 space-y-1.5">
          {enabledCategories.map(cat => {
            const meta = CHECK_META[cat.category];
            const check = row.checks[cat.category];

            return (
              <div key={cat.category} className="flex items-center gap-2 text-[11px]">
                {check?.done ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                    <span className="text-slate-300 font-medium">{cat.label || meta?.label}</span>
                    {check.timestamp && (
                      <span className="text-slate-500 ml-auto tabular-nums">
                        {format(new Date(check.timestamp), 'HH:mm')}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <XCircle className="w-3 h-3 text-rose-400 flex-shrink-0" />
                    <span className="text-rose-400 font-medium">
                      {cat.label || meta?.label} — not completed
                    </span>
                  </>
                )}
              </div>
            );
          })}

          {noneDone && (
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-700/40">
              <AlertTriangle className="w-3 h-3 text-rose-400 flex-shrink-0" />
              <span className="text-[11px] text-rose-400 font-medium">No checks completed today</span>
            </div>
          )}
          {allDone && (
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-700/40">
              <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
              <span className="text-[11px] text-emerald-400 font-medium">All required checks complete</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}