import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useDivision } from '@/contexts/DivisionContext';
import { format } from 'date-fns';
import {
  Car, ShieldCheck, HardHat, FileCheck, Search, Users,
  CheckCircle2, AlertTriangle, XCircle, ChevronDown,
  MapPin, Briefcase, Activity, Clock,
} from 'lucide-react';
import HubCard from '@/components/hubs/HubCard';
import HubLoadingState from '@/components/hubs/HubLoadingState';
import HubEmptyState from '@/components/hubs/HubEmptyState';

const CHECK_META = {
  vehicle_check: { label: 'Vehicle Check', icon: Car, field: 'mitti_vehicle_check_at' },
  powra: { label: 'POWRA', icon: ShieldCheck, field: 'mitti_powra_at' },
  equipment: { label: 'Equipment Check', icon: HardHat, field: 'mitti_equipment_check_at' },
  general: { label: 'General', icon: FileCheck, field: null },
};

const PIPELINE_STAGES = [
  { id: 'arrived', label: 'Arrived on Site', icon: MapPin, field: 'arrived_on_site_at' },
  { id: 'briefing', label: 'Briefing Signed', icon: ShieldCheck, field: 'briefing_signed_at' },
  { id: 'working', label: 'Started Working', icon: Briefcase, field: 'started_at' },
];

/**
 * CrewShiftStatusWidget — Compliance Hub widget showing every active crew
 * member's full shift check breakdown: individual Mitti checks (Vehicle,
 * POWRA, Equipment, General) plus shift pipeline stages (arrived, briefing,
 * working), each with live status and timestamps.
 *
 * Uses HubCard/hub-glass light design system. Live-refreshes via
 * RotaAssignment realtime subscription.
 */
