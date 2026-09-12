import React from 'react';
import { Undo2, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import ConfidenceRing from './ConfidenceRing';
import SourceBadges from './SourceBadges';

/**
 * Horizontal scroll strip of green-path auto-approved timesheets that are
 * still within their 24h undo window. Each card shows the staff member,
 * confidence ring, source badges, on-site hours and an Undo button.
 */
export default function AutoApprovedStrip({ entries, staffMap, onUndo }) {
  if (!entries || entries.length === 0) return null;

  const now = new Date();
  const undoable = entries.filter((t) => t.auto_approved_until && new Date(t.auto_approved_until) > now);
  if (undoable.length === 0) return null;

  return (
    <div className="hub-glass rounded-2xl p-3 sm:p-4">
      <div className="flex items-center gap-2 mb-2.5">
        <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900">Auto-approved today</p>
          <p className="text-[10px] text-slate-400">
            {undoable.length} green-path timesheet{undoable.length !== 1 ? 's' : ''} · tap Undo within 24h to review
          </p>
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
        {undoable.map((t) => {
          const member = staffMap[t.staff_id];
          const onSiteH = Math.round(((t.on_site_minutes || 0) / 60) * 10) / 10;
          return (
            <div
              key={t.id}
              className="flex-shrink-0 w-52 bg-emerald-50/50 border border-emerald-200/60 rounded-xl p-2.5"
            >
              <div className="flex items-center gap-2">
                <ConfidenceRing score={t.confidence_score} size={36}>
                  <span className="text-[10px] font-bold text-emerald-700">
                    {(member?.name || '?').charAt(0)}
                  </span>
                </ConfidenceRing>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-900 truncate">{member?.name || 'Unknown'}</p>
                  <p className="text-[10px] text-slate-400">
                    {format(new Date(t.date + 'T00:00:00'), 'EEE dd MMM')}
                  </p>
                </div>
              </div>
              <div className="mt-1.5">
                <SourceBadges sources={t.auto_built_sources} size="xs" />
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-slate-500 font-medium">{onSiteH}h on-site</span>
                <button
                  onClick={() => onUndo(t.id)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white text-slate-600 text-[10px] font-semibold hover:bg-slate-100 border border-slate-200 transition active:scale-95"
                >
                  <Undo2 className="w-3 h-3" /> Undo
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}