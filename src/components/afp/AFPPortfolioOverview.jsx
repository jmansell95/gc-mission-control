import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  FileBarChart, PoundSterling, AlertTriangle, CheckCircle2, Receipt,
  Search, Loader2, ArrowRight, Upload, FileSpreadsheet, Clock,
} from 'lucide-react';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—';

// Days past the final payment notice date (0 if not yet overdue or not invoiced)
function daysOverdue(afp) {
  if (!afp.final_payment_notice_date || afp.status === 'invoiced') return 0;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(afp.final_payment_notice_date + 'T00:00:00');
  return Math.max(0, Math.round((today - due) / (1000 * 60 * 60 * 24)));
}

const STATUS_META = {
  draft: { label: 'Draft', color: 'text-slate-600', bg: 'bg-slate-100', dot: 'bg-slate-400' },
  submitted: { label: 'Submitted', color: 'text-blue-700', bg: 'bg-blue-100', dot: 'bg-blue-500' },
  approved: { label: 'Agreed', color: 'text-emerald-700', bg: 'bg-emerald-100', dot: 'bg-emerald-500' },
  invoiced: { label: 'Invoiced', color: 'text-violet-700', bg: 'bg-violet-100', dot: 'bg-violet-500' },
};

/**
 * AFPPortfolioOverview — the single AFP portfolio view for the Billing page.
 * Shows ALL jobs' AFPs in one place with KPI cards, status filters, and a
 * sortable table. Row click drills into the job's AFP Builder.
 */
