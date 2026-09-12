import React from 'react';
import { Briefcase, Layers, Clock, AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react';

/**
 * Overview level — grid of job cards. Each card aggregates the logs for
 * that job (total, pending, queried, approved, borehole count). Click a
 * card to drill into the borehole view for that job.
 */
export default function InvestigationOverview({ groups, jobMap, onSelectJob }) {
  if (groups.length === 0) {
    return (
      <div className="hub-glass rounded-2xl p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mx-auto mb-4">
          <Briefcase className="w-8 h-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-2">No logs match your filters</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto">Try adjusting the search or filter settings above.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {groups.map(g => (
        <button
          key={g.key}
          onClick={() => onSelectJob(g.key)}
          className="hub-glass rounded-2xl p-4 text-left hover:shadow-lg transition group"
        >
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
              <Briefcase className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-900 text-sm truncate">{g.label}</p>
              <p className="text-xs text-slate-500">{g.boreholeCount} borehole{g.boreholeCount !== 1 ? 's' : ''} · {g.logs.length} log{g.logs.length !== 1 ? 's' : ''}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition flex-shrink-0" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {g.pending > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-semibold">
                <Clock className="w-3 h-3" /> {g.pending} pending
              </span>
            )}
            {g.queried > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] bg-red-100 text-red-700 px-2 py-1 rounded-full font-semibold">
                <AlertTriangle className="w-3 h-3" /> {g.queried} queried
              </span>
            )}
            {g.approved > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-semibold">
                <CheckCircle2 className="w-3 h-3" /> {g.approved} approved
              </span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}