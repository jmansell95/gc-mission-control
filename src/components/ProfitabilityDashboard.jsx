import React, { useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { Wallet, TrendingUp, TrendingDown, PoundSterling, PiggyBank, Wrench, Receipt, ArrowRight } from 'lucide-react';
import { Skeleton } from '@/components/StateViews';
import { useJobFilter } from '@/components/dashboard/JobFilterContext';
import StatCard from '@/components/dashboard/StatCard';

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid rgba(226,232,240,0.8)',
  fontSize: 12,
  background: 'rgba(255,255,255,0.95)',
  backdropFilter: 'blur(8px)',
  boxShadow: '0 8px 24px -8px rgba(15,42,31,0.18)',
  padding: '8px 12px'
};

const fmtGBP = (n) => '£' + (Math.round((n || 0) * 100) / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const PIE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b'];

export default function ProfitabilityDashboard({ onSelectJob }) {
  const { selectedJobId } = useJobFilter();
  const isAll = selectedJobId === 'all';

  const { data: jobs = [], isLoading: jobsLoading } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list() });
  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: rotas = [] } = useQuery({ queryKey: ['all-rotas-profit'], queryFn: () => base44.entities.RotaAssignment.list() });
  const { data: costItems = [] } = useQuery({ queryKey: ['all-cost-items'], queryFn: () => base44.entities.JobCostItem.list() });

  const { jobRows, totals } = useMemo(() => {
    // Labour cost tracking removed — payroll is handled outside this system.
    // Equipment cost per job
    const equipByJob = {};
    costItems.forEach(c => {
      const itemCost = (c.unit_cost || 0) * (c.quantity || 1);
      equipByJob[c.job_id] = (equipByJob[c.job_id] || 0) + itemCost;
    });

    const jobRows = jobs.map(j => {
      const equip = equipByJob[j.id] || 0;
      const netCost = j.actual_cost || equip;
      const markupPct = j.markup_percentage || 0;
      const markupAmt = netCost * (markupPct / 100);
      const subtotal = netCost + markupAmt;
      const vatRate = j.vat_rate ?? 20;
      const vatAmt = subtotal * (vatRate / 100);
      const clientPrice = subtotal + vatAmt;
      const profit = clientPrice - netCost;
      const margin = clientPrice > 0 ? (profit / clientPrice) * 100 : 0;
      const budget = j.budget_amount || 0;
      return {
        id: j.id, name: j.name, status: j.status, job_type: j.job_type,
        equip, netCost, markupPct, markupAmt, vatAmt, clientPrice, profit, margin,
        budget, budgetVariance: budget - netCost,
      };
    }).filter(r => r.netCost > 0 || r.budget > 0);

    const totals = jobRows.reduce((acc, r) => ({
      equip: acc.equip + r.equip,
      netCost: acc.netCost + r.netCost,
      clientPrice: acc.clientPrice + r.clientPrice,
      profit: acc.profit + r.profit,
      budget: acc.budget + r.budget,
    }), { equip: 0, netCost: 0, clientPrice: 0, profit: 0, budget: 0 });

    return { jobRows, totals };
  }, [jobs, staff, rotas, costItems]);

  const displayRows = isAll ? jobRows : jobRows.filter(r => r.id === selectedJobId);
  const displayTotals = isAll ? totals : displayRows.reduce((acc, r) => ({
    equip: acc.equip + r.equip, netCost: acc.netCost + r.netCost,
    clientPrice: acc.clientPrice + r.clientPrice, profit: acc.profit + r.profit, budget: acc.budget + r.budget,
  }), { equip: 0, netCost: 0, clientPrice: 0, profit: 0, budget: 0 });

  const overallMargin = displayTotals.clientPrice > 0 ? (displayTotals.profit / displayTotals.clientPrice) * 100 : 0;
  const scopeLabel = isAll ? 'All Jobs' : (jobs.find(j => j.id === selectedJobId)?.name || 'Selected');

  // Cost breakdown pie data (equipment only — payroll tracked externally)
  const pieData = [
    { name: 'Equipment', value: Math.round(displayTotals.equip) },
  ].filter(d => d.value > 0);

  // Margin bar chart — top 6 jobs
  const marginChartData = [...displayRows]
    .sort((a, b) => b.clientPrice - a.clientPrice)
    .slice(0, 6)
    .map(r => ({ name: r.name.length > 18 ? r.name.slice(0, 16) + '…' : r.name, Client: Math.round(r.clientPrice), Cost: Math.round(r.netCost) }));

  if (jobsLoading) {
    return (
      <div className="hub-glass rounded-2xl p-5">
        <Skeleton className="h-6 w-48 mb-4" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const stats = [
    { label: 'Net Cost', value: fmtGBP(displayTotals.netCost), icon: Wallet, gradient: 'stat-gradient-blue', sub: `Equipment ${fmtGBP(displayTotals.equip)}` },
    { label: 'Client Price', value: fmtGBP(displayTotals.clientPrice), icon: PoundSterling, gradient: 'stat-gradient-emerald', sub: `incl. VAT` },
    { label: 'Gross Profit', value: fmtGBP(displayTotals.profit), icon: displayTotals.profit >= 0 ? PiggyBank : TrendingDown, gradient: displayTotals.profit >= 0 ? 'stat-gradient-amber' : 'stat-gradient-rose', sub: `Markup applied` },
    { label: 'Margin', value: overallMargin.toFixed(1) + '%', icon: TrendingUp, gradient: overallMargin >= 20 ? 'stat-gradient-emerald' : overallMargin >= 10 ? 'stat-gradient-amber' : 'stat-gradient-rose', sub: overallMargin >= 20 ? 'Healthy' : overallMargin >= 10 ? 'Moderate' : 'Low' },
  ];

  return (
    <div className="hub-glass rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-sm flex-shrink-0">
            <PoundSterling className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Profitability Dashboard</h2>
            <p className="text-xs text-slate-500">Full cost breakdown, markup & margin analysis</p>
          </div>
        </div>
      </div>

      <div className="p-5">
        {/* Scope badge */}
        <div className="mb-4">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Showing: {scopeLabel} · {displayRows.length} {displayRows.length === 1 ? 'Job' : 'Jobs'}
          </span>
        </div>

        {/* Stat cards — 2 col on mobile, 4 on desktop */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {stats.map((s) => (
            <StatCard key={s.label} icon={s.icon} value={s.value} label={s.label} sub={s.sub} gradient={s.gradient} />
          ))}
        </div>

        {/* Charts — stack on mobile, side-by-side on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
          {/* Cost Breakdown Donut */}
          <div className="rounded-xl border border-slate-100 p-4 bg-slate-50/60">
            <p className="text-xs font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5 text-slate-500" /> Cost Breakdown
            </p>
            {pieData.length === 0 ? (
              <div className="h-[180px] flex items-center justify-center text-slate-400 text-sm">No cost data yet.</div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <ResponsiveContainer width="100%" height={180} className="sm:!w-1/2">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2}>
                      {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtGBP(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 w-full sm:w-1/2">
                  {pieData.map((d, i) => {
                    const pct = displayTotals.netCost > 0 ? (d.value / displayTotals.netCost) * 100 : 0;
                    return (
                      <div key={d.name} className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: PIE_COLORS[i] }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-700 truncate">{d.name}</p>
                          <p className="text-sm font-bold text-slate-900">{fmtGBP(d.value)} <span className="text-[10px] font-normal text-slate-400">({pct.toFixed(0)}%)</span></p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Client Price vs Cost bar chart */}
          <div className="rounded-xl border border-slate-100 p-4 bg-slate-50/60">
            <p className="text-xs font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-slate-500" /> Client Price vs Net Cost
            </p>
            {marginChartData.length === 0 ? (
              <div className="h-[180px] flex items-center justify-center text-slate-400 text-sm">No billing data yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(180, marginChartData.length * 40 + 30)}>
                <BarChart data={marginChartData} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => '£' + v} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#334155' }} axisLine={false} tickLine={false} width={90} interval={0} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtGBP(v)} cursor={{ fill: 'rgba(16,185,129,0.06)' }} />
                  <Bar dataKey="Client" radius={[0, 4, 4, 0]} maxBarSize={14} fill="#10b981" />
                  <Bar dataKey="Cost" radius={[0, 4, 4, 0]} maxBarSize={14} fill="#94a3b8" />
                </BarChart>
              </ResponsiveContainer>
            )}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[10px] text-slate-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500" />Client Price</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-slate-400" />Net Cost</span>
            </div>
          </div>
        </div>

        {/* Job-level table */}
        <div className="rounded-xl border border-slate-100 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-slate-500" />
            <p className="text-xs font-semibold text-slate-700">Per-Job Breakdown</p>
          </div>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50/50 text-slate-500">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">Job</th>
                  <th className="text-right px-4 py-2.5 font-medium">Equipment</th>
                  <th className="text-right px-4 py-2.5 font-medium">Net Cost</th>
                  <th className="text-right px-4 py-2.5 font-medium">Markup</th>
                  <th className="text-right px-4 py-2.5 font-medium">Client Price</th>
                  <th className="text-right px-4 py-2.5 font-medium">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayRows.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-slate-400">No Jobs with cost data yet.</td></tr>
                ) : displayRows.map(r => {
                  const job = jobs.find(j => j.id === r.id);
                  return (
                  <tr key={r.id} className={`hover:bg-emerald-50/20 transition ${onSelectJob && job ? 'cursor-pointer' : ''}`} onClick={() => onSelectJob && job && onSelectJob(job)}>
                    <td className="px-4 py-3 font-medium text-slate-800 max-w-[200px] truncate">{r.name}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{fmtGBP(r.equip)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">{fmtGBP(r.netCost)}</td>
                    <td className="px-4 py-3 text-right text-slate-500">{r.markupPct}%</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-700">{fmtGBP(r.clientPrice)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-bold ${r.margin >= 20 ? 'text-emerald-600' : r.margin >= 10 ? 'text-amber-600' : 'text-rose-600'}`}>
                        {r.margin.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-slate-100">
            {displayRows.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">No Jobs with cost data yet.</div>
            ) : displayRows.map(r => {
              const job = jobs.find(j => j.id === r.id);
              return (
              <div key={r.id} className={`p-4 space-y-2 ${onSelectJob && job ? 'cursor-pointer hover:bg-emerald-50/30' : ''}`} onClick={() => onSelectJob && job && onSelectJob(job)}>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-slate-800 text-sm flex-1 min-w-0 truncate">{r.name}</p>
                  <span className={`text-sm font-bold flex-shrink-0 ${r.margin >= 20 ? 'text-emerald-600' : r.margin >= 10 ? 'text-amber-600' : 'text-rose-600'}`}>
                    {r.margin.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-1"><Wrench className="w-3 h-3" />{fmtGBP(r.equip)}</span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide">Net Cost</p>
                    <p className="text-sm font-semibold text-slate-800">{fmtGBP(r.netCost)}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300" />
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide">Client Price</p>
                    <p className="text-sm font-bold text-emerald-700">{fmtGBP(r.clientPrice)}</p>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}