import React from 'react';
import { CheckCircle2, XCircle, X, CheckSquare, Square } from 'lucide-react';

/**
 * SiteLogBulkBar — sticky bottom bar for bulk approve/reject.
 * Shows selected count, select-all toggle, approve/reject buttons, and exit.
 */
export default function SiteLogBulkBar({ selectedCount, totalCount, onApprove, onReject, onSelectAll, onClear, onExit, processing }) {
  if (processing) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-white rounded-2xl shadow-2xl border border-slate-200 px-5 py-3 flex items-center gap-3">
        <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-semibold text-slate-700">Processing…</span>
      </div>
    );
  }
  const allSelected = selectedCount === totalCount && totalCount > 0;
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-white rounded-2xl shadow-2xl border border-slate-200 px-4 py-3 flex items-center gap-2.5 max-w-[calc(100vw-2rem)] flex-wrap justify-center">
      <span className="text-sm font-bold text-slate-800">{selectedCount} selected</span>
      <div className="w-px h-6 bg-slate-200" />
      <button onClick={allSelected ? onClear : onSelectAll}
        className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 transition">
        {allSelected ? <><Square className="w-3.5 h-3.5" /> Clear</> : <><CheckSquare className="w-3.5 h-3.5" /> Select all ({totalCount})</>}
      </button>
      <button onClick={onApprove} disabled={selectedCount === 0}
        className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition disabled:opacity-40">
        <CheckCircle2 className="w-4 h-4" /> Approve
      </button>
      <button onClick={onReject} disabled={selectedCount === 0}
        className="flex items-center gap-1.5 px-3 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition disabled:opacity-40">
        <XCircle className="w-4 h-4" /> Reject
      </button>
      <button onClick={onExit}
        className="flex items-center justify-center w-8 h-8 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}