export default function AFPPortfolioOverview({ onSelectJob, onUploadTemplate }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('period_end_date');
  const [sortDir, setSortDir] = useState('desc');

  const { data: afps = [], isLoading } = useQuery({
    queryKey: ['afp-portfolio'],
    queryFn: () => base44.entities.AFP.list('-updated_date', 500),
  });

  // Derive dispute status for filtering
  const enrichedAfps = useMemo(() => {
    return afps.map(a => {
      const overdue = daysOverdue(a);
      return {
        ...a,
        // If disputed_total > 0, show as 'disputed' regardless of base status
        effective_status: (a.disputed_total > 0 && a.status === 'submitted') ? 'disputed' : a.status,
        days_overdue: overdue,
        is_overdue: overdue > 0,
      };
    });
  }, [afps]);

  const filtered = useMemo(() => {
    let result = enrichedAfps;
    if (statusFilter === 'overdue') {
      result = result.filter(a => a.is_overdue);
    } else if (statusFilter !== 'all') {
      result = result.filter(a => a.effective_status === statusFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(a =>
        (a.job_name || '').toLowerCase().includes(q) ||
        (a.job_reference || '').toLowerCase().includes(q) ||
        (a.client_name || '').toLowerCase().includes(q)
      );
    }
    return [...result].sort((a, b) => {
      let av = a[sortBy], bv = b[sortBy];
      if (typeof av === 'string') {
        return sortDir === 'desc' ? (bv || '').localeCompare(av || '') : (av || '').localeCompare(bv || '');
      }
      av = Number(av) || 0; bv = Number(bv) || 0;
      return sortDir === 'desc' ? bv - av : av - bv;
    });
  }, [enrichedAfps, search, statusFilter, sortBy, sortDir]);

  const totals = useMemo(() => {
    const claimed = enrichedAfps.reduce((s, a) => s + (a.total_claimed || a.original_total || 0), 0);
    const disputed = enrichedAfps.reduce((s, a) => s + (a.disputed_total || 0), 0);
    const agreed = enrichedAfps.reduce((s, a) => s + (a.agreed_total || 0), 0);
    const invoiced = enrichedAfps.filter(a => a.status === 'invoiced').reduce((s, a) => s + (a.agreed_total || 0), 0);
    return { claimed, disputed, agreed, invoiced };
  }, [enrichedAfps]);

  const statusCounts = useMemo(() => {
    const counts = { draft: 0, submitted: 0, disputed: 0, approved: 0, invoiced: 0, overdue: 0 };
    for (const a of enrichedAfps) {
      counts[a.effective_status] = (counts[a.effective_status] || 0) + 1;
      if (a.is_overdue) counts.overdue++;
    }
    return counts;
  }, [enrichedAfps]);

  const overdueTotal = useMemo(
    () => enrichedAfps.filter(a => a.is_overdue).reduce((s, a) => s + (a.agreed_total || a.total_claimed || 0), 0),
    [enrichedAfps]
  );

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
      <div className="hub-glass rounded-2xl p-8 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  const statusPills = [
    { id: 'all', label: 'All', count: enrichedAfps.length, color: 'bg-slate-800 text-white' },
    { id: 'overdue', label: 'Overdue Payment', count: statusCounts.overdue, color: 'bg-rose-600 text-white' },
    { id: 'draft', label: 'Draft', count: statusCounts.draft, color: 'bg-slate-200 text-slate-700' },
    { id: 'submitted', label: 'Submitted', count: statusCounts.submitted, color: 'bg-blue-100 text-blue-700' },
    { id: 'disputed', label: 'Disputed', count: statusCounts.disputed, color: 'bg-amber-100 text-amber-700' },
    { id: 'approved', label: 'Agreed', count: statusCounts.approved, color: 'bg-emerald-100 text-emerald-700' },
    { id: 'invoiced', label: 'Invoiced', count: statusCounts.invoiced, color: 'bg-violet-100 text-violet-700' },
  ];

  return (
    <div className="space-y-3">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
        <KPICard icon={PoundSterling} label="Total Claimed" value={fmt(totals.claimed)} gradient="stat-gradient-brand" />
        <KPICard icon={AlertTriangle} label="In Dispute" value={fmt(totals.disputed)} gradient="stat-gradient-amber" />
        <KPICard icon={CheckCircle2} label="Agreed" value={fmt(totals.agreed)} gradient="stat-gradient-emerald" />
        <KPICard icon={Receipt} label="Invoiced" value={fmt(totals.invoiced)} gradient="stat-gradient-violet" />
        <KPICard icon={Clock} label="Overdue Payment" value={fmt(overdueTotal)} gradient="stat-gradient-rose" count={statusCounts.overdue} />
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search jobs, clients, references…"
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-primary"
          />
        </div>
        <button
          onClick={onUploadTemplate}
          className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white rounded-xl text-xs font-bold transition active:scale-95 shadow-sm"
        >
          <Upload className="w-3.5 h-3.5" /> AFP Template
        </button>
      </div>

      {/* Status pill filters */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {statusPills.map(pill => (
          <button
            key={pill.id}
            onClick={() => setStatusFilter(pill.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition active:scale-95 ${
              statusFilter === pill.id ? pill.color : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
          >
            {pill.label}
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${statusFilter === pill.id ? 'bg-white/20' : 'bg-slate-100'}`}>
              {pill.count}
            </span>
          </button>
        ))}
      </div>

      {/* Portfolio — Mobile card view */}
      {filtered.length === 0 ? (
        <div className="hub-glass rounded-2xl p-6 sm:p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <FileBarChart className="w-7 h-7 text-slate-300" />
          </div>
          <p className="text-sm font-semibold text-slate-500">
            {enrichedAfps.length === 0 ? 'No AFPs yet' : 'No AFPs match your filters'}
          </p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {enrichedAfps.length === 0 ? 'AFPs auto-create when jobs go live. Create one manually from any job\'s Financials tab.' : 'Try a different filter or search'}
          </p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-2.5">
            {filtered.map(afp => {
              const meta = STATUS_META[afp.status] || STATUS_META.draft;
              const isDisputed = afp.disputed_total > 0 && afp.status === 'submitted';
              return (
                <div
                  key={afp.id}
                  onClick={() => onSelectJob?.(afp.job_id)}
                  className="hub-glass rounded-2xl p-3.5 cursor-pointer active:scale-[0.98] transition"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-800 text-sm truncate">{afp.job_name || '—'}</p>
                      {afp.job_reference && <p className="text-[10px] text-slate-400">{afp.job_reference}</p>}
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${meta.bg} ${meta.color} flex-shrink-0`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                      {isDisputed ? 'Disputed' : meta.label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-slate-400">AFP {afp.afp_number || 1} · {afp.period_end_date ? fmtDate(afp.period_end_date) : 'Open'}</span>
                    <span className="font-bold text-emerald-700 tabular-nums">{fmt(afp.agreed_total || 0)}</span>
                  </div>
                  {afp.is_overdue && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-[11px]">
                      <Clock className="w-3 h-3 text-rose-500" />
                      <span className="text-rose-600 font-bold">Payment {afp.days_overdue}d overdue · due {fmtDate(afp.final_payment_notice_date)}</span>
                    </div>
                  )}
                  {afp.disputed_total > 0 && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-[11px]">
                      <AlertTriangle className="w-3 h-3 text-amber-500" />
                      <span className="text-amber-600 font-semibold tabular-nums">{fmt(afp.disputed_total)} in dispute</span>
                    </div>
                  )}
                </div>
              );
            })}
            {/* Mobile total */}
            <div className="hub-glass rounded-2xl p-3.5 bg-slate-50/80 flex items-center justify-between text-sm font-bold">
              <span className="text-slate-700">Total ({filtered.length})</span>
              <div className="flex items-center gap-3">
                {totals.disputed > 0 && <span className="text-amber-600 tabular-nums text-xs">{fmt(totals.disputed)}</span>}
                <span className="text-emerald-700 tabular-nums">{fmt(totals.agreed)}</span>
              </div>
            </div>
          </div>

          {/* Desktop table */}
          <div className="hub-glass rounded-2xl overflow-hidden hidden sm:block">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50/80 sticky top-0">
                  <tr className="text-slate-500 uppercase tracking-wide text-[10px]">
                    <th className="text-left px-3 py-2.5 font-semibold cursor-pointer hover:text-slate-700" onClick={() => handleSort('job_name')}>
                      Job
                    </th>
                    <th className="text-left px-3 py-2.5 font-semibold cursor-pointer hover:text-slate-700" onClick={() => handleSort('afp_number')}>
                      AFP #
                    </th>
                    <th className="text-left px-3 py-2.5 font-semibold cursor-pointer hover:text-slate-700" onClick={() => handleSort('period_end_date')}>
                      Period
                    </th>
                    <th className="text-left px-3 py-2.5 font-semibold cursor-pointer hover:text-slate-700" onClick={() => handleSort('final_payment_notice_date')}>
                      Final Payment
                    </th>
                    <th className="text-center px-3 py-2.5 font-semibold">Status</th>
                    <th className="text-right px-3 py-2.5 font-semibold cursor-pointer hover:text-slate-700" onClick={() => handleSort('total_claimed')}>
                      Claimed
                    </th>
                    <th className="text-right px-3 py-2.5 font-semibold cursor-pointer hover:text-slate-700" onClick={() => handleSort('disputed_total')}>
                      Disputed
                    </th>
                    <th className="text-right px-3 py-2.5 font-semibold cursor-pointer hover:text-slate-700" onClick={() => handleSort('agreed_total')}>
                      Agreed
                    </th>
                    <th className="px-3 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map(afp => {
                    const meta = STATUS_META[afp.status] || STATUS_META.draft;
                    const isDisputed = afp.disputed_total > 0 && afp.status === 'submitted';
                    return (
                      <tr
                        key={afp.id}
                        onClick={() => onSelectJob?.(afp.job_id)}
                        className="hover:bg-emerald-50/30 cursor-pointer transition group"
                      >
                        <td className="px-3 py-2.5">
                          <p className="font-semibold text-slate-800 truncate max-w-[200px]">{afp.job_name || '—'}</p>
                          {afp.job_reference && <p className="text-[10px] text-slate-400">{afp.job_reference}</p>}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600 font-medium tabular-nums">{afp.afp_number || 1}</td>
                        <td className="px-3 py-2.5 text-slate-500">
                          {afp.period_end_date ? fmtDate(afp.period_end_date) : 'Open'}
                        </td>
                        <td className="px-3 py-2.5">
                          {afp.final_payment_notice_date ? (
                            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${afp.is_overdue ? 'text-rose-600' : 'text-slate-500'}`}>
                              {afp.is_overdue && <Clock className="w-3 h-3" />}
                              {fmtDate(afp.final_payment_notice_date)}
                              {afp.is_overdue && <span className="text-rose-500 font-bold">({afp.days_overdue}d)</span>}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="text-center px-3 py-2.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${meta.bg} ${meta.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                            {isDisputed ? 'Disputed' : meta.label}
                          </span>
                        </td>
                        <td className="text-right px-3 py-2.5 text-slate-700 font-medium tabular-nums">
                          {fmt(afp.total_claimed || afp.original_total || 0)}
                        </td>
                        <td className={`text-right px-3 py-2.5 font-medium tabular-nums ${afp.disputed_total > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                          {afp.disputed_total > 0 ? fmt(afp.disputed_total) : '—'}
                        </td>
                        <td className="text-right px-3 py-2.5 font-bold text-emerald-700 tabular-nums">
                          {fmt(afp.agreed_total || 0)}
                        </td>
                        <td className="px-3 py-2.5">
                          <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-primary transition" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-50/80 border-t-2 border-slate-200">
                  <tr className="font-bold text-slate-800">
                    <td className="px-3 py-2.5" colSpan={5}>Portfolio Total ({filtered.length})</td>
                    <td className="text-right px-3 py-2.5 tabular-nums">{fmt(totals.claimed)}</td>
                    <td className="text-right px-3 py-2.5 tabular-nums text-amber-600">{fmt(totals.disputed)}</td>
                    <td className="text-right px-3 py-2.5 tabular-nums text-emerald-700">{fmt(totals.agreed)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function KPICard({ icon: Icon, label, value, gradient, count }) {
  return (
    <div className="hub-glass rounded-2xl p-3.5 relative overflow-hidden">
      <div className={`absolute -top-8 -right-8 w-24 h-24 rounded-full ${gradient} opacity-[0.08]`} />
      <div className="flex items-center justify-between relative">
        <div className={`w-9 h-9 rounded-lg ${gradient} flex items-center justify-center shadow-sm`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        {count > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold">{count}</span>
        )}
      </div>
      <p className="relative text-[10px] font-semibold uppercase tracking-wide text-slate-400 mt-2">{label}</p>
      <p className="relative text-lg sm:text-xl font-bold text-slate-900 tabular-nums leading-tight mt-0.5">{value}</p>
    </div>
  );
}