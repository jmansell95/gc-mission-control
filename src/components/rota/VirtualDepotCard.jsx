import React from 'react';
import { Warehouse, Clock, StickyNote, Square } from 'lucide-react';

// Read-only virtual card rendered on the rota grid for staff with an active
// RecurringDepotDuty rule. Not a persisted RotaAssignment — it's a live preview
// of the continuous depot duty that materialises into real shifts on publish.
export default function VirtualDepotCard({ rule, dayStr, onStop }) {
  return (
    <div className="relative px-2.5 py-2 rounded-lg text-xs border-l-[3px] border-amber-400 bg-amber-50 border border-dashed border-amber-300">
      <div className="flex items-start justify-between gap-1 mb-1">
        <span className="font-bold text-amber-900 truncate flex-1 leading-tight flex items-center gap-1">
          <Warehouse className="w-3 h-3 flex-shrink-0" /> Depot Duty
        </span>
        <span className="text-[9px] px-1 py-0.5 rounded-full bg-amber-200/60 text-amber-800 font-bold whitespace-nowrap flex items-center gap-0.5">
          <span className="w-1 h-1 rounded-full bg-amber-500 animate-pulse" /> Recurring
        </span>
      </div>
      {(rule.start_time || rule.end_time) && (
        <div className="flex items-center gap-1 text-amber-700 mb-1">
          <Clock className="w-2.5 h-2.5 flex-shrink-0" />
          <span className="truncate">{rule.start_time || '—'} - {rule.end_time || '—'}</span>
        </div>
      )}
      {rule.notes && (
        <div className="flex items-start gap-1 text-amber-700 mb-1">
          <StickyNote className="w-2.5 h-2.5 flex-shrink-0 mt-0.5" />
          <span className="truncate italic">{rule.notes}</span>
        </div>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); onStop(rule); }}
        className="mt-1 w-full flex items-center justify-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200 px-1.5 py-1 rounded-md transition"
      >
        <Square className="w-2.5 h-2.5" /> Stop depot duty
      </button>
    </div>
  );
}