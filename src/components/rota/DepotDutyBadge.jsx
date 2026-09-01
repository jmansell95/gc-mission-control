import React, { useState } from 'react';
import { Warehouse, ChevronDown, Clock, StickyNote } from 'lucide-react';

const statusConfig = {
  assigned: { label: 'Assigned', cls: 'bg-slate-100 text-slate-600' },
  started: { label: 'In Progress', cls: 'bg-blue-50 text-blue-700' },
  completed: { label: 'Completed', cls: 'bg-[#2E5A1A]/10 text-[#2E5A1A]' },
};

/**
 * Compact "also on depot duty" badge for the rota grid. Expands to a small
 * depot info block with an optional edit link. Used when a delivery is in
 * front — the depot shift is kept but collapsed behind the delivery banner.
 */
export default function DepotDutyBadge({ assignment, onEdit }) {
  const [expanded, setExpanded] = useState(false);
  const status = statusConfig[assignment.status || 'assigned'] || statusConfig.assigned;
  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition"
      >
        <Warehouse className="w-3 h-3 flex-shrink-0" />
        <span className="truncate flex-1 text-left">Also on depot duty</span>
        <ChevronDown className={`w-3 h-3 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded && (
        <div className="mt-1 px-2 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-[10px]">
          <div className="flex items-center gap-1 text-amber-700">
            <Clock className="w-2.5 h-2.5 flex-shrink-0" />
            <span className="truncate">
              {assignment.start_time || '—'}
              {assignment.end_time ? ` - ${assignment.end_time}` : ''}
            </span>
            <span className={`ml-auto px-1 py-0.5 rounded-full font-medium ${status.cls}`}>{status.label}</span>
          </div>
          {assignment.notes && (
            <div className="flex items-start gap-1 text-amber-700 mt-1">
              <StickyNote className="w-2.5 h-2.5 flex-shrink-0 mt-0.5" />
              <span className="truncate italic">{assignment.notes}</span>
            </div>
          )}
          {onEdit && (
            <button onClick={onEdit} className="mt-1 text-[10px] font-semibold text-amber-700 hover:underline">
              Edit depot shift →
            </button>
          )}
        </div>
      )}
    </div>
  );
}