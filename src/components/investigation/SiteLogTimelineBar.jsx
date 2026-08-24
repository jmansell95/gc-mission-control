import React from 'react';

/**
 * SiteLogTimelineBar — horizontal 24-hour timeline visualization.
 *
 * Renders a day's activities as proportional colored blocks positioned by
 * start_time on a 24-hour axis with hour gridlines. Gaps between activities
 * are visible as empty space. Tap a block to select it.
 *
 * Amber blocks = pending, emerald blocks = approved.
 */
function timeToMins(t) {
  if (!t) return null;
  const m = String(t).match(/^(\d{1,2}):(\d{2})/);
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
}

function fmtDur(mins) {
  const m = Math.round(Number(mins) || 0);
  const h = Math.floor(m / 60), r = m % 60;
  if (h && r) return `${h}h ${r}m`;
  if (h) return `${h}h`;
  return m > 0 ? `${r}m` : '0m';
}

const HOUR_MARKS = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];

export default function SiteLogTimelineBar({ activities, selectedId, onSelect }) {
  return (
    <div className="overflow-x-auto no-scrollbar -mx-1 px-1">
      <div className="relative min-w-[520px] h-20">
        {/* Hour gridlines + labels */}
        {HOUR_MARKS.map(h => (
          <div key={h} className="absolute top-5 bottom-0 border-l border-slate-100"
            style={{ left: `${(h / 24) * 100}%` }}>
            <span className="absolute -top-5 left-0 text-[9px] text-slate-300 font-mono select-none">
              {String(h).padStart(2, '0')}
            </span>
          </div>
        ))}
        {/* End cap at 24h */}
        <div className="absolute top-5 bottom-0 border-l border-slate-100" style={{ left: '100%' }}>
          <span className="absolute -top-5 -translate-x-full left-0 text-[9px] text-slate-300 font-mono select-none">24</span>
        </div>

        {/* Activity blocks */}
        {activities.map(log => {
          const startMins = timeToMins(log.start_time);
          if (startMins == null) return null;
          const dur = log.duration_minutes || 0;
          if (dur <= 0) return null;
          // Cap at 24h for midnight-crossing shifts
          const visibleEnd = Math.min(startMins + dur, 1440);
          const visibleDur = visibleEnd - startMins;
          const left = (startMins / 1440) * 100;
          const width = (visibleDur / 1440) * 100;
          const isPending = (log.manager_review_status || 'pending') !== 'approved';
          const isSelected = selectedId === log.id;
          return (
            <button
              key={log.id}
              onClick={() => onSelect?.(log.id)}
              className={`absolute rounded-md transition-all ${isPending ? 'bg-amber-400 hover:bg-amber-500' : 'bg-emerald-500 hover:bg-emerald-600'} ${isSelected ? 'ring-2 ring-slate-700 ring-offset-1 z-10' : 'opacity-90'}`}
              style={{
                left: `${left}%`,
                width: `${Math.max(width, 0.8)}%`,
                top: '24px',
                height: '32px',
              }}
              title={`${log.start_time}–${log.end_time} · ${fmtDur(dur)}`}
            />
          );
        })}
      </div>
    </div>
  );
}