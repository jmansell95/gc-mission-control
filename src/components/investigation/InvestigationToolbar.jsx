import React from 'react';
import { Download, CheckSquare, Briefcase, UploadCloud } from 'lucide-react';
import AGSUploadButton from './AGSUploadButton';

/**
 * Unified action toolbar — replaces the separate export bar, bulk review
 * bar, and bulk-select toggle that were sandwiched between content. One
 * clean row: AGS upload on the left, Export / Bulk Review / Select on the right.
 */
export default function InvestigationToolbar({
  hasLogs, jobs, bulkMode, pendingCount,
  onToggleBulk, onOpenExport, onOpenBulkReview,
}) {
  if (!hasLogs) return null;
  return (
    <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
      <AGSUploadButton jobs={jobs} />
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={onOpenBulkReview}
          disabled={pendingCount === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-xs font-semibold hover:bg-amber-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Briefcase className="w-3.5 h-3.5" /> Bulk Review
          {pendingCount > 0 && <span className="bg-amber-600 text-white text-[10px] px-1.5 py-0.5 rounded-full tabular-nums">{pendingCount}</span>}
        </button>
        <button
          onClick={onOpenExport}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold hover:bg-indigo-200 transition"
        >
          <Download className="w-3.5 h-3.5" /> Export
        </button>
        <button
          onClick={onToggleBulk}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${bulkMode ? 'bg-[#2E5A1A] text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
        >
          <CheckSquare className="w-3.5 h-3.5" /> {bulkMode ? 'Done' : 'Select'}
        </button>
      </div>
    </div>
  );
}