import React from 'react';

/**
 * WidgetLoadingState — standardized skeleton loader for dashboard widgets.
 * Renders a branded shimmer pattern that matches the WidgetShell body
 * dimensions. Use inside WidgetShell (or standalone in a widget card) so
 * every widget shows the same loading animation instead of ad-hoc spinners.
 *
 * Props:
 *   rows  — number of skeleton rows (default 3)
 *   variant — 'list' (rows, default) | 'grid' (2×2 tiles) | 'chart' (bar area)
 */
export default function WidgetLoadingState({ rows = 3, variant = 'list' }) {
  if (variant === 'grid') {
    return (
      <div className="grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="rounded-xl bg-slate-100/70 overflow-hidden">
            <div className="h-14 shimmer bg-slate-100" />
            <div className="p-3 space-y-2">
              <div className="h-3 w-20 shimmer rounded bg-slate-100" />
              <div className="h-2 w-16 shimmer rounded bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'chart') {
    return (
      <div className="space-y-3">
        <div className="flex items-end gap-2 h-24">
          {[40, 65, 50, 80, 55, 70, 45].map((h, i) => (
            <div key={i} className="flex-1 shimmer rounded-t-lg bg-slate-100" style={{ height: `${h}%` }} />
          ))}
        </div>
        <div className="flex justify-between">
          {[0, 1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-2 w-8 shimmer rounded bg-slate-100" />
          ))}
        </div>
      </div>
    );
  }

  // Default: list rows
  return (
    <div className="space-y-2.5">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg shimmer bg-slate-100 flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-3/4 shimmer rounded bg-slate-100" />
            <div className="h-2.5 w-1/2 shimmer rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}