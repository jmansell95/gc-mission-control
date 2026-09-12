import React from 'react';
import { Layers, Ruler, Clock, AlertTriangle, CheckCircle2, ChevronRight, Loader2, CircleDashed } from 'lucide-react';
import { BOREHOLE_STATUS_CONFIG, DRILLING_METHOD_CONFIG } from '@/components/investigation/boreholeStatusConfig';

/**
 * Job level — grid of borehole cards within the selected job. Each card
 * shows the borehole ref, status badge, drilling method, max depth, log
 * counts, and data-gap warnings. Click a card to drill into the borehole
 * detail view with organized strata / samples / SPT / installations sections.
 */
export default function InvestigationJobView({ boreholes, onSelectBorehole }) {
  if (boreholes.length === 0) {
    return (
      <div className="hub-glass rounded-2xl p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mx-auto mb-4">
          <Layers className="w-8 h-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-2">No boreholes in this job</h3>
        <p className="text-sm text-slate-500">Logs without a borehole reference won't appear here. Check the overview for unassigned logs.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {boreholes.map(bh => {
        const statusCfg = bh.status ? BOREHOLE_STATUS_CONFIG[bh.status] : null;
        const methodCfg = bh.drillingMethod ? DRILLING_METHOD_CONFIG[bh.drillingMethod] : null;
        const SIcon = statusCfg?.icon || CircleDashed;
        return (
          <button
            key={bh.ref}
            onClick={() => onSelectBorehole(bh.ref)}
            className="hub-glass rounded-2xl p-4 text-left hover:shadow-lg transition group"
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-mono font-bold text-slate-900 text-sm">{bh.ref}</p>
                  {statusCfg && (
                    <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold border flex-shrink-0 ${statusCfg.badge}`}>
                      <SIcon className="w-2.5 h-2.5" /> {statusCfg.short}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2.5 mt-0.5 flex-wrap">
                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                    <Ruler className="w-3 h-3" /> {bh.maxDepth > 0 ? `${bh.maxDepth.toFixed(1)}m` : '—'}
                  </span>
                  {methodCfg && (
                    <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${methodCfg.badge}`}>
                      {methodCfg.short}
                    </span>
                  )}
                  <span className="text-[11px] text-slate-500">{bh.logs.length} logs</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition flex-shrink-0" />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {bh.pending > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-semibold">
                  <Clock className="w-3 h-3" /> {bh.pending}
                </span>
              )}
              {bh.queried > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] bg-red-100 text-red-700 px-2 py-1 rounded-full font-semibold">
                  <AlertTriangle className="w-3 h-3" /> {bh.queried}
                </span>
              )}
              {bh.approved > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-semibold">
                  <CheckCircle2 className="w-3 h-3" /> {bh.approved}
                </span>
              )}
              {bh.missingDataCount > 0 && bh.status !== 'complete' && (
                <span className="inline-flex items-center gap-1 text-[11px] text-rose-600 font-semibold">
                  <AlertTriangle className="w-3 h-3" /> {bh.missingDataCount} gap{bh.missingDataCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}