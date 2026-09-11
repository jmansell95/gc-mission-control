import React from 'react';
import { X } from 'lucide-react';
import DayDetailContent from './DayDetailContent';

/**
 * Centered modal card for mobile/tablet — slides in over the heatmap with
 * a dark backdrop, centered card, and scrollable content. Dismissed by
 * tapping the backdrop or the close button.
 */
export default function DayDetailModal({ resource, dateStr, status, onClose, onAssign }) {
  if (!resource || !dateStr) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[100] bg-slate-950/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Centered card */}
      <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
        <div className="field-card w-full max-w-sm max-h-[85vh] overflow-y-auto p-5 animate-pop-in pointer-events-auto no-scrollbar">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition flex-shrink-0 z-10"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>

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