import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { HardHat, Briefcase, ArrowRightLeft } from 'lucide-react';

/**
 * SubcontractorCrewCard — a visual box showing subcontractors and agency
 * staff assigned to the job via SubcontractorLog entries (the Job Wizard's
 * "Subcontractors" step). Mirrors the CrewCompositionBar style so external
 * resources get the same visual treatment as direct staff.
 */
export default function SubcontractorCrewCard({ job }) {
  const { data: subconLogs = [] } = useQuery({
    queryKey: ['subcon-crew-logs', job.id],
    queryFn: () => base44.entities.SubcontractorLog.filter({ job_id: job.id }, '-date', 200),
    enabled: !!job.id,
  });

  const { data: contractors = [] } = useQuery({
    queryKey: ['subcon-crew-contractors'],
    queryFn: () => base44.entities.Contractor.list('-created_date', 500),
    enabled: subconLogs.length > 0,
  });
  // Pull Staff records (subcontractor/agency) assigned to the job via rota,
  // so we can show their lead/second man names alongside the SubcontractorLog entries.
  // Declared before the drillingCrews query so crewStaffIds is initialized when
  // drillingCrews' enabled option references it (avoids a temporal-dead-zone crash).
  const { data: crewRotas = [] } = useQuery({
    queryKey: ['subcon-crew-rotas', job.id],
    queryFn: () => base44.entities.RotaAssignment.filter({ job_id: job.id }),
    enabled: !!job.id,
  });
  const crewStaffIds = [...new Set(crewRotas.map(r => r.staff_id).filter(Boolean))];
  // Fetch DrillingCrew groupings for subcontractor crew pairings (Lead + Second Man)
  const { data: drillingCrews = [] } = useQuery({
    queryKey: ['subcon-crew-drilling-crews'],
    queryFn: () => base44.entities.DrillingCrew.list('name', 500),
    enabled: subconLogs.length > 0 || crewStaffIds.length > 0,
  });
  const crewsByParent = useMemo(() => {
    const map = {};
    for (const c of drillingCrews) {
      if (!c.parent_staff_id) continue;
      if (!map[c.parent_staff_id]) map[c.parent_staff_id] = [];
      map[c.parent_staff_id].push(c);
    }
    return map;
  }, [drillingCrews]);
  const { data: crewStaff = [] } = useQuery({
    queryKey: ['subcon-crew-staff', crewStaffIds.join(',')],
    queryFn: () => base44.entities.Staff.list(),
    enabled: crewStaffIds.length > 0,
  });
  const subconStaff = crewStaff.filter(s =>
    (s.worker_type === 'subcontractor' || s.worker_type === 'agency') &&
    crewStaffIds.includes(s.id)
  );

  if (subconLogs.length === 0 && subconStaff.length === 0) return null;

  const contractorById = new Map(contractors.map(c => [c.id, c]));

  // Group by subcontractor to avoid duplicate rows
  const bySub = new Map();
  for (const log of subconLogs) {
    const key = log.subcontractor_id || log.subcontractor_name || log.id;
    if (!bySub.has(key)) {
      const contractor = log.subcontractor_id ? contractorById.get(log.subcontractor_id) : null;
      bySub.set(key, {
        name: log.subcontractor_name || contractor?.name || 'Unknown',
        type: contractor?.contractor_type || 'subcontractor',
        work_types: new Set(),
        dates: new Set(),
        total_sell: 0,
        crew_names: [],
      });
    }
    const entry = bySub.get(key);
    if (log.work_type) entry.work_types.add(log.work_type);
    if (log.date) entry.dates.add(log.date);
    entry.total_sell += Number(log.client_charge_net) || 0;
    const names = [log.crew_lead_name, log.crew_second_name, log.worker_name].filter(Boolean);
    for (const n of names) if (!entry.crew_names.includes(n)) entry.crew_names.push(n);
  }

  // Merge in Staff records (subcontractor/agency) assigned via rota that aren't
  // already captured by SubcontractorLog entries. For subcontractors, resolve
  // crew pairings (Lead + Second Man) from DrillingCrew groupings.
  for (const s of subconStaff) {
    const key = s.id;
    const crews = crewsByParent[s.id] || [];
    if (!bySub.has(key)) {
      bySub.set(key, {
        name: s.name || s.company || 'Unknown',
        type: s.worker_type || 'subcontractor',
        work_types: new Set(),
        dates: new Set(crewRotas.filter(r => r.staff_id === s.id).map(r => r.assigned_date).filter(Boolean)),
        total_sell: 0,
        crew_names: [],
        crews,
      });
    } else {
      const entry = bySub.get(key);
      if (crews.length > 0) entry.crews = crews;
    }
  }
  const subs = [...bySub.values()];
  const subcontractors = subs.filter(s => s.type === 'subcontractor');
  const agencies = subs.filter(s => s.type === 'agency');
  const total = subs.length;

  return (
    <div className="hub-glass rounded-2xl p-4 md:p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-sm icon-tile-glow">
          <ArrowRightLeft className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-slate-900">Subcontractors & Agency Staff</h3>
          <p className="text-xs text-slate-500">{total} external {total === 1 ? 'resource' : 'resources'} on this job</p>
        </div>
      </div>

      {/* Proportional bar */}
      <div className="flex h-3 rounded-full overflow-hidden bg-slate-100 mb-4 shadow-inner">
        {subcontractors.length > 0 && (
          <div className="bg-orange-500 transition-all duration-500" style={{ width: `${(subcontractors.length / total) * 100}%` }} title={`Subcontractors: ${subcontractors.length}`} />
        )}
        {agencies.length > 0 && (
          <div className="bg-blue-500 transition-all duration-500" style={{ width: `${(agencies.length / total) * 100}%` }} title={`Agency: ${agencies.length}`} />
        )}
      </div>

      {/* Type cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {subcontractors.length > 0 && (
          <div className="rounded-xl p-3 border bg-orange-50 border-orange-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-orange-500 flex items-center justify-center">
                <HardHat className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-orange-700">Subcontractors</p>
                <p className="text-lg font-bold text-slate-900 leading-none">{subcontractors.length}</p>
              </div>
            </div>
            <div className="space-y-1">
              {subcontractors.slice(0, 5).map((s, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[11px]">
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-500 flex-shrink-0" />
                  <span className="text-slate-700 font-medium truncate flex-1">{s.name}</span>
                  {s.dates.size > 0 && <span className="text-slate-400 text-[10px] flex-shrink-0">{s.dates.size}d</span>}
                </div>
              ))}
              {subcontractors.length > 5 && <p className="text-[10px] text-slate-400 pl-3">+{subcontractors.length - 5} more</p>}
            </div>
          </div>
        )}
        {agencies.length > 0 && (
          <div className="rounded-xl p-3 border bg-blue-50 border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-blue-500 flex items-center justify-center">
                <Briefcase className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-blue-700">Agency Staff</p>
                <p className="text-lg font-bold text-slate-900 leading-none">{agencies.length}</p>
              </div>
            </div>
            <div className="space-y-1">
              {agencies.slice(0, 5).map((s, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[11px]">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                  <span className="text-slate-700 font-medium truncate flex-1">{s.name}</span>
                  {s.dates.size > 0 && <span className="text-slate-400 text-[10px] flex-shrink-0">{s.dates.size}d</span>}
                </div>
              ))}
              {agencies.length > 5 && <p className="text-[10px] text-slate-400 pl-3">+{agencies.length - 5} more</p>}
            </div>
          </div>
        )}
      </div>

      {/* Detail list */}
      <div className="mt-3 space-y-1.5">
        {subs.map((s, i) => (
          <div key={i} className="flex items-center gap-2 py-1.5 border-b border-slate-100 last:border-0">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${s.type === 'agency' ? 'bg-blue-100' : 'bg-orange-100'}`}>
              {s.type === 'agency' ? <Briefcase className="w-3 h-3 text-blue-600" /> : <HardHat className="w-3 h-3 text-orange-600" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-slate-700 truncate">{s.name}</p>
              {s.crew_names.length > 0 && (
                <p className="text-[10px] text-slate-500 truncate">
                  {s.crew_names.join(' · ')}
                </p>
              )}
              {s.crews && s.crews.length > 0 && (
                <div className="space-y-0.5">
                  {s.crews.map((c, ci) => {
                    const parts = [];
                    if (c.lead_driller_name) parts.push(`Lead: ${c.lead_driller_name}${c.lead_driller_phone ? ` (${c.lead_driller_phone})` : ''}`);
                    if (c.second_man_name) parts.push(`Second: ${c.second_man_name}${c.second_man_phone ? ` (${c.second_man_phone})` : ''}`);
                    if (parts.length === 0) return null;
                    return (
                      <p key={ci} className="text-[10px] text-blue-600 font-medium truncate">
                        {parts.join(' · ')}
                      </p>
                    );
                  })}
                </div>
              )}
              <p className="text-[10px] text-slate-400 truncate">
                {[...s.work_types].map(w => w.replace(/_/g, ' ')).join(', ') || 'Work'}
                {s.dates.size > 0 && ` · ${s.dates.size} day${s.dates.size !== 1 ? 's' : ''}`}
              </p>
            </div>
            {s.total_sell > 0 && <span className="text-[10px] font-bold text-emerald-700 flex-shrink-0">£{s.total_sell.toFixed(0)}</span>}
            <span className={`text-[9px] font-semibold rounded-full px-1.5 py-0.5 flex-shrink-0 ${s.type === 'agency' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
              {s.type === 'agency' ? 'Agency' : 'Subcon'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}