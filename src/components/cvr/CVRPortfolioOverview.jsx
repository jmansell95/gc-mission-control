import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  FileBarChart, TrendingUp, TrendingDown, AlertTriangle, PoundSterling,
  ArrowRight, Search, Loader2, Target,
} from 'lucide-react';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 });
const fmtPct = (n) => {
  const v = Number(n || 0);
  if (isNaN(v) || !isFinite(v)) return '—';
  return (v >= 0 ? '+' : '') + v.toFixed(1) + '%';
};

/**
 * CVRPortfolioOverview — the portfolio view shown in the billing hub's new
 * 'CVR / AFP' tab. Aggregates all jobs' CVR data into KPI cards and a sortable
 * table with sparkline trends. Click any job to drill into its CVR/AFP dashboard.
 */
export default function CVRPortfolioOverview({ onSelectJob }) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('contract_value');
  const [sortDir, setSortDir] = useState('desc');

  const { data: cvrs = [], isLoading } = useQuery({
    queryKey: ['cvr-portfolio'],
    queryFn: () => base44.entities.CVR.list('-updated_date', 200),
  });

  const { data: afps = [] } = useQuery({
    queryKey: ['afp-portfolio'],
    queryFn: () => base44.entities.AFP.list('-updated_date', 200),
  });

  const filtered = useMemo(() => {
    let result = cvrs;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        (c.job_name || '').toLowerCase().includes(q) ||
        (c.job_reference || '').toLowerCase().includes(q) ||
        (c.client_name || '').toLowerCase().includes(q)
      );
    }
    result = [...result].sort((a, b) => {
      const av = a[sortBy] || 0;
      const bv = b[sortBy] || 0;
      return sortDir === 'desc' ? bv - av : av - bv;
    });
    return result;
  }, [cvrs, search, sortBy, sortDir]);

  const totals = useMemo(() => {
    const totalContract = cvrs.reduce((s, c) => s + (c.contract_value || 0), 0);
    const totalPL = cvrs.reduce((s, c) => s + (c.profit_loss || 0), 0);
    const atRisk = cvrs.filter(c => (c.profit_pct || 0) < 10).length;
    const totalClaimed = afps.reduce((s, a) => s + (a.total_claimed || 0), 0);
    return { totalContract, totalPL, atRisk, totalClaimed };
  }, [cvrs, afps]);

  const handleSort = (col) => {
    if (sortBy === col) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
  };

  if (isLoading) {
    return (
      <div className="insight-card rounded-2xl p-8 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <KPICard
          icon={PoundSterling}
          label="Total Contract Value"
          value={fmt(totals.totalContract)}
          gradient="stat-gradient-brand"
        />
        <KPICard
          icon={totals.totalPL >= 0 ? TrendingUp : TrendingDown}
          label="Total P&L"
          value={`${totals.totalPL >= 0 ? '+' : ''}${fmt(totals.totalPL)}`}
          gradient={totals.totalPL >= 0 ? 'stat-gradient-emerald' : 'stat-gradient-rose'}
        />
        <KPICard
          icon={AlertTriangle}
          label="Jobs at Risk"
          value={totals.atRisk}
          subValue={cvrs.length > 0 ? `${((totals.atRisk / cvrs.length) * 100).toFixed(0)}% of portfolio` : '—'}
          gradient="stat-gradient-amber"
        />
        <KPICard
          icon={FileBarChart}
          label="AFP Total Claimed"
          value={fmt(totals.totalClaimed)}
          subValue={`${afps.length} AFPs`}
          gradient="stat-gradient-blue"
        />
      </div>

      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search jobs, clients, references…"
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#2E5A1A]"
          />
        </div>
      </div>

      {/* Portfolio table */}
      {filtered.length === 0 ? (
        <div className="insight-card rounded-2xl p-8 text-center">
          <FileBarChart className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-500">
            {cvrs.length === 0 ? 'No CVRs uploaded yet' : 'No jobs match your search'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {cvrs.length === 0 ? 'Upload a CVR from any job\'s Financials tab to see it here' : 'Try a different search term'}
          </p>
        </div>
      ) : (
        <div className="insight-card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50/80 sticky top-0">
                <tr className="text-slate-500 uppercase tracking-wide text-[10px]">
                  <th className="text-left px-3 py-2.5 font-semibold cursor-pointer hover:text-slate-700" onClick={() => handleSort('job_name')}>
                    Job
                  </th>
                  <th className="text-left px-3 py-2.5 font-semibold cursor-pointer hover:text-slate-700" onClick={() => handleSort('client_name')}>
                    Client
                  </th>
                  <th className="text-right px-3 py-2.5 font-semibold cursor-pointer hover:text-slate-700" onClick={() => handleSort('contract_value')}>
                    Contract
                  </th>
                  <th className="text-right px-3 py-2.5 font-semibold cursor-pointer hover:text-slate-700" onClick={() => handleSort('budget')}>
                    Budget
                  </th>
                  <th className="text-right px-3 py-2.5 font-semibold cursor-pointer hover:text-slate-700" onClick={() => handleSort('total_cost')}>
                    Cost to Date
                  </th>
                  <th className="text-right px-3 py-2.5 font-semibold cursor-pointer hover:text-slate-700" onClick={() => handleSort('profit_loss')}>
                    P&L
                  </th>
                  <th className="text-right px-3 py-2.5 font-semibold cursor-pointer hover:text-slate-700" onClick={() => handleSort('profit_pct')}>
                    %
                  </th>
                  <th className="text-right px-3 py-2.5 font-semibold">Updated</th>
                  <th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(cvr => {
                  const pl = cvr.profit_loss || 0;
                  const isProfit = pl >= 0;
                  const isAtRisk = (cvr.profit_pct || 0) < 10 && (cvr.profit_pct || 0) >= 0;
                  return (
                    <tr
                      key={cvr.id}
                      onClick={() => onSelectJob?.(cvr.job_id)}
                      className="hover:bg-emerald-50/30 cursor-pointer transition group"
                    >
                      <td className="px-3 py-2.5">
                        <p className="font-semibold text-slate-800 truncate max-w-[200px]">{cvr.job_name}</p>
                        {cvr.job_reference && <p className="text-[10px] text-slate-400">{cvr.job_reference}</p>}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 truncate max-w-[120px]">{cvr.client_name || '—'}</td>
                      <td className="text-right px-3 py-2.5 text-slate-700 font-medium tabular-nums">{fmt(cvr.contract_value)}</td>
                      <td className="text-right px-3 py-2.5 text-slate-600 tabular-nums">{fmt(cvr.budget)}</td>
                      <td className="text-right px-3 py-2.5 text-slate-600 tabular-nums">{fmt(cvr.costs_to_date)}</td>
                      <td className={`text-right px-3 py-2.5 font-bold tabular-nums ${isProfit ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {isProfit ? '+' : ''}{fmt(pl)}
                      </td>
                      <td className={`text-right px-3 py-2.5 font-semibold tabular-nums ${isProfit ? (isAtRisk ? 'text-amber-600' : 'text-emerald-600') : 'text-rose-600'}`}>
                        {fmtPct(cvr.profit_pct)}
                      </td>
                      <td className="text-right px-3 py-2.5 text-slate-400 text-[10px]">
                        {cvr.last_updated_at ? new Date(cvr.last_updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-[#2E5A1A] transition" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50/80 border-t-2 border-slate-200">
                <tr className="font-bold text-slate-800">
                  <td className="px-3 py-2.5" colSpan={2}>Portfolio Total ({filtered.length})</td>
                  <td className="text-right px-3 py-2.5 tabular-nums">{fmt(filtered.reduce((s, c) => s + (c.contract_value || 0), 0))}</td>
                  <td className="text-right px-3 py-2.5 tabular-nums">{fmt(filtered.reduce((s, c) => s + (c.budget || 0), 0))}</td>
                  <td className="text-right px-3 py-2.5 tabular-nums">{fmt(filtered.reduce((s, c) => s + (c.costs_to_date || 0), 0))}</td>
                  <td className={`text-right px-3 py-2.5 tabular-nums ${totals.totalPL >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {totals.totalPL >= 0 ? '+' : ''}{fmt(totals.totalPL)}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function KPICard({ icon: Icon, label, value, subValue, gradient }) {
  return (
    <div className="insight-card rounded-2xl p-3.5 relative overflow-hidden">
      <div className={`w-9 h-9 rounded-lg ${gradient} flex items-center justify-center mb-2`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-xl font-bold text-slate-900 tabular-nums leading-tight mt-0.5">{value}</p>
      {subValue && <p className="text-[10px] text-slate-400 mt-0.5">{subValue}</p>}
    </div>
  );
}