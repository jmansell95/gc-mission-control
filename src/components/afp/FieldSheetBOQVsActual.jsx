import React, { useMemo } from 'react';
import { Layers, TrendingUp, TrendingDown, MinusCircle, FileText } from 'lucide-react';
import AnimatedNumber from '@/components/hubs/AnimatedNumber';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 });
const fmtQty = (n) => Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 2 });

/**
 * FieldSheetBOQVsActual — shows each Measured Works (BOQ) line item with its
 * contracted qty/rate/amount alongside the actual completed qty (from field
 * sheet daily logs / live field data), variance, and % complete.
 *
 * Rows are colour-coded: emerald = on track/complete, amber = over-contracted,
 * slate = not started. Visual stat pills at the top summarise the totals.
 */
export default function FieldSheetBOQVsActual({ afp, lineItems }) {
  const mwItems = useMemo(
    () => lineItems.filter(li => li.sheet_name === 'measured_works'),
    [lineItems]
  );

  const rows = useMemo(() => {
    return mwItems.map(li => {
      const contractedQty = Number(li.qty) || 0;
      const actualQty = Number(li.qty_complete) || 0;
      const variance = contractedQty - actualQty;
      const pctComplete = contractedQty > 0 ? Math.min(100, Math.round((actualQty / contractedQty) * 100)) : 0;
      const contractedAmount = Number(li.amount) || 0;
      const actualAmount = Number(li.gross_applied) || (actualQty * (Number(li.rate) || 0));
      const varianceAmount = contractedAmount - actualAmount;
      let status = 'not-started';
      if (pctComplete >= 100) status = 'complete';
      else if (pctComplete > 0) status = 'on-track';
      if (variance < 0 && contractedQty > 0) status = 'over';
      return { li, contractedQty, actualQty, variance, pctComplete, contractedAmount, actualAmount, varianceAmount, status };
    });
  }, [mwItems]);

  const totals = useMemo(() => {
    let contracted = 0, actual = 0, variance = 0;
    for (const r of rows) {
      contracted += r.contractedAmount;
      actual += r.actualAmount;
      variance += r.varianceAmount;
    }
    const pct = contracted > 0 ? Math.min(100, Math.round((actual / contracted) * 100)) : 0;
    return { contracted, actual, variance, pct };
  }, [rows]);

  if (mwItems.length === 0) {
    return (
      <div className="hub-glass rounded-2xl p-6 text-center">
        <Layers className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-400">No Measured Works lines to compare</p>
      </div>
    );
  }

  const statusMeta = {
    'complete': { color: 'text-emerald-600', bg: 'bg-emerald-50', dot: 'bg-emerald-500', label: 'Complete', icon: TrendingUp },
    'on-track': { color: 'text-emerald-600', bg: 'bg-emerald-50/50', dot: 'bg-emerald-400', label: 'On Track', icon: TrendingUp },
    'over': { color: 'text-amber-600', bg: 'bg-amber-50', dot: 'bg-amber-500', label: 'Over', icon: TrendingDown },
    'not-started': { color: 'text-slate-400', bg: 'bg-slate-50', dot: 'bg-slate-300', label: 'Not Started', icon: MinusCircle },
  };

  return (
    <div className="space-y-3">
      {/* Stat pills */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="relative overflow-hidden rounded-xl stat-gradient-brand text-white px-3 py-3 shadow-sm">
          <p className="text-[10px] text-white/70 uppercase font-bold tracking-wide">Contracted</p>
          <p className="text-lg sm:text-xl font-extrabold tabular-nums mt-0.5">
            <AnimatedNumber value={totals.contracted} format={(v) => fmt(v)} />
          </p>
        </div>
        <div className="relative overflow-hidden rounded-xl stat-gradient-blue text-white px-3 py-3 shadow-sm">
          <p className="text-[10px] text-white/70 uppercase font-bold tracking-wide">Actual to Date</p>
          <p className="text-lg sm:text-xl font-extrabold tabular-nums mt-0.5">
            <AnimatedNumber value={totals.actual} format={(v) => fmt(v)} />
          </p>
        </div>
        <div className={`relative overflow-hidden rounded-xl ${totals.variance < 0 ? 'stat-gradient-amber' : 'stat-gradient-emerald'} text-white px-3 py-3 shadow-sm`}>
          <p className="text-[10px] text-white/70 uppercase font-bold tracking-wide">Variance</p>
          <p className="text-lg sm:text-xl font-extrabold tabular-nums mt-0.5">
            <AnimatedNumber value={Math.abs(totals.variance)} format={(v) => (totals.variance < 0 ? '-' : '') + fmt(v)} />
          </p>
        </div>
        <div className="relative overflow-hidden rounded-xl stat-gradient-violet text-white px-3 py-3 shadow-sm">
          <p className="text-[10px] text-white/70 uppercase font-bold tracking-wide">% Complete</p>
          <p className="text-lg sm:text-xl font-extrabold tabular-nums mt-0.5">
            <AnimatedNumber value={totals.pct} format={(v) => Math.round(v) + '%'} />
          </p>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hub-glass rounded-2xl overflow-hidden hidden lg:block">
        <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-200 flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">BOQ vs Actual</h3>
          <span className="text-[10px] text-slate-400">({mwItems.length} lines)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 uppercase tracking-wide text-[9px]">
                <th className="text-left px-2 py-2 font-semibold">Ref</th>
                <th className="text-left px-2 py-2 font-semibold">Description</th>
                <th className="text-left px-2 py-2 font-semibold">Unit</th>
                <th className="text-right px-2 py-2 font-semibold bg-slate-50/50">Contracted Qty</th>
                <th className="text-right px-2 py-2 font-semibold bg-slate-50/50">Contracted £</th>
                <th className="text-right px-2 py-2 font-semibold bg-blue-50/50">Actual Qty</th>
                <th className="text-right px-2 py-2 font-semibold bg-blue-50/50">Actual £</th>
                <th className="text-right px-2 py-2 font-semibold bg-amber-50/50">Variance</th>
                <th className="text-center px-2 py-2 font-semibold">% Complete</th>
                <th className="text-center px-2 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map(({ li, contractedQty, actualQty, variance, pctComplete, contractedAmount, actualAmount, varianceAmount, status }) => {
                const meta = statusMeta[status];
                const Icon = meta.icon;
                return (
                  <tr key={li.id} className={`hover:bg-slate-50/40 ${meta.bg}`}>
                    <td className="px-2 py-2 text-slate-400 font-mono text-[10px]">{li.item_ref || '—'}</td>
                    <td className="px-2 py-2 text-slate-700 font-medium whitespace-normal break-words" title={li.item}>{li.item}</td>
                    <td className="px-2 py-2 text-slate-500">{li.unit || '—'}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-slate-600 bg-slate-50/30">{fmtQty(contractedQty)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-slate-600 bg-slate-50/30">{fmt(contractedAmount)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-blue-700 bg-blue-50/30">{fmtQty(actualQty)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-blue-700 bg-blue-50/30">{fmt(actualAmount)}</td>
                    <td className={`px-2 py-2 text-right tabular-nums font-bold bg-amber-50/30 ${variance < 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {variance > 0 ? '+' : ''}{fmtQty(variance)}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <div className="flex items-center gap-1.5 justify-center">
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${status === 'over' ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${pctComplete}%` }} />
                        </div>
                        <span className="text-[10px] font-bold tabular-nums text-slate-600">{pctComplete}%</span>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${meta.bg} ${meta.color}`}>
                        <Icon className="w-2.5 h-2.5" /> {meta.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-50/80 border-t-2 border-slate-200">
              <tr className="font-bold text-slate-800">
                <td colSpan={4} className="px-2 py-2.5 text-right">Totals →</td>
                <td className="px-2 py-2.5 text-right tabular-nums bg-slate-100/40">{fmt(totals.contracted)}</td>
                <td className="px-2 py-2.5 text-right tabular-nums text-blue-700 bg-blue-50/40">Actual →</td>
                <td className="px-2 py-2.5 text-right tabular-nums text-blue-700 bg-blue-50/40">{fmt(totals.actual)}</td>
                <td className={`px-2 py-2.5 text-right tabular-nums ${totals.variance < 0 ? 'text-amber-600' : 'text-emerald-600'} bg-amber-50/40`}>
                  {totals.variance > 0 ? '+' : ''}{fmt(totals.variance)}
                </td>
                <td className="px-2 py-2.5 text-center tabular-nums text-violet-700 bg-violet-50/40">{totals.pct}%</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Mobile card view */}
      <div className="lg:hidden space-y-2">
        {rows.map(({ li, contractedQty, actualQty, variance, pctComplete, contractedAmount, actualAmount, varianceAmount, status }) => {
          const meta = statusMeta[status];
          const Icon = meta.icon;
          return (
            <div key={li.id} className="hub-glass rounded-2xl p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  {li.item_ref && <span className="text-[10px] font-mono text-slate-400">{li.item_ref}</span>}
                  <p className="text-xs font-semibold text-slate-700 truncate">{li.item}</p>
                </div>
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${meta.bg} ${meta.color} flex-shrink-0`}>
                  <Icon className="w-2.5 h-2.5" /> {meta.label}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                <div className="rounded-lg bg-slate-50 p-1.5">
                  <p className="text-slate-400 uppercase font-semibold">Contracted</p>
                  <p className="font-bold text-slate-700 tabular-nums">{fmtQty(contractedQty)} {li.unit} · {fmt(contractedAmount)}</p>
                </div>
                <div className="rounded-lg bg-blue-50 p-1.5">
                  <p className="text-blue-400 uppercase font-semibold">Actual</p>
                  <p className="font-bold text-blue-700 tabular-nums">{fmtQty(actualQty)} · {fmt(actualAmount)}</p>
                </div>
                <div className={`rounded-lg p-1.5 ${variance < 0 ? 'bg-amber-50' : 'bg-emerald-50'}`}>
                  <p className={`uppercase font-semibold ${variance < 0 ? 'text-amber-400' : 'text-emerald-400'}`}>Variance</p>
                  <p className={`font-bold tabular-nums ${variance < 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{variance > 0 ? '+' : ''}{fmtQty(variance)} {li.unit}</p>
                </div>
                <div className="rounded-lg bg-violet-50 p-1.5">
                  <p className="text-violet-400 uppercase font-semibold">% Complete</p>
                  <div className="flex items-center gap-1">
                    <div className="flex-1 h-1.5 bg-violet-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${status === 'over' ? 'bg-amber-500' : 'bg-violet-500'}`} style={{ width: `${pctComplete}%` }} />
                    </div>
                    <span className="font-bold text-violet-700 tabular-nums">{pctComplete}%</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}