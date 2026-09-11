import React from 'react';
import { X } from 'lucide-react';
import DayDetailContent from './DayDetailContent';

/**
 * Side detail drawer for desktop — slides in from the right, leaving the
 * heatmap visible and interactive behind it. Clicking another cell updates
 * the drawer content without closing/reopening.
 */
export default function DayDetailDrawer({ resource, dateStr, status, onClose, onAssign }) {
  if (!resource || !dateStr) return null;

  return (
    <>
      {/* Subtle backdrop — click to close, but doesn't blur so heatmap stays visible */}
      <div
        className="fixed inset-0 z-40 bg-slate-950/20"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-96 max-w-[90vw] insight-card rounded-l-2xl rounded-r-none border-l border-slate-200 shadow-2xl animate-drawer-slide-in flex flex-col">
        {/* Header bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Day Details</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition flex-shrink-0"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-5 no-scrollbar">
          <DayDetailContent
            resource={resource}
            dateStr={dateStr}
            status={status}
            onClose={onClose}
            onAssign={onAssign}
          />
        </div>
      </div>
    </>
  );
}