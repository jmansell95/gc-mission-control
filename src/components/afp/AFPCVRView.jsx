import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { TrendingUp, TrendingDown, PoundSterling, FileBarChart, Calculator, Target, Calendar, RefreshCw, Loader2, Download } from 'lucide-react';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const STATUS_META = {
  draft: { label: 'Draft', color: 'text-slate-600', bg: 'bg-slate-100', dot: 'bg-slate-400' },
  pending_review: { label: 'Pending Review', color: 'text-amber-700', bg: 'bg-amber-100', dot: 'bg-amber-500' },
  submitted: { label: 'Submitted', color: 'text-blue-700', bg: 'bg-blue-100', dot: 'bg-blue-500' },
  approved: { label: 'Approved', color: 'text-emerald-700', bg: 'bg-emerald-100', dot: 'bg-emerald-500' },
  invoiced: { label: 'Invoiced', color: 'text-violet-700', bg: 'bg-violet-100', dot: 'bg-violet-500' },
};

const DISPUTE_META = {
  none: { label: 'None', color: 'text-slate-500', bg: 'bg-slate-100' },
  active: { label: 'Active', color: 'text-amber-700', bg: 'bg-amber-100' },
  resolved: { label: 'Resolved', color: 'text-emerald-700', bg: 'bg-emerald-100' },
};

const fmtPct = (n) => {
  const v = Number(n || 0);
  if (isNaN(v) || !isFinite(v)) return '—';
  return (v >= 0 ? '+' : '') + v.toFixed(1) + '%';
};

/**
 * AFPCVRView — read-only, auto-generated CVR view. The CVR is derived from
 * agreed AFP totals + actual costs. No manual uploads — this view surfaces
 * the auto-generated CVR that pushAFPToCVR creates/updates.
 */
