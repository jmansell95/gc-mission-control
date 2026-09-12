import React, { useMemo, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { HardHat, Users, PoundSterling, Briefcase, ChevronRight, ChevronDown, Wrench, Truck, TrendingUp } from 'lucide-react';
import { Skeleton } from '@/components/StateViews';
import { eachDayOfInterval, isWeekend } from 'date-fns';
import { useJobFilter } from '@/components/dashboard/JobFilterContext';
import StatCard from '@/components/dashboard/StatCard';
import { findRigRateCardItem } from '@/components/logistics/rigRateMatcher';

const fmtGBP = (n) => '£' + (Math.round((n || 0) * 100) / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function workingDays(start, end) {
  if (!start || !end) return 0;
  const s = new Date(start), e = new Date(end);
  if (e < s) return 0;
  return eachDayOfInterval({ start: s, end }).filter(d => !isWeekend(d)).length;
}

const GEAR_META = {
  machinery: { label: 'Machinery', icon: Wrench, color: 'text-blue-700 bg-blue-50' },
  trailer: { label: 'Trailer', icon: Truck, color: 'text-amber-700 bg-amber-50' },
  vehicle: { label: 'Vehicle', icon: Truck, color: 'text-violet-700 bg-violet-50' },
  lifting: { label: 'Lifting Gear', icon: Wrench, color: 'text-rose-700 bg-rose-50' },
};

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function AssetCrewProfitability({ onSelectJob }) {
  const [tab, setTab] = useState('rigs');
  const [expandedRigs, setExpandedRigs] = useState(new Set());
  const { selectedJobId } = useJobFilter();
  const isAllJobs = selectedJobId === 'all';
  const queryClient = useQueryClient();

  const toggleRig = (id) => {
    setExpandedRigs(prev => { const s = new Set(prev); if (s.has(id)) s.delete(id); else s.add(id); return s; });
  };

  // Click a rig row: if it's on exactly one job, go straight to it. Otherwise toggle gear.
  const handleRigClick = (r) => {
    if (r.jobIds.length === 1 && onSelectJob) {
      const job = jobById[r.jobIds[0]];
      if (job) { onSelectJob(job); return; }
    }
    if (r.gear.length > 0) toggleRig(r.id);
  };

  // Live updates: invalidate the relevant queries whenever assignments or rotas change
  useEffect(() => {
    const unsubs = [];
    try {
      unsubs.push(base44.entities.JobAssetAssignment.subscribe(() => {
        queryClient.invalidateQueries({ queryKey: ['job-asset-assignments-profit'] });
      }));
    } catch (e) {}
    try {
      unsubs.push(base44.entities.RotaAssignment.subscribe(() => {
        queryClient.invalidateQueries({ queryKey: ['rotas-profit'] });
      }));
    } catch (e) {}
    try {
      unsubs.push(base44.entities.Timesheet.subscribe(() => {
        queryClient.invalidateQueries({ queryKey: ['timesheets-profit'] });
      }));
    } catch (e) {}
    try {
      unsubs.push(base44.entities.InvestigationLog.subscribe(() => {
        queryClient.invalidateQueries({ queryKey: ['investigation-logs-profit'] });
      }));
    } catch (e) {}
    try {
      unsubs.push(base44.entities.DeliveryLog.subscribe(() => {
        queryClient.invalidateQueries({ queryKey: ['delivery-logs-profit'] });
      }));
    } catch (e) {}
    return () => unsubs.forEach(u => u && u());
  }, [queryClient]);

  const { data: assets = [], isLoading } = useQuery({ queryKey: ['site-assets-profit'], queryFn: () => base44.entities.SiteAsset.list() });
  const { data: assignments = [] } = useQuery({ queryKey: ['job-asset-assignments-profit'], queryFn: () => base44.entities.JobAssetAssignment.list(), staleTime: 0 });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs-profit'], queryFn: () => base44.entities.Job.list() });
  const { data: staff = [] } = useQuery({ queryKey: ['staff-profit'], queryFn: () => base44.entities.Staff.list() });
  const { data: rotas = [] } = useQuery({ queryKey: ['rotas-profit'], queryFn: () => base44.entities.RotaAssignment.list(), staleTime: 0 });
  const { data: timesheets = [] } = useQuery({ queryKey: ['timesheets-profit'], queryFn: () => base44.entities.Timesheet.list('-created_date', 200), staleTime: 0 });
  const { data: invLogs = [] } = useQuery({ queryKey: ['investigation-logs-profit'], queryFn: () => base44.entities.InvestigationLog.list('-created_date', 200), staleTime: 0 });
  const { data: deliveries = [] } = useQuery({ queryKey: ['delivery-logs-profit'], queryFn: () => base44.entities.DeliveryLog.list('-created_date', 200), staleTime: 0 });
  const { data: rateCardItems = [] } = useQuery({ queryKey: ['rate-card-items-profit'], queryFn: () => base44.entities.RateCardItem.list(), staleTime: 60000 });

  const scopedAssignments = isAllJobs ? assignments : assignments.filter(a => a.job_id === selectedJobId);
  const scopedRotas = isAllJobs ? rotas : rotas.filter(r => r.job_id === selectedJobId);
  const scopedTimesheets = isAllJobs ? timesheets : timesheets.filter(t => t.job_id === selectedJobId);
  const scopedInvLogs = isAllJobs ? invLogs : invLogs.filter(l => l.job_id === selectedJobId);
  const scopedDeliveries = isAllJobs ? deliveries : deliveries.filter(d => d.job_id === selectedJobId);

  const jobById = useMemo(() => Object.fromEntries(jobs.map(j => [j.id, j])), [jobs]);
  const staffById = useMemo(() => Object.fromEntries(staff.map(s => [s.id, s])), [staff]);

  // ---- Rigs currently on jobs (active assignments, not returned) ----
  const rigRows = useMemo(() => {
    const today = new Date();
    const rigs = assets.filter(a => a.asset_type === 'rig');
    const rigById = Object.fromEntries(rigs.map(r => [r.id, r]));
    const gearById = Object.fromEntries(assets.filter(a => a.asset_type !== 'rig').map(g => [g.id, g]));

    const activeByRig = {};
    scopedAssignments.forEach(a => {
      if (!rigById[a.asset_id]) return;
      if (a.returned_date) return; // returned — not currently on job
      if (a.status === 'returned') return;
      // "On Jobs Now" = physically on site, not just planned.
      // Only count assignments that have actually arrived on site.
      if (a.status !== 'on_site' && !a.arrived_on_site_date) return;
      if (!activeByRig[a.asset_id]) activeByRig[a.asset_id] = [];
      activeByRig[a.asset_id].push(a);
    });

    return rigs
      .map(r => {
        const active = activeByRig[r.id] || [];
        const jobIds = [...new Set(active.map(a => a.job_id))];
        const jobNames = jobIds.map(id => jobById[id]?.name).filter(Boolean);
        const rateCardMatch = findRigRateCardItem(r, rateCardItems);
        const dayRate = rateCardMatch ? (Number(rateCardMatch.price) || 0) : 0;
        let revenue = 0, days = 0;
        active.forEach(a => {
          const job = jobById[a.job_id];
          const from = a.arrived_on_site_date || a.assigned_date || job?.start_date;
          const to = a.returned_date || job?.end_date || today;
          const d = workingDays(from, to);
          days += d;
          revenue += dayRate * d;
        });
        const gear = (r.linked_equipment_ids || []).map(id => gearById[id]).filter(Boolean);
        return { id: r.id, name: r.name, rigType: r.rig_type, billingRate: dayRate, revenue, days, jobIds, jobNames, gear };
      })
      .filter(r => r.jobIds.length > 0)
      .sort((a, b) => b.revenue - a.revenue);
  }, [assets, scopedAssignments, jobById, rateCardItems]);

  // ---- People currently on jobs (today's rota assignments) ----
  const peopleRows = useMemo(() => {
    const today = todayStr();
    // active rota assignments for today (not cancelled/removed)
    const todayRotas = scopedRotas.filter(r => r.assigned_date === today);
    const byStaff = {};
    todayRotas.forEach(r => {
      if (!r.staff_id) return;
      if (!byStaff[r.staff_id]) byStaff[r.staff_id] = [];
      byStaff[r.staff_id].push(r);
    });

    // earnings per staff from chargeable timesheets, investigation logs, deliveries
    const earnByStaff = {};
    const addEarn = (sid, amt) => { if (amt) earnByStaff[sid] = (earnByStaff[sid] || 0) + amt; };
    scopedTimesheets.forEach(t => addEarn(t.staff_id, t.charge_amount));
    scopedInvLogs.forEach(l => addEarn(l.staff_id, l.charge_amount));
    scopedDeliveries.forEach(d => addEarn(d.driver_staff_id, d.charge_amount));

    return staff
      .map(s => {
        const active = byStaff[s.id] || [];
        const jobIds = [...new Set(active.map(r => r.job_id))];
        const jobNames = jobIds.map(id => jobById[id]?.name).filter(Boolean);
        const earnings = earnByStaff[s.id] || 0;
        return { id: s.id, name: s.name, role: s.worker_type, teamId: s.team_id, earnings, jobIds, jobNames, activeCount: active.length };
      })
      .filter(p => p.jobIds.length > 0)
      .sort((a, b) => b.earnings - a.earnings);
  }, [staff, scopedRotas, scopedTimesheets, scopedInvLogs, scopedDeliveries, jobById]);

  const rigRevenue = useMemo(() => rigRows.reduce((s, r) => s + r.revenue, 0), [rigRows]);
  const peopleEarnings = useMemo(() => peopleRows.reduce((s, p) => s + p.earnings, 0), [peopleRows]);

  const loading = isLoading;

  if (loading && tab === 'rigs') {
    return (
      <div className="hub-glass rounded-2xl p-5">
        <Skeleton className="h-6 w-56 mb-4" />
        <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
      </div>
    );
  }

  const TABS = [
    { id: 'rigs', label: 'Rigs', icon: HardHat, count: rigRows.length },
    { id: 'people', label: 'People', icon: Users, count: peopleRows.length },
  ];

  return (
    <div className="hub-glass rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-sm flex-shrink-0">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">On Jobs Now</h2>
            <p className="text-xs text-slate-500">Rigs & crews currently deployed and their earnings</p>
          </div>
        </div>
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition flex items-center gap-1.5 ${tab === t.id ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}>
                <Icon className="w-3.5 h-3.5" /> {t.label}
                <span className={`ml-0.5 text-[10px] px-1.5 py-0.5 rounded-full ${tab === t.id ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>{t.count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-5">
        <div className="grid grid-cols-2 gap-3 mb-5">
          <StatCard icon={PoundSterling} value={fmtGBP(tab === 'rigs' ? rigRevenue : peopleEarnings)} label={tab === 'rigs' ? 'Rig Earnings' : 'Crew Earnings'} gradient="stat-gradient-emerald" />
          <StatCard icon={tab === 'rigs' ? HardHat : Users} value={tab === 'rigs' ? rigRows.length : peopleRows.length} label={tab === 'rigs' ? 'Rigs Deployed' : 'Crew on Site'} gradient="stat-gradient-blue" />
        </div>

        {tab === 'rigs' && (
          <div className="rounded-xl border border-slate-100 overflow-hidden">
            {rigRows.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm">No rigs currently on jobs. Assign a rig to a job to see earnings here.</div>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50/50 text-slate-500">
                      <tr>
                        <th className="text-left px-4 py-2.5 font-medium">Rig</th>
                        <th className="text-left px-4 py-2.5 font-medium">On Job</th>
                        <th className="text-right px-4 py-2.5 font-medium">Day Rate</th>
                        <th className="text-right px-4 py-2.5 font-medium">Days</th>
                        <th className="text-right px-4 py-2.5 font-medium">Earnings</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rigRows.map(r => {
                        const hasGear = r.gear.length > 0;
                        const isExpanded = expandedRigs.has(r.id);
                        return (
                          <React.Fragment key={r.id}>
                            <tr className="hover:bg-emerald-50/20 transition cursor-pointer" onClick={() => handleRigClick(r)}>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  {hasGear ? (
                                    <button onClick={(e) => { e.stopPropagation(); toggleRig(r.id); }} className="w-5 h-5 flex items-center justify-center text-slate-400 flex-shrink-0 hover:bg-slate-200 rounded">
                                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                    </button>
                                  ) : <span className="w-5 h-5 flex-shrink-0" />}
                                  <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-emerald-700 bg-emerald-50"><HardHat className="w-3.5 h-3.5" /></span>
                                  <div className="min-w-0">
                                    <p className="font-medium text-slate-800 truncate max-w-[180px]">{r.name}{hasGear && <span className="ml-1.5 text-[10px] text-slate-400 font-normal">+{r.gear.length}</span>}</p>
                                    {r.rigType && r.rigType !== 'n/a' && <p className="text-[10px] text-slate-400">{r.rigType.toUpperCase()}</p>}
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                {r.jobNames.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {r.jobIds.map((jid, i) => {
                                      const j = jobById[jid];
                                      return (
                                        <button key={jid} onClick={(e) => { e.stopPropagation(); j && onSelectJob && onSelectJob(j); }} className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-full px-2 py-0.5 max-w-[200px] transition">
                                          <Briefcase className="w-3 h-3 flex-shrink-0" />
                                          <span className="truncate">{r.jobNames[i]}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                ) : <span className="text-slate-300 text-[11px]">—</span>}
                              </td>
                              <td className="px-4 py-3 text-right text-slate-500">{r.billingRate ? fmtGBP(r.billingRate) : '—'}</td>
                              <td className="px-4 py-3 text-right text-slate-600">{r.days}</td>
                              <td className="px-4 py-3 text-right font-bold text-emerald-700">{fmtGBP(r.revenue)}</td>
                            </tr>
                            {hasGear && isExpanded && r.gear.map(g => {
                              const meta = GEAR_META[g.asset_type] || GEAR_META.machinery;
                              const GIcon = meta.icon;
                              return (
                                <tr key={g.id} className="bg-slate-50/40">
                                  <td className="px-4 py-2.5 pl-12">
                                    <div className="flex items-center gap-2">
                                      <span className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.color} opacity-70`}><GIcon className="w-3 h-3" /></span>
                                      <p className="text-xs font-medium text-slate-600 truncate max-w-[180px]">{g.name}</p>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2.5" colSpan={4} />
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="md:hidden divide-y divide-slate-100">
                  {rigRows.map(r => {
                    const hasGear = r.gear.length > 0;
                    const isExpanded = expandedRigs.has(r.id);
                    return (
                      <div key={r.id}>
                        <div className="p-4 space-y-2 cursor-pointer hover:bg-emerald-50/30 transition" onClick={() => handleRigClick(r)}>
                          <div className="flex items-center gap-2">
                            {hasGear && (
                              <span className="text-slate-400 flex-shrink-0" onClick={(e) => { e.stopPropagation(); toggleRig(r.id); }}>
                                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </span>
                            )}
                            <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-emerald-700 bg-emerald-50"><HardHat className="w-4 h-4" /></span>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-slate-800 text-sm truncate">{r.name}{hasGear && <span className="ml-1 text-[10px] text-slate-400 font-normal">+{r.gear.length}</span>}</p>
                              {r.jobNames.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-0.5">
                                  {r.jobIds.map((jid, i) => {
                                    const j = jobById[jid];
                                    return (
                                      <span key={jid} onClick={(e) => { e.stopPropagation(); j && onSelectJob && onSelectJob(j); }} className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-full px-1.5 py-0.5 transition">
                                        <Briefcase className="w-2.5 h-2.5 flex-shrink-0" />
                                        <span className="truncate max-w-[120px]">{r.jobNames[i]}</span>
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                            <span className="text-sm font-bold text-emerald-700 flex-shrink-0">{fmtGBP(r.revenue)}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                            <span className="text-slate-500">{r.days} days · {r.billingRate ? fmtGBP(r.billingRate) + '/day' : 'No rate'}</span>
                          </div>
                        </div>
                        {hasGear && isExpanded && r.gear.map(g => {
                          const meta = GEAR_META[g.asset_type] || GEAR_META.machinery;
                          const GIcon = meta.icon;
                          return (
                            <div key={g.id} className="pl-10 pr-4 py-2.5 bg-slate-50/40 border-t border-slate-100/70 flex items-center gap-2">
                              <span className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.color} opacity-70`}><GIcon className="w-3 h-3" /></span>
                              <p className="text-xs font-medium text-slate-600 truncate">{g.name}</p>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'people' && (
          <div className="rounded-xl border border-slate-100 overflow-hidden">
            {peopleRows.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm">No crew currently on jobs today. Publish a rota to see people here.</div>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50/50 text-slate-500">
                      <tr>
                        <th className="text-left px-4 py-2.5 font-medium">Person</th>
                        <th className="text-left px-4 py-2.5 font-medium">On Job</th>
                        <th className="text-right px-4 py-2.5 font-medium">Earnings</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {peopleRows.map(p => (
                        <tr key={p.id} className="hover:bg-emerald-50/20 transition">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-blue-700 bg-blue-50"><Users className="w-3.5 h-3.5" /></span>
                              <div className="min-w-0">
                                <p className="font-medium text-slate-800 truncate max-w-[180px]">{p.name}</p>
                                {p.role && <p className="text-[10px] text-slate-400 capitalize">{p.role.replace(/_/g, ' ')}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {p.jobNames.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {p.jobIds.map((jid, i) => {
                                  const j = jobById[jid];
                                  return (
                                    <button key={jid} onClick={() => j && onSelectJob && onSelectJob(j)} className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-full px-2 py-0.5 max-w-[200px] transition">
                                      <Briefcase className="w-3 h-3 flex-shrink-0" />
                                      <span className="truncate">{p.jobNames[i]}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            ) : <span className="text-slate-300 text-[11px]">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-emerald-700">{p.earnings > 0 ? fmtGBP(p.earnings) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="md:hidden divide-y divide-slate-100">
                  {peopleRows.map(p => (
                    <div key={p.id} className="p-4 flex items-center gap-2">
                      <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-blue-700 bg-blue-50"><Users className="w-4 h-4" /></span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-800 text-sm truncate">{p.name}</p>
                        {p.jobNames.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {p.jobIds.map((jid, i) => {
                              const j = jobById[jid];
                              return (
                                <button key={jid} onClick={() => j && onSelectJob && onSelectJob(j)} className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-full px-1.5 py-0.5 transition">
                                  <Briefcase className="w-2.5 h-2.5 flex-shrink-0" />
                                  <span className="truncate max-w-[120px]">{p.jobNames[i]}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <span className="text-sm font-bold text-emerald-700 flex-shrink-0">{p.earnings > 0 ? fmtGBP(p.earnings) : '—'}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}