export default function CrewShiftStatusWidget() {
  const [search, setSearch] = useState('');
  const [jobFilter, setJobFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const queryClient = useQueryClient();
  const { activeDivisionId, activeDivision } = useDivision();

  const todayStr = selectedDate;

  // Fetch division check config
  const { data: checkConfig, isLoading: configLoading } = useQuery({
    queryKey: ['division-check-config-shift', activeDivisionId],
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

  // Fetch today's job assignments
  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['crew-shift-status', selectedDate, activeDivisionId],
    queryFn: async () => {
      let list = await base44.entities.RotaAssignment.filter({ assigned_date: todayStr });
      list = list.filter(a => !a.assignment_type || a.assignment_type === 'job');
      if (activeDivisionId) {
        list = list.filter(a => !a.division_id || a.division_id === activeDivisionId);
      }
      return list;
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

  const { data: safetyReports = [] } = useQuery({
    queryKey: ['safety-reports-shift-status', todayStr],
    queryFn: async () => {
      const list = await base44.entities.SafetyReport.list('-created_date', 200);
      return list.filter(r => {
        if (!r.conducted_at) return false;
        return r.conducted_at.slice(0, 10) === todayStr;
      });
    },
  });

  // Realtime subscription
  useEffect(() => {
    const unsub = base44.entities.RotaAssignment.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['crew-shift-status', selectedDate, activeDivisionId] });
    });
    return () => { if (unsub) unsub(); };
  }, [queryClient, selectedDate, activeDivisionId]);

  // Build enriched crew rows with full check breakdown
  const crewRows = useMemo(() => {
    return assignments.map(a => {
      const member = staff.find(s => s.id === a.staff_id);
      const job = jobs.find(j => j.id === a.job_id);

      // Build individual Mitti check status
      const mittiChecks = {};
      enabledCategories.forEach(cat => {
        let done = false;
        let timestamp = null;

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
          const matching = safetyReports.find(r => {
            if (r.audit_category === 'general' || r.report_type === 'safetyculture_audit') {
              if (r.auditor_email && member?.email && r.auditor_email.toLowerCase() === member.email.toLowerCase()) return true;
              if (r.auditor_name && member?.name && r.auditor_name.toLowerCase() === member.name.toLowerCase()) return true;
            }
            return false;
          });
          done = !!matching;
          timestamp = matching?.conducted_at;
        }

        mittiChecks[cat.category] = { done, timestamp, label: cat.label || CHECK_META[cat.category]?.label || cat.category };
      });

      // Build pipeline stage status
      const pipeline = {};
      PIPELINE_STAGES.forEach(stage => {
        let done = false;
        let timestamp = a[stage.field] || null;

        if (stage.id === 'arrived') done = !!a.arrived_on_site_at;
        else if (stage.id === 'briefing') done = !!a.briefing_signed;
        else if (stage.id === 'working') done = (a.status || 'assigned') === 'started' || (a.status || 'assigned') === 'completed';

        pipeline[stage.id] = { done, timestamp, label: stage.label };
      });

      // Total counts
      const mittiDone = Object.values(mittiChecks).filter(c => c.done).length;
      const mittiTotal = enabledCategories.length;
      const pipelineDone = Object.values(pipeline).filter(s => s.done).length;
      const pipelineTotal = PIPELINE_STAGES.length;
      const totalDone = mittiDone + pipelineDone;
      const totalChecks = mittiTotal + pipelineTotal;

      return {
        ...a,
        staffName: member?.name || 'Unknown',
        staffEmail: member?.email || '',
        jobName: job?.name || 'Unassigned',
        job,
        mittiChecks,
        pipeline,
        mittiDone,
        mittiTotal,
        pipelineDone,
        pipelineTotal,
        totalDone,
        totalChecks,
      };
    });
  }, [assignments, staff, jobs, safetyReports, enabledCategories]);

  // Summary counts
  const summary = useMemo(() => {
    let allChecksDone = 0, partialChecks = 0, noChecks = 0, working = 0;
    crewRows.forEach(r => {
      if (r.totalChecks > 0 && r.totalDone === r.totalChecks) allChecksDone++;
      else if (r.totalDone === 0) noChecks++;
      else partialChecks++;
      if ((r.status || 'assigned') === 'started' || (r.status || 'assigned') === 'completed') working++;
    });
    return { total: crewRows.length, allChecksDone, partialChecks, noChecks, working };
  }, [crewRows]);

  // Filter
  const filtered = useMemo(() => {
    let rows = crewRows;
    if (jobFilter !== 'all') rows = rows.filter(r => r.job_id === jobFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(r => r.staffName.toLowerCase().includes(q) || r.jobName.toLowerCase().includes(q));
    }
    return rows.sort((a, b) => {
      if (a.totalDone !== b.totalDone) return a.totalDone - b.totalDone;
      return a.staffName.localeCompare(b.staffName);
    });
  }, [crewRows, jobFilter, search]);

  const jobOptions = useMemo(() => {
    const map = {};
    crewRows.forEach(r => { if (r.job_id && r.jobName) map[r.job_id] = r.jobName; });
    return Object.entries(map).sort((a, b) => a[1].localeCompare(b[1]));
  }, [crewRows]);

  if (isLoading || configLoading) {
    return <HubLoadingState variant="list" count={6} label="Loading crew shift status…" />;
  }

  if (crewRows.length === 0) {
    return (
      <HubEmptyState
        icon={Users}
        title="No crew on rota for this date"
        description="Crew members with job assignments for the selected date will appear here with their full check breakdown."
      />
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="hub-glass rounded-2xl p-3 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <p className="text-xl font-extrabold text-slate-900 leading-none tabular-nums">{summary.allChecksDone}</p>
            <p className="text-[10px] text-slate-500 font-semibold mt-0.5">All done</p>
          </div>
        </div>
        <div className="hub-glass rounded-2xl p-3 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <p className="text-xl font-extrabold text-slate-900 leading-none tabular-nums">{summary.partialChecks}</p>
            <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Partial</p>
          </div>
        </div>
        <div className="hub-glass rounded-2xl p-3 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center flex-shrink-0">
            <XCircle className="w-4 h-4 text-rose-600" />
          </div>
          <div>
            <p className="text-xl font-extrabold text-slate-900 leading-none tabular-nums">{summary.noChecks}</p>
            <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Not started</p>
          </div>
        </div>
        <div className="hub-glass rounded-2xl p-3 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Briefcase className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <p className="text-xl font-extrabold text-slate-900 leading-none tabular-nums">{summary.working}</p>
            <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Working</p>
          </div>
        </div>
      </div>

      {/* Main card with filter + crew grid */}
      <HubCard
        icon={Activity}
        title="Crew Shift Status"
        subtitle={`${activeDivision?.name || 'All divisions'} · ${format(new Date(selectedDate), 'EEEE dd MMM yyyy')}`}
        tone="brand"
        action={
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              {summary.working}/{summary.total} working
            </span>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 text-slate-700 rounded-lg focus:outline-none focus:border-[#2E5A1A]"
            />
          </div>
        }
      >
        {/* Filter bar */}
        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search crew or job…"
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 text-slate-700 rounded-lg focus:outline-none focus:border-[#2E5A1A] placeholder:text-slate-400"
            />
          </div>
          <select
            value={jobFilter}
            onChange={e => setJobFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 text-slate-700 rounded-lg focus:outline-none focus:border-[#2E5A1A] max-w-[160px]"
          >
            <option value="all">All jobs</option>
            {jobOptions.map(([jid, jname]) => (
              <option key={jid} value={jid}>{jname}</option>
            ))}
          </select>
        </div>

        {/* Crew cards grid */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Users className="w-8 h-8 text-slate-300 mb-2" />
            <p className="text-sm text-slate-500 font-medium">
              {crewRows.length === 0 ? 'No crew on rota today' : 'No crew match your filters'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[600px] overflow-y-auto">
            {filtered.map(a => (
              <CrewShiftCard
                key={a.id}
                assignment={a}
                enabledCategories={enabledCategories}
                expanded={expandedId === a.id}
                onToggle={() => setExpandedId(expandedId === a.id ? null : a.id)}
              />
            ))}
          </div>
        )}
      </HubCard>
    </div>
  );
}

// ── Single crew card with full check breakdown ──
function CrewShiftCard({ assignment, enabledCategories, expanded, onToggle }) {
  const allDone = assignment.totalChecks > 0 && assignment.totalDone === assignment.totalChecks;
  const noneDone = assignment.totalDone === 0;

  return (
    <div
      className={`insight-card rounded-2xl border transition cursor-pointer ${
        allDone
          ? 'border-emerald-200 hover:border-emerald-300'
          : noneDone
            ? 'border-rose-200 hover:border-rose-300'
            : 'border-amber-200 hover:border-amber-300'
      }`}
      onClick={onToggle}
    >
      {/* Card header — avatar + name + job */}
      <div className="px-3.5 py-3 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center flex-shrink-0 text-white font-bold text-xs">
          {assignment.staffName?.charAt(0) || '?'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900 truncate">{assignment.staffName}</p>
          <p className="text-[11px] text-slate-500 truncate">{assignment.jobName}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className={`text-[10px] font-bold tabular-nums ${
            allDone ? 'text-emerald-600' : noneDone ? 'text-rose-600' : 'text-amber-600'
          }`}>
            {assignment.totalDone}/{assignment.totalChecks}
          </span>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Compact check pills */}
      <div className="px-3.5 pb-3 flex flex-wrap gap-1.5">
        {enabledCategories.map(cat => {
          const meta = CHECK_META[cat.category];
          const check = assignment.mittiChecks[cat.category];
          const Icon = meta?.icon || FileCheck;
          return (
            <div
              key={cat.category}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold ${
                check?.done
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-50 text-rose-600 border border-rose-200'
              }`}
            >
              {check?.done ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
              {check?.label || cat.label || meta?.label}
            </div>
          );
        })}
        {PIPELINE_STAGES.map(stage => {
          const s = assignment.pipeline[stage.id];
          const Icon = stage.icon;
          return (
            <div
              key={stage.id}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold ${
                s?.done
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-slate-50 text-slate-500 border border-slate-200'
              }`}
            >
              {s?.done ? <CheckCircle2 className="w-3 h-3" /> : <Icon className="w-3 h-3" />}
              {stage.label}
            </div>
          );
        })}
      </div>

      {/* Expanded detail — full check breakdown with timestamps */}
      {expanded && (
        <div className="px-3.5 pb-3.5 border-t border-slate-100 pt-2.5 space-y-1.5">
          {/* Mitti checks section */}
          {enabledCategories.length > 0 && (
            <>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Mitti Checks</p>
              {enabledCategories.map(cat => {
                const meta = CHECK_META[cat.category];
                const check = assignment.mittiChecks[cat.category];
                const Icon = meta?.icon || FileCheck;
                return (
                  <div key={cat.category} className="flex items-center gap-2 text-[11px]">
                    {check?.done ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                        <Icon className="w-3 h-3 text-slate-400 flex-shrink-0" />
                        <span className="text-slate-700 font-medium">{check?.label || cat.label || meta?.label}</span>
                        {check.timestamp && (
                          <span className="text-slate-400 ml-auto tabular-nums">
                            {format(new Date(check.timestamp), 'HH:mm')}
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3 h-3 text-rose-500 flex-shrink-0" />
                        <Icon className="w-3 h-3 text-slate-300 flex-shrink-0" />
                        <span className="text-rose-600 font-medium">{check?.label || cat.label || meta?.label}</span>
                        <span className="text-slate-400 ml-auto">—</span>
                      </>
                    )}
                  </div>
                );
              })}
            </>
          )}

          {/* Divider */}
          {enabledCategories.length > 0 && <div className="border-t border-slate-100 my-2" />}

          {/* Pipeline stages section */}
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Shift Pipeline</p>
          {PIPELINE_STAGES.map(stage => {
            const s = assignment.pipeline[stage.id];
            const Icon = stage.icon;
            return (
              <div key={stage.id} className="flex items-center gap-2 text-[11px]">
                {s?.done ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                    <Icon className="w-3 h-3 text-slate-400 flex-shrink-0" />
                    <span className="text-slate-700 font-medium">{stage.label}</span>
                    {s.timestamp && (
                      <span className="text-slate-400 ml-auto tabular-nums">
                        {format(new Date(s.timestamp), 'HH:mm')}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <div className="w-3 h-3 rounded-full border-2 border-slate-300 flex-shrink-0" />
                    <Icon className="w-3 h-3 text-slate-300 flex-shrink-0" />
                    <span className="text-slate-500 font-medium">{stage.label}</span>
                    <span className="text-slate-400 ml-auto">—</span>
                  </>
                )}
              </div>
            );
          })}

          {/* Status footer */}
          {noneDone && (
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100">
              <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" />
              <span className="text-[11px] text-amber-600 font-medium">Not started — shift wizard not opened</span>
            </div>
          )}
          {allDone && (
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100">
              <CheckCircle2 className="w-3 h-3 text-emerald-600 flex-shrink-0" />
              <span className="text-[11px] text-emerald-600 font-medium">Fully signed on — all checks complete</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}