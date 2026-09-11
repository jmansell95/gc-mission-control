import React from 'react';

export default function FieldLoadingSkeleton({ count = 3 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="field-card p-4 space-y-3">
          <div className="flex gap-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-200 shimmer" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/3 rounded-lg bg-slate-200 shimmer" />
              <div className="h-3 w-1/2 rounded-lg bg-slate-200 shimmer" />
            </div>
          </div>
          <div className="h-16 rounded-xl bg-slate-100 shimmer" />
        </div>
      ))}
    </div>
  );
}