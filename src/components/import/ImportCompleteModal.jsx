import React, { useState, useEffect } from 'react';
import {
  CheckCircle2, X, RefreshCw, Users, Briefcase, CalendarDays,
  Trash2, Building2, Clock, Layers, GraduationCap, Palmtree,
  ChevronDown, ChevronRight, MapPin, UserX, Building, HardHat,
  AlertCircle, FileSpreadsheet, Sparkles, TrendingUp, Archive, Filter,
} from 'lucide-react';

// Visual pop-up modal shown when an import completes.
// Handles both planner (full wipe & rebuild) and legacy (non-destructive) results.
export default function ImportCompleteModal({ result, onClose, type = 'planner' }) {
  const [showBreakdown, setShowBreakdown] = useState(false);

  // Prevent body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  if (!result) return null;
  const s = result.summary || {};
  const isPlanner = type === 'planner';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 backdrop-blur-md p-3 sm:p-6">
      <div className="relative w-full max-w-3xl my-4 hub-glass rounded-3xl overflow-hidden shadow-2xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition"
        >
          <X className="w-5 h-5 text-slate-500" />
        </button>

        {/* === Hero success banner === */}
        <div className="command-gradient px-6 py-8 text-center text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 left-1/4 w-32 h-32 bg-white/30 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-40 h-40 bg-white/20 rounded-full blur-3xl" />
          </div>
          <div className="relative">
            <div className="w-20 h-20 mx-auto mb-3 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center animate-[bounce_1s_ease-in-out]">
              <CheckCircle2 className="w-12 h-12 text-white" strokeWidth={2.5} />
            </div>
            <h2 className="text-2xl font-bold mb-1">
              {isPlanner ? 'Import Complete!' : 'Legacy Import Complete!'}
            </h2>
            <p className="text-sm text-white/80">
              {isPlanner
                ? `${s.target_tabs?.length || 0} active tab(s)${s.legacy?.sheet_count ? ` + ${s.legacy.sheet_count} legacy tab(s)` : ''} · everything rebuilt fresh`
                : `${s.legacy_sheets?.length || 0} legacy sheet(s) processed · non-destructive`}
            </p>
          </div>
        </div>

        <div className="p-5 sm:p-6 space-y-5 max-h-[calc(100vh-280px)] overflow-y-auto">
          {/* === Visual flow (planner only) === */}
          {isPlanner && (
            <div className="flex items-center justify-center gap-2 sm:gap-3 text-xs font-medium">
              <FlowStep icon={FileSpreadsheet} label="Parsed" sub={`${s.total_assignments_parsed || 0} rows`} color="amber" />
              <FlowArrow />
              <FlowStep icon={Users} label="Staff Synced" sub={`${s.staff?.replaced || 0} replaced`} color="blue" />
              <FlowArrow />
              <FlowStep icon={Sparkles} label="Rebuilt" sub={`${s.rotas?.created || s.rotas?.to_create || 0} rotas`} color="emerald" />
            </div>
          )}

          {/* === Stat tiles === */}
          {isPlanner ? (
            <>
              {/* Purge strip — Staff & Teams preserved, only operational data wiped */}
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Trash2 className="w-4 h-4 text-rose-600" />
                  <p className="text-sm font-bold text-rose-800">Wiped (Staff & Teams Preserved)</p>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  <MiniStat value={s.purge?.rotas_deleted || 0} label="Rotas" />
                  <MiniStat value={s.purge?.jobs_deleted || 0} label="Jobs" />
                  <MiniStat value={s.purge?.crews_deleted || 0} label="Crews" />
                  <MiniStat value={s.purge?.cost_items_deleted || 0} label="Cost Items" />
                  <MiniStat value={s.purge?.asset_assignments_deleted || 0} label="Assets" />
                  <MiniStat value={s.purge?.training_bookings_deleted || 0} label="Training" />
                </div>
              </div>

              {/* Created tiles */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <VisualStat icon={Users} value={(s.staff?.new || 0) + (s.staff?.replaced || 0)} label="Staff Synced" sub={`${s.staff?.replaced || 0} replaced · ${s.staff?.subcontractors || 0} subcon created`} gradient="stat-gradient-blue" />
                <VisualStat icon={Briefcase} value={s.jobs?.new || 0} label="Jobs Created" sub={`${s.jobs?.completed || 0} done`} gradient="stat-gradient-emerald" />
                {s.jobs?.filtered_as_non_jobs > 0 && (
                  <VisualStat icon={Filter} value={s.jobs?.filtered_as_non_jobs || 0} label="Filtered" sub="not real jobs" gradient="stat-gradient-amber" />
                )}
                <VisualStat icon={CalendarDays} value={s.rotas?.created || 0} label="Rotas Created" sub={`${s.rotas?.duplicates_collapsed || 0} dupes`} gradient="stat-gradient-amber" />
                <VisualStat icon={Layers} value={(s.projects?.existing_matched || 0) + (s.projects?.new_created || 0)} label="Projects" sub={`${s.projects?.new_created || 0} new`} gradient="stat-gradient-violet" />
                <VisualStat icon={HardHat} value={s.crew_cost_items?.created || s.crew_cost_items?.total || 0} label="Crew Cost Items" sub={`${s.crew_cost_items?.labour || 0} labour · ${s.crew_cost_items?.contractor_supplied || 0} subcon`} gradient="stat-gradient-teal" />
                <VisualStat icon={GraduationCap} value={(s.training?.courses_new || 0) + (s.training?.courses_matched || 0)} label="Training" sub={`${s.training?.bookings_created || 0} bookings`} gradient="stat-gradient-indigo" />
                <VisualStat icon={Palmtree} value={s.absences?.created || 0} label="Absences" sub={`${s.absences?.holiday || 0} hol`} gradient="stat-gradient-rose" />
                <VisualStat icon={Layers} value={s.rig_assignments?.total || 0} label="Rig & Gear" sub={`${s.rig_assignments?.rigs || 0} rigs · ${s.rig_assignments?.linked_equipment || 0} gear`} gradient="stat-gradient-amber" />
                {s.legacy?.sheet_count > 0 && (
                  <VisualStat icon={Archive} value={s.legacy?.assignment_count || 0} label="Legacy Data" sub={`${s.legacy?.sheet_count} tabs · historical`} gradient="stat-gradient-violet" />
                )}
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <VisualStat icon={Users} value={s.matched_staff || 0} label="Matched Staff" sub={`${s.unmatched_staff || 0} unmatched`} gradient="stat-gradient-blue" />
              <VisualStat icon={Briefcase} value={s.matched_jobs || 0} label="Matched Jobs" sub={`${s.unmatched_jobs || 0} unmatched`} gradient="stat-gradient-emerald" />
              <VisualStat icon={CalendarDays} value={s.rotas_created || s.rotas_to_create || 0} label="Rotas Created" sub={`${s.duplicates_skipped || 0} dupes`} gradient="stat-gradient-amber" />
              <VisualStat icon={Palmtree} value={s.absences_created || s.absences_to_create || 0} label="Absences" sub="holiday/sick/training" gradient="stat-gradient-rose" />
              <VisualStat icon={Archive} value={s.legacy_sheets?.length || 0} label="Legacy Sheets" sub="processed" gradient="stat-gradient-violet" />
              <VisualStat icon={TrendingUp} value={s.total_assignments || 0} label="Total Rows" sub="parsed" gradient="stat-gradient-teal" />
            </div>
          )}

          {/* === Agency breakdown (planner only) === */}
          {isPlanner && s.agencies?.total > 0 && (
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                <Building className="w-4 h-4" /> Agency Suppliers ({s.agencies.total})
              </p>
              <div className="space-y-1.5">
                {Object.entries(s.agencies.breakdown).map(([name, data], i) => (
                  <div key={i} className="bg-cyan-50 border border-cyan-200 rounded-lg px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-cyan-600" />
                      <span className="text-sm font-medium text-cyan-900">{name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-cyan-700">
                      <span><strong>{data.workers}</strong> workers</span>
                      <span><strong>{data.assignments}</strong> assignments</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* === Unmatched (legacy only) === */}
          {!isPlanner && (result.unmatched_staff?.length > 0 || result.unmatched_jobs?.length > 0) && (
            <div className="space-y-3">
              {result.unmatched_staff?.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-rose-700 mb-1.5 flex items-center gap-1.5">
                    <UserX className="w-4 h-4" /> Unmatched Staff ({result.unmatched_staff.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {result.unmatched_staff.map((name, i) => (
                      <span key={i} className="text-xs bg-rose-100 text-rose-600 rounded-full px-2.5 py-1">{name}</span>
                    ))}
                  </div>
                </div>
              )}
              {result.unmatched_jobs?.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-rose-700 mb-1.5 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" /> Unmatched Jobs ({result.unmatched_jobs.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {result.unmatched_jobs.map((name, i) => (
                      <span key={i} className="text-xs bg-rose-100 text-rose-600 rounded-full px-2.5 py-1">{name}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* === Collapsible detail breakdown === */}
          <button
            onClick={() => setShowBreakdown(!showBreakdown)}
            className="w-full flex items-center gap-2 text-left bg-slate-50 hover:bg-slate-100 rounded-xl px-4 py-3 transition"
          >
            {showBreakdown ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
            <Layers className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-semibold text-slate-700">Full Breakdown</span>
          </button>

          {showBreakdown && (
            <div className="space-y-3">
              {isPlanner ? (
                <>
                  {result.staff_breakdown?.length > 0 && (
                    <DetailList title={`Staff (${result.staff_breakdown.length})`} icon={Users}>
                      {result.staff_breakdown.map((st, i) => (
                        <div key={i} className="bg-slate-50 rounded-lg px-3 py-2 text-sm">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-700">{st.name}</span>
                              <span className={`text-xs rounded-full px-2 py-0.5 ${st.worker_type === 'subcontractor' ? 'bg-indigo-100 text-indigo-700' : st.worker_type === 'agency' ? 'bg-cyan-100 text-cyan-700' : 'bg-slate-100 text-slate-600'}`}>
                                {st.worker_type === 'subcontractor' ? 'Subcon' : st.worker_type === 'agency' ? 'Agency' : 'Direct'}
                              </span>
                            </div>
                            <span className="text-xs text-slate-400">{st.assignment_count} assignments</span>
                          </div>
                          <div className="text-xs text-slate-500 mt-1">{st.email} · {st.team}</div>
                        </div>
                      ))}
                    </DetailList>
                  )}
                  {result.jobs_breakdown?.length > 0 && (
                    <DetailList title={`Jobs (${result.jobs_breakdown.length})`} icon={Briefcase}>
                      {result.jobs_breakdown.map((j, i) => (
                        <div key={i} className="bg-slate-50 rounded-lg px-3 py-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-slate-700">{j.name}</span>
                            <StatusBadge status={j.status} />
                          </div>
                          <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-3">
                            {j.location && <span><MapPin className="w-3 h-3 inline" /> {j.location}</span>}
                            <span>📅 {j.start_date || '—'} → {j.end_date || '—'}</span>
                            <span>👷 {j.staff_count} staff</span>
                          </div>
                        </div>
                      ))}
                    </DetailList>
                  )}
                  {result.training_breakdown?.length > 0 && (
                    <DetailList title={`Training (${result.training_breakdown.length})`} icon={GraduationCap}>
                      {result.training_breakdown.map((t, i) => (
                        <div key={i} className="bg-slate-50 rounded-lg px-3 py-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-slate-700">{t.title}</span>
                            <span className={`text-xs rounded-full px-2 py-0.5 ${t.status === 'completed' ? 'bg-slate-200 text-slate-700' : 'bg-blue-100 text-blue-700'}`}>
                              {t.status === 'completed' ? 'Completed' : 'Scheduled'}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 mt-1">📅 {t.start_date} · 👥 {t.staff_names.join(', ')}</div>
                        </div>
                      ))}
                    </DetailList>
                  )}
                  {result.absence_breakdown?.length > 0 && (
                    <DetailList title={`Absences (${result.absence_breakdown.length})`} icon={Palmtree}>
                      {result.absence_breakdown.map((a, i) => (
                        <div key={i} className="bg-slate-50 rounded-lg px-3 py-2 text-sm">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-700">{a.staff_name}</span>
                              <span className={`text-xs rounded-full px-2 py-0.5 ${a.reason === 'holiday' ? 'bg-teal-100 text-teal-700' : a.reason === 'sick' ? 'bg-rose-100 text-rose-700' : 'bg-violet-100 text-violet-700'}`}>
                                {a.reason === 'holiday' ? 'Holiday' : a.reason === 'sick' ? 'Sick' : 'Training'}
                              </span>
                            </div>
                            <span className="text-xs text-slate-400">{a.days} day{a.days !== 1 ? 's' : ''}</span>
                          </div>
                          <div className="text-xs text-slate-500 mt-1">📅 {a.start_date}{a.end_date !== a.start_date ? ` → ${a.end_date}` : ''}</div>
                        </div>
                      ))}
                    </DetailList>
                  )}
                </>
              ) : (
                <>
                  {result.sheet_breakdown?.length > 0 && (
                    <DetailList title="Sheet Breakdown" icon={FileSpreadsheet}>
                      {result.sheet_breakdown.map((sh, i) => (
                        <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-sm">
                          <span className="font-medium text-slate-700">{sh.sheet}</span>
                          <span className="text-xs text-slate-500">{sh.assignments} rows {sh.date_range ? `(${sh.date_range.from} → ${sh.date_range.to})` : ''}</span>
                        </div>
                      ))}
                    </DetailList>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* === Footer action === */}
        <div className="px-5 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          <button
            onClick={onClose}
            className="command-gradient text-white w-full px-5 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition hover:shadow-lg"
          >
            <RefreshCw className="w-4 h-4" /> Start New Import
          </button>
        </div>
      </div>
    </div>
  );
}

function FlowStep({ icon: Icon, label, sub, color }) {
  const colors = {
    rose: 'bg-rose-100 text-rose-600',
    amber: 'bg-amber-100 text-amber-600',
    emerald: 'bg-emerald-100 text-emerald-600',
    blue: 'bg-blue-100 text-blue-600',
  };
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`w-12 h-12 rounded-xl ${colors[color]} flex items-center justify-center`}>
        <Icon className="w-6 h-6" />
      </div>
      <span className="font-semibold text-slate-700">{label}</span>
      <span className="text-[10px] text-slate-400">{sub}</span>
    </div>
  );
}

function FlowArrow() {
  return <div className="flex-1 h-0.5 bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200 rounded-full max-w-[40px]" />;
}

function MiniStat({ value, label }) {
  return (
    <div className="bg-white rounded-lg px-2 py-2 text-center">
      <p className="text-lg font-bold text-rose-600 tabular-nums">{value}</p>
      <p className="text-[10px] text-slate-500">{label}</p>
    </div>
  );
}

function VisualStat({ icon: Icon, value, label, sub, gradient }) {
  return (
    <div className={`${gradient} rounded-2xl p-4 text-white relative overflow-hidden`}>
      <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-8 -mt-8" />
      <Icon className="w-6 h-6 mb-2 opacity-80 relative" />
      <p className="text-3xl font-bold tabular-nums relative">{value}</p>
      <p className="text-xs opacity-90 relative">{label}</p>
      {sub && <p className="text-[10px] mt-1 bg-white/20 rounded-full px-2 py-0.5 inline-block relative">{sub}</p>}
    </div>
  );
}

function DetailList({ title, icon: Icon, children }) {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
        <Icon className="w-4 h-4 text-slate-500" /> {title}
      </p>
      <div className="space-y-1.5 max-h-60 overflow-y-auto">{children}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    completed: { label: 'Completed', cls: 'bg-slate-200 text-slate-700' },
    in_progress: { label: 'In Progress', cls: 'bg-teal-100 text-teal-700' },
    planning: { label: 'Planning', cls: 'bg-blue-100 text-blue-700' },
  };
  const cfg = map[status] || map.planning;
  return <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${cfg.cls}`}>{cfg.label}</span>;
}