export default function AFPCVRView({ job, onSelectAfp }) {
  const [exporting, setExporting] = useState(false);

  const handleDownloadExcel = async () => {
    if (!cvr) return;
    setExporting(true);
    try {
      const res = await base44.functions.invoke('exportCVRToExcel', { cvr_id: cvr.id });
      const data = res.data || res;
      if (data.error) throw new Error(data.error);
      const a = document.createElement('a');
      a.href = data.file_url;
      a.download = data.file_name || `CVR_${job?.name || 'job'}.xlsx`;
      a.click();
    } catch (e) {
      console.error('CVR Excel export failed:', e);
    }
    setExporting(false);
  };

  const { data: cvrs = [], isLoading } = useQuery({
    queryKey: ['cvr', job.id],
    queryFn: () => base44.entities.CVR.filter({ job_id: job.id }),
  });
  const cvr = cvrs[0];

  const { data: afps = [] } = useQuery({
    queryKey: ['afp', job.id],
    queryFn: () => base44.entities.AFP.filter({ job_id: job.id }, 'afp_number', 50),
  });

  // All line items for the job — grouped by afp_id to compute per-AFP sums
  const { data: allLineItems = [] } = useQuery({
    queryKey: ['afp-line-items-job', job.id],
    queryFn: () => base44.entities.AFPLineItem.filter({ job_id: job.id }, null, 2000),
  });

  const perAfpSums = useMemo(() => {
    const sums = {};
    for (const li of allLineItems) {
      if (!sums[li.afp_id]) sums[li.afp_id] = { claimed: 0, assessed: 0, agreed: 0 };
      sums[li.afp_id].claimed += Number(li.applied_in_period) || 0;
      sums[li.afp_id].assessed += Number(li.assessed_in_period) || 0;
      sums[li.afp_id].agreed += Number(li.agreed_amount) || 0;
    }
    return sums;
  }, [allLineItems]);

  if (isLoading) {
    return <div className="insight-card rounded-2xl p-8 flex items-center justify-center"><Loader2 className="w-6 h-6 text-slate-400 animate-spin" /></div>;
  }

  if (!cvr) {
    return (
      <div className="insight-card rounded-2xl p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
          <TrendingUp className="w-8 h-8 text-slate-300" />
        </div>
        <p className="text-base font-bold text-slate-700">No CVR yet</p>
        <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
          The CVR is auto-generated when an AFP is approved and pushed. Approve an AFP
          from the AFP Builder, then click 'Push to CVR' to generate this report.
        </p>
      </div>
    );
  }

  const profitLoss = cvr.profit_loss || 0;
  const isProfit = profitLoss >= 0;
  const profitPct = cvr.profit_pct || 0;
  const isAtRisk = profitPct < 10 && profitPct >= 0;

  return (
    <div className="space-y-3">
      {/* Auto-generated banner + download */}
      <div className="flex items-center justify-between gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <p className="text-xs text-blue-700 font-semibold">
            Auto-generated from AFP agreed values — no manual upload required
          </p>
        </div>
        <button
          onClick={handleDownloadExcel}
          disabled={exporting}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition active:scale-95 disabled:opacity-50"
          title="Download CVR as Excel"
        >
          {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">Download Excel</span>
          <span className="sm:hidden">Excel</span>
        </button>
      </div>

      {/* P&L Hero Banner */}
      <div className={`relative rounded-2xl overflow-hidden insight-card ${isProfit ? 'border-emerald-200' : 'border-rose-200'}`}>
        <div className={`absolute inset-0 ${isProfit ? 'bg-gradient-to-br from-emerald-50 via-white to-emerald-50/50' : 'bg-gradient-to-br from-rose-50 via-white to-rose-50/50'}`} />
        <div className="relative p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isProfit ? 'stat-gradient-emerald' : 'stat-gradient-rose'}`}>
              {isProfit ? <TrendingUp className="w-7 h-7 text-white" /> : <TrendingDown className="w-7 h-7 text-white" />}
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Profit / Loss</p>
              <p className={`text-3xl font-bold tabular-nums ${isProfit ? 'text-emerald-700' : 'text-rose-700'}`}>
                {isProfit ? '+' : ''}{fmt(profitLoss)}
              </p>
              <p className={`text-sm font-semibold ${isProfit ? 'text-emerald-600' : 'text-rose-600'}`}>
                {fmtPct(profitPct)} margin
              </p>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Status</p>
            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold mt-1 ${
              isProfit ? (isAtRisk ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700') : 'bg-rose-100 text-rose-700'
            }`}>
              {isProfit ? (isAtRisk ? 'At Risk' : 'On Track') : 'Loss'}
            </div>
          </div>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <StatTile icon={PoundSterling} label="Contract Value" value={fmt(cvr.contract_value)} gradient="stat-gradient-brand" />
        <StatTile icon={FileBarChart} label="Variations" value={fmt(cvr.variations_total)} subValue={`${fmt((cvr.contract_value || 0) + (cvr.variations_total || 0))} forecast`} gradient="stat-gradient-blue" />
        <StatTile icon={Calculator} label="Total Cost" value={fmt(cvr.total_cost)} subValue={`${fmt(cvr.costs_to_date)} to date`} gradient="stat-gradient-amber" />
        <StatTile icon={Target} label="Budget" value={fmt(cvr.budget)} subValue={cvr.budget > 0 ? `${(((cvr.total_cost || 0) / cvr.budget) * 100).toFixed(0)}% used` : '—'} gradient="stat-gradient-violet" />
      </div>

      {/* Per-AFP chain breakdown */}
      {afps.length > 0 && (
        <div className="insight-card rounded-2xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2">
            <FileBarChart className="w-4 h-4 text-slate-500" />
            <p className="text-xs font-bold text-slate-700">AFP Chain — Per-Period Breakdown</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50/80">
                <tr className="text-slate-500 uppercase tracking-wide text-[10px]">
                  <th className="text-left px-3 py-2 font-semibold">AFP</th>
                  <th className="text-left px-3 py-2 font-semibold">Period</th>
                  <th className="text-left px-3 py-2 font-semibold">Status</th>
                  <th className="text-right px-3 py-2 font-semibold">Claimed</th>
                  <th className="text-right px-3 py-2 font-semibold">Assessed</th>
                  <th className="text-right px-3 py-2 font-semibold">Agreed</th>
                  <th className="text-center px-3 py-2 font-semibold">Disputes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {afps.map(afp => {
                  const sums = perAfpSums[afp.id] || { claimed: 0, assessed: 0, agreed: 0 };
                  const statusMeta = STATUS_META[afp.status] || STATUS_META.draft;
                  const disputeMeta = DISPUTE_META[afp.dispute_status] || DISPUTE_META.none;
                  return (
                    <tr
                      key={afp.id}
                      onClick={() => onSelectAfp?.(afp.id)}
                      className="hover:bg-slate-50/60 cursor-pointer transition group"
                    >
                      <td className="px-3 py-2.5 font-bold text-slate-700">
                        <span className="inline-flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`} />
                          AFP {afp.afp_number}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-500">
                        {afp.period_start_date || afp.period_end_date
                          ? `${fmtDate(afp.period_start_date)} → ${fmtDate(afp.period_end_date)}`
                          : '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${statusMeta.bg} ${statusMeta.color}`}>
                          {statusMeta.label}
                        </span>
                      </td>
                      <td className="text-right px-3 py-2.5 text-slate-600 tabular-nums">{fmt(sums.claimed || afp.total_claimed || 0)}</td>
                      <td className="text-right px-3 py-2.5 text-slate-600 tabular-nums">{fmt(sums.assessed)}</td>
                      <td className="text-right px-3 py-2.5 font-bold text-emerald-700 tabular-nums">{fmt(sums.agreed || afp.agreed_total || 0)}</td>
                      <td className="text-center px-3 py-2.5">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${disputeMeta.bg} ${disputeMeta.color}`}>
                          {disputeMeta.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50/80 border-t-2 border-slate-200">
                <tr className="font-bold text-slate-800">
                  <td colSpan={3} className="px-3 py-2.5">Totals</td>
                  <td className="text-right px-3 py-2.5 tabular-nums">{fmt(afps.reduce((s, a) => s + ((perAfpSums[a.id]?.claimed) || a.total_claimed || 0), 0))}</td>
                  <td className="text-right px-3 py-2.5 tabular-nums">{fmt(afps.reduce((s, a) => s + (perAfpSums[a.id]?.assessed || 0), 0))}</td>
                  <td className="text-right px-3 py-2.5 tabular-nums text-emerald-700">{fmt(afps.reduce((s, a) => s + ((perAfpSums[a.id]?.agreed) || a.agreed_total || 0), 0))}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* AFP chain summary */}
      {afps.length > 0 && (
        <div className="insight-card rounded-2xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-100">
            <p className="text-xs font-bold text-slate-700">AFP Chain — Revenue Recognition</p>
          </div>
          <div className="divide-y divide-slate-50">
            {afps.map(afp => (
              <div key={afp.id} className="px-4 py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-700">AFP {afp.afp_number}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    afp.status === 'invoiced' ? 'bg-violet-100 text-violet-700' :
                    afp.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                    afp.status === 'submitted' ? 'bg-blue-100 text-blue-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>{afp.status}</span>
                </div>
                <div className="flex items-center gap-4 text-slate-600 tabular-nums">
                  <span>Claimed: {fmt(afp.total_claimed || afp.original_total || 0)}</span>
                  <span className="font-semibold text-emerald-700">Agreed: {fmt(afp.agreed_total || 0)}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="px-4 py-2.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between text-xs font-bold">
            <span className="text-slate-700">Value to Date</span>
            <span className="text-emerald-700 tabular-nums">{fmt(cvr.value_to_date)}</span>
          </div>
        </div>
      )}

      {/* Timeline info bar */}
      <div className="insight-card rounded-2xl p-3 flex items-center gap-4 flex-wrap text-xs">
        <div className="flex items-center gap-1.5 text-slate-600">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-medium">{cvr.project_start || '—'}</span>
          <span className="text-slate-300">→</span>
          <span className="font-medium">{cvr.project_end || '—'}</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-600">
          <span className="text-slate-400">Weeks in progress:</span>
          <span className="font-bold text-slate-800 tabular-nums">{cvr.weeks_in_progress || 0}</span>
        </div>
        {cvr.last_updated_at && (
          <div className="flex items-center gap-1.5 text-slate-500 ml-auto">
            <span className="text-slate-400">Updated:</span>
            <span className="font-medium">{new Date(cvr.last_updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, subValue, gradient }) {
  return (
    <div className="insight-card rounded-2xl p-3.5 relative overflow-hidden">
      <div className="flex items-start justify-between mb-1.5">
        <div className={`w-9 h-9 rounded-lg ${gradient} flex items-center justify-center flex-shrink-0`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
      </div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-xl font-bold text-slate-900 tabular-nums leading-tight mt-0.5">{value}</p>
      {subValue && <p className="text-[10px] text-slate-400 mt-0.5">{subValue}</p>}
    </div>
  );
}