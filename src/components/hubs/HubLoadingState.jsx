import React from 'react';

/**
 * HubLoadingState — shimmer skeletons that mirror the shape of the content
 * they replace so layouts don't jump when data lands.
 *
 * variant: 'cards' (default grid of cards) | 'list' (stacked rows) | 'table' | 'stats'
 */
function Bone({ className = '' }) {
  return <div className={`rounded-lg bg-slate-200/70 relative overflow-hidden ${className}`}><span className="absolute inset-0 shimmer" /></div>;
}

export default function HubLoadingState({ variant = 'cards', count = 6, label = 'Loading…' }) {
  if (variant === 'stats') {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5" aria-busy="true" aria-label={label}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="hub-glass rounded-2xl p-3 space-y-2"><Bone className="h-3 w-1/2" /><Bone className="h-6 w-2/3" /></div>
        ))}
      </div>
    );
  }
  if (variant === 'list' || variant === 'table') {
    return (
      <div className="hub-glass rounded-3xl p-4 space-y-3" aria-busy="true" aria-label={label}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Bone className="w-9 h-9 rounded-xl flex-shrink-0" />
            <div className="flex-1 space-y-1.5"><Bone className="h-3 w-2/5" /><Bone className="h-2.5 w-3/5" /></div>
            <Bone className="h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4" aria-busy="true" aria-label={label}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="hub-glass rounded-3xl p-5 space-y-3">
          <div className="flex items-center gap-3"><Bone className="w-9 h-9 rounded-xl" /><Bone className="h-3.5 w-1/2" /></div>
          <Bone className="h-2.5 w-full" /><Bone className="h-2.5 w-4/5" /><Bone className="h-8 w-1/3 mt-2" />
        </div>
      ))}
    </div>
  );
}