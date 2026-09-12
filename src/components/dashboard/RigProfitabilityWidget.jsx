import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  TrendingUp, TrendingDown, PoundSterling, HardHat, Users, Loader2,
  ShieldCheck, ShieldAlert, Wrench, ChevronDown, ChevronRight, CircleDot, ArrowRight, Briefcase,
} from 'lucide-react';
import { Skeleton } from '@/components/StateViews';
import { useJobFilter } from '@/components/dashboard/JobFilterContext';
import StatCard from '@/components/dashboard/StatCard';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, CartesianGrid,
} from 'recharts';
import { eachDayOfInterval, isWeekend } from 'date-fns';
import { findRigRateCardItem } from '@/components/logistics/rigRateMatcher';

const fmtGBP = (n) => '£' + (Math.round((n || 0) * 100) / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function workingDays(start, end) {
  if (!start || !end) return 0;
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  if (e < s) return 0;
  return eachDayOfInterval({ start: s, end: e }).filter((d) => !isWeekend(d)).length;
}

const CREW_COLORS = [
  'bg-emerald-100 text-emerald-700',
  'bg-blue-100 text-blue-700',
  'bg-amber-100 text-amber-700',
  'bg-violet-100 text-violet-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
];

const PIE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#f43f5e', '#06b6d4', '#64748b'];

export default function RigProfitabilityWidget({ onSelectJob }) {
  const [expanded, setExpanded] = useState(null);
  const { selectedJobId } = useJobFilter();
  const isAllJobs = selectedJobId === 'all';

  const { data: assets = [], isLoading } = useQuery({ queryKey: ['site-assets-rig-prob'], queryFn: () => base44.entities.SiteAsset.list() });
  const { data: assignments = [] } = useQuery({ queryKey: ['job-asset-assignments-rig-prob'], queryFn: () => base44.entities.JobAssetAssignment.list() });
  const { data: costItems = [] } = useQuery({ queryKey: ['all-cost-items-rig-prob'], queryFn: () => base44.entities.JobCostItem.list() });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs-rig-prob'], queryFn: () => base44.entities.Job.list() });
  const { data: staff = [] } = useQuery({ queryKey: ['staff-rig-prob'], queryFn: () => base44.entities.Staff.list() });
  const { data: teams = [] } = useQuery({ queryKey: ['teams-rig-prob'], queryFn: () => base44.entities.Team.list() });
  const { data: rotas = [] } = useQuery({ queryKey: ['rotas-rig-prob'], queryFn: () => base44.entities.RotaAssignment.list('-created_date', 500) });
  const { data: drillingCrews = [] } = useQuery({ queryKey: ['drilling-crews-rig-prob'], queryFn: () => base44.entities.DrillingCrew.list() });
  const { data: rateCardItems = [] } = useQuery({ queryKey: ['rate-card-items-rig-prob'], queryFn: () => base44.entities.RateCardItem.list(), staleTime: 60000 });

  // Scope all data to the selected job
  const scopedAssignments = isAllJobs ? assignments : assignments.filter(a => a.job_id === selectedJobId);
  const scopedCostItems = isAllJobs ? costItems : costItems.filter(c => c.job_id === selectedJobId);
  const scopedRotas = isAllJobs ? rotas : rotas.filter(r => r.job_id === selectedJobId);

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const jobById = useMemo(() => Object.fromEntries(jobs.map((j) => [j.id, j])), [jobs]);
  const staffById = useMemo(() => Object.fromEntries(staff.map((s) => [s.id, s])), [staff]);
  const teamById = useMemo(() => Object.fromEntries(teams.map((t) => [t.id, t])), [teams]);
  const crewById = useMemo(() => Object.fromEntries(drillingCrews.map((c) => [c.id, c])), [drillingCrews]);

  const rigs = useMemo(() => assets.filter((a) => a.is_rig || a.asset_type === 'rig'), [assets]);

  const rigRows = useMemo(() => {
    // Cost per rig from JobCostItem — day rate × working days on site (matches
    // the calculateJobFinancials engine). Using unit_cost × quantity would only
    // count one day; rigs accrue cost per working day from delivery to return.
    const costByAsset = {};
    scopedCostItems.forEach((c) => {
      if (!c.site_asset_id) return;
      if (c.category === 'contractor_supplied' || c.category === 'client_supplied') return;
      const asset = assets.find((a) => a.id === c.site_asset_id);
      if (!asset || !(asset.is_rig || asset.asset_type === 'rig')) return;
      const dayRate = c.price_confirmed && c.negotiated_unit_cost != null
        ? Number(c.negotiated_unit_cost)
        : (Number(c.unit_cost) || 0);
      const isDelivered = c.current_location === 'site' || c.current_location === 'returned' || c.hire_status === 'off_hired';
      const locDate = c.location_updated_at ? c.location_updated_at.split('T')[0] : null;
      const startDate = c.start_date || (isDelivered ? locDate : null);
      const endDate = c.off_hire_date || c.end_date || null;
      const days = isDelivered && startDate ? workingDays(startDate, endDate || todayStr) : 0;
      costByAsset[c.site_asset_id] = (costByAsset[c.site_asset_id] || 0) + Math.round(dayRate * days * 100) / 100;
    });

    // Revenue & days per rig from assignments (daily_billing_rate × working days)
    const revByAsset = {};
    const daysByAsset = {};
    const jobsByAsset = {};
    scopedAssignments.forEach((a) => {
      if (!a.asset_id) return;
      const job = jobById[a.job_id];
      const from = a.arrived_on_site_date || a.assigned_date || job?.start_date;
      const to = a.returned_date || job?.end_date || todayStr;
      const days = workingDays(from, to);
      daysByAsset[a.asset_id] = (daysByAsset[a.asset_id] || 0) + days;
      jobsByAsset[a.asset_id] = jobsByAsset[a.asset_id] || new Set();
      jobsByAsset[a.asset_id].add(a.job_id);
      const rigAsset = assets.find((x) => x.id === a.asset_id);
      const rcMatch = rigAsset ? findRigRateCardItem(rigAsset, rateCardItems) : null;
      const rate = rcMatch ? (Number(rcMatch.price) || 0) : 0;
      revByAsset[a.asset_id] = (revByAsset[a.asset_id] || 0) + rate * days;
    });

    // Current crew: today's rota for jobs this rig is actively assigned to (status assigned/on_site)
    const activeJobByAsset = {};
    scopedAssignments.forEach((a) => {
      if (!a.asset_id) return;
      if (a.status === 'returned') return;
      activeJobByAsset[a.asset_id] = a.job_id;
    });

    return rigs.map((rig) => {
      const revenue = revByAsset[rig.id] || 0;
      const cost = costByAsset[rig.id] || 0;
      const days = daysByAsset[rig.id] || 0;
      const jobIds = [...(jobsByAsset[rig.id] || [])];
      const profit = revenue - cost;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

      // Resolve current crew
      const activeJobId = activeJobByAsset[rig.id];
      const crewMembers = [];
      if (activeJobId) {
        scopedRotas
          .filter((r) => r.job_id === activeJobId && r.assigned_date === todayStr)
          .forEach((r) => {
            const member = staffById[r.staff_id];
            if (member) crewMembers.push(member);
          });
      }
      const job = activeJobId ? jobById[activeJobId] : null;

      const rcMatch = findRigRateCardItem(rig, rateCardItems);
      const billingRate = rcMatch ? (Number(rcMatch.price) || 0) : 0;

      return {
        id: rig.id,
        name: rig.name,
        rigType: rig.rig_type,
        compliance: rig.compliance_status || 'unknown',
        billingRate,
        revenue,
        cost,
        profit,
        margin,
        days,
        jobCount: jobIds.length,
        jobIds,
        activeJob: job,
        crewMembers,
        active: rig.is_active !== false,
      };
    })
      .filter((r) => r.days > 0 || r.cost > 0 || r.revenue > 0 || r.crewMembers.length > 0)
      .sort((a, b) => b.revenue - a.revenue);
  }, [rigs, scopedAssignments, scopedCostItems, jobById, staffById, scopedRotas, todayStr, assets, rateCardItems]);

  const totals = useMemo(
    () => rigRows.reduce(
      (acc, r) => ({
        revenue: acc.revenue + r.revenue,
        cost: acc.cost + r.cost,
        profit: acc.profit + r.profit,
        days: acc.days + r.days,
        active: acc.active + (r.crewMembers.length > 0 ? 1 : 0),
      }),
      { revenue: 0, cost: 0, profit: 0, days: 0, active: 0 }
    ),
    [rigRows]
  );

  // Chart data
  const barData = useMemo(
    () =>
      rigRows.slice(0, 10).map((r) => ({
        name: r.name.length > 14 ? r.name.slice(0, 12) + '…' : r.name,
        Revenue: Math.round(r.revenue),
        Cost: Math.round(r.cost),
      })),
    [rigRows]
  );

  const pieData = useMemo(() => {
    const byType = {};
    rigRows.forEach((r) => {
      const key = r.rigType === 'rotary' ? 'Rotary' : r.rigType === 'cp' ? 'CP' : 'Other';
      byType[key] = (byType[key] || 0) + r.profit;
    });
    return Object.entries(byType).map(([name, value]) => ({ name, value: Math.round(value) }));
  }, [rigRows]);

  const toggleExpand = (id) => setExpanded((prev) => (prev === id ? null : id));
  const handleRowClick = (r) => {
    if (r.activeJob && onSelectJob) { onSelectJob(r.activeJob); return; }
    toggleExpand(r.id);
  };

  if (isLoading) {
    return (
      <div className="hub-glass rounded-2xl p-5">
        <Skeleton className="h-6 w-56 mb-4" />
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
      </div>
    );
  }

  const complianceMeta = {
    compliant: { label: 'Compliant', icon: ShieldCheck, cls: 'text-emerald-700 bg-emerald-50' },
    expiring: { label: 'Expiring', icon: ShieldAlert, cls: 'text-amber-700 bg-amber-50' },
    expired: { label: 'Expired', icon: ShieldAlert, cls: 'text-rose-700 bg-rose-50' },
    unknown: { label: 'Unknown', icon: CircleDot, cls: 'text-slate-500 bg-slate-100' },
  };

  return (
    <div className="hub-glass rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm flex-shrink-0">
          <HardHat className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-900">Rig Profitability</h2>
          <p className="text-xs text-slate-500">Revenue, cost & current crew — per drilling rig</p>
        </div>
        <span className="ml-auto text-xs bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-medium">{rigRows.length} Rigs</span>
      </div>

      <div className="p-5 space-y-5">
        {/* KPI strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={PoundSterling} value={fmtGBP(totals.revenue)} label="Total Revenue" gradient="stat-gradient-emerald" />
          <StatCard icon={Wrench} value={fmtGBP(totals.cost)} label="Total Cost" gradient="stat-gradient-amber" />
          <StatCard icon={totals.profit >= 0 ? TrendingUp : TrendingDown} value={fmtGBP(totals.profit)} label="Net Profit" gradient={totals.profit >= 0 ? 'stat-gradient-blue' : 'stat-gradient-rose'} />
          <StatCard icon={Users} value={totals.active} label="Crew On Rigs Today" gradient="stat-gradient-violet" />
        </div>

        {/* Charts */}
        {rigRows.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 rounded-xl border border-slate-100 p-4">
              <p className="text-xs font-semibold text-slate-500 mb-3">Revenue vs Cost by Rig</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} angle={-15} textAnchor="end" height={50} interval={0} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => '£' + (v >= 1000 ? (v / 1000) + 'k' : v)} />
                  <Tooltip formatter={(v) => fmtGBP(v)} contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Cost" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="rounded-xl border border-slate-100 p-4">
              <p className="text-xs font-semibold text-slate-500 mb-3">Profit Share by Rig Type</p>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={35} label={(e) => e.name} labelLine={false}>
                      {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => fmtGBP(v)} contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-xs text-slate-400">No profit data yet</div>
              )}
            </div>
          </div>
        )}

        {/* Per-rig table */}
        <div className="rounded-xl border border-slate-100 overflow-hidden">
          {rigRows.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">No rigs deployed yet. Assign rigs to Jobs to see profitability and live crew.</div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50/50 text-slate-500">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-medium">Rig</th>
                      <th className="text-right px-4 py-2.5 font-medium">Days</th>
                      <th className="text-right px-4 py-2.5 font-medium">Jobs</th>
                      <th className="text-left px-4 py-2.5 font-medium">Current Crew</th>
                      <th className="text-right px-4 py-2.5 font-medium">Revenue</th>
                      <th className="text-right px-4 py-2.5 font-medium">Cost</th>
                      <th className="text-right px-4 py-2.5 font-medium">Profit</th>
                      <th className="text-right px-4 py-2.5 font-medium">Margin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rigRows.map((r) => {
                      const comp = complianceMeta[r.compliance] || complianceMeta.unknown;
                      const CompIcon = comp.icon;
                      const isOpen = expanded === r.id;
                      return (
                        <React.Fragment key={r.id}>
                          <tr className="hover:bg-emerald-50/20 transition cursor-pointer" onClick={() => handleRowClick(r)}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {r.jobCount > 0 && (
                                  <button onClick={(e) => { e.stopPropagation(); toggleExpand(r.id); }} className="w-4 h-4 flex items-center justify-center flex-shrink-0 hover:bg-slate-200 rounded">
                                    {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                                  </button>
                                )}
                                <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-emerald-50"><HardHat className="w-3.5 h-3.5 text-emerald-700" /></span>
                                <div className="min-w-0">
                                  <p className="font-medium text-slate-800 truncate max-w-[160px]">{r.name}</p>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-slate-400">{r.rigType && r.rigType !== 'n/a' ? r.rigType.toUpperCase() : 'Rig'}</span>
                                    <span className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${comp.cls}`}><CompIcon className="w-2.5 h-2.5" />{comp.label}</span>
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right text-slate-600">{r.days}</td>
                            <td className="px-4 py-3 text-right text-slate-600">{r.jobCount}</td>
                            <td className="px-4 py-3">
                              {r.crewMembers.length > 0 ? (
                                <div className="flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                  <span className="text-[11px] font-medium text-emerald-700">{r.crewMembers.length} On Site</span>
                                  <div className="flex -space-x-1.5 ml-1">
                                    {r.crewMembers.slice(0, 3).map((m, i) => (
                                      <span key={m.id} className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ring-2 ring-white ${CREW_COLORS[i % CREW_COLORS.length]}`} title={m.name}>
                                        {m.name.charAt(0)}
                                      </span>
                                    ))}
                                    {r.crewMembers.length > 3 && (
                                      <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-600 ring-2 ring-white">+{r.crewMembers.length - 3}</span>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-[11px] text-slate-400">Idle</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-emerald-700">{fmtGBP(r.revenue)}</td>
                            <td className="px-4 py-3 text-right text-slate-600">{fmtGBP(r.cost)}</td>
                            <td className={`px-4 py-3 text-right font-bold ${r.profit >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>{fmtGBP(r.profit)}</td>
                            <td className="px-4 py-3 text-right">
                              {r.revenue > 0 ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  <div className="w-10 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${r.margin >= 40 ? 'bg-emerald-500' : r.margin >= 20 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${Math.min(100, Math.abs(r.margin))}%` }} />
                                  </div>
                                  <span className={`font-bold ${r.margin >= 40 ? 'text-emerald-600' : r.margin >= 20 ? 'text-amber-600' : 'text-rose-600'}`}>{r.margin.toFixed(0)}%</span>
                                </div>
                              ) : <span className="text-slate-400">—</span>}
                            </td>
                          </tr>
                          {isOpen && (
                            <tr className="bg-slate-50/40">
                              <td colSpan={8} className="px-4 py-3">
                                <div className="grid grid-cols-2 gap-4 text-xs">
                                  <div>
                                    <p className="font-semibold text-slate-600 mb-1.5">Jobs Worked ({r.jobIds.length})</p>
                                    {r.jobIds.length === 0 ? <p className="text-slate-400">No Jobs</p> : (
                                      <div className="space-y-1">
                                        {r.jobIds.map((jid) => {
                                          const j = jobById[jid];
                                          return (
                                            <button key={jid} onClick={() => j && onSelectJob && onSelectJob(j)} className="text-left text-slate-600 hover:text-emerald-700 hover:font-medium transition flex items-center gap-1">
                                              <ChevronRight className="w-3 h-3 text-slate-300" /> {j?.name || 'Unknown'} {j?.status ? <span className="text-slate-400">({j.status})</span> : null}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                  <div>
                                    <p className="font-semibold text-slate-600 mb-1.5">Current Crew Detail</p>
                                    {r.crewMembers.length === 0 ? <p className="text-slate-400">No crew on this rig today</p> : (
                                      <div className="space-y-1">
                                        {r.crewMembers.map((m, i) => {
                                          const team = m.team_id ? teamById[m.team_id] : null;
                                          const crew = m.drilling_crew_id ? crewById[m.drilling_crew_id] : null;
                                          return (
                                            <div key={m.id} className="flex items-center gap-2">
                                              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${CREW_COLORS[i % CREW_COLORS.length]}`}>{m.name.charAt(0)}</span>
                                              <span className="text-slate-700 font-medium">{m.name}</span>
                                              {crew && <span className="text-[10px] text-slate-400">{crew.name}</span>}
                                              {team && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">{team.name}</span>}
                                            </div>
                                          );
                                        })}
                                        {r.activeJob && (
                                          <button onClick={() => onSelectJob && onSelectJob(r.activeJob)} className="text-[10px] text-emerald-600 mt-1 hover:underline flex items-center gap-0.5">
                                            Working on: {r.activeJob.name} <ArrowRight className="w-2.5 h-2.5" />
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="lg:hidden divide-y divide-slate-100">
                {rigRows.map((r) => {
                  const comp = complianceMeta[r.compliance] || complianceMeta.unknown;
                  const CompIcon = comp.icon;
                  return (
                    <div key={r.id} className={`p-4 space-y-2 ${r.activeJob ? 'cursor-pointer hover:bg-emerald-50/30 transition' : ''}`} onClick={() => handleRowClick(r)}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-emerald-50"><HardHat className="w-4 h-4 text-emerald-700" /></span>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-800 text-sm truncate">{r.name}</p>
                            <p className="text-[10px] text-slate-400">{r.rigType && r.rigType !== 'n/a' ? r.rigType.toUpperCase() : 'Rig'} · <span className={comp.cls}>{comp.label}</span> · {r.days} Days · {r.jobCount} Jobs</p>
                          </div>
                        </div>
                        <span className={`text-sm font-bold flex-shrink-0 ${r.profit >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>{fmtGBP(r.profit)}</span>
                      </div>
                      {r.activeJob && (
                        <div className="flex items-center gap-1 text-[10px] text-emerald-700 font-medium">
                          <Briefcase className="w-2.5 h-2.5" /> {r.activeJob.name} <ArrowRight className="w-2.5 h-2.5" />
                        </div>
                      )}
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                        <span className="text-slate-500">Rev <span className="font-semibold text-emerald-700">{fmtGBP(r.revenue)}</span></span>
                        <span className="text-slate-500">Cost <span className="font-semibold text-slate-700">{fmtGBP(r.cost)}</span></span>
                        <span className={`font-bold ${r.margin >= 40 ? 'text-emerald-600' : r.margin >= 20 ? 'text-amber-600' : 'text-rose-600'}`}>{r.revenue > 0 ? r.margin.toFixed(0) + '%' : '—'}</span>
                      </div>
                      {r.crewMembers.length > 0 ? (
                        <div className="flex items-center gap-1.5 pt-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-[11px] font-medium text-emerald-700">{r.crewMembers.length} On Site:</span>
                          <div className="flex flex-wrap gap-1">
                            {r.crewMembers.map((m, i) => (
                              <span key={m.id} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${CREW_COLORS[i % CREW_COLORS.length]}`}>{m.name.split(' ')[0]}</span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-400 pt-1">Idle Today</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}