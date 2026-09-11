import React from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * StaffBadges — compact CP / Rotary qualification pills + training-gap
 * warning chip shown on each staff row in the Resource Planner heatmap.
 * `compact` = smaller pills for the year grid (7px cells).
 */
export default function StaffBadges({ staff, compact = false }) {
  const showCP = staff.has_cp;
  const showRotary = staff.has_rotary;
  const gapCount = staff.training_gap_count || 0;

  if (!showCP && !showRotary && gapCount === 0) return null;

  const sizeCls = compact
    ? 'text-[7px] px-0.5 h-3'
    : 'text-[8px] px-1 h-3.5';

  return (
    <div className="flex items-center gap-0.5 flex-shrink-0">
      {showCP && (
        <span className={`${sizeCls} inline-flex items-center font-bold rounded bg-blue-100 text-blue-700`} title="Cable Percussion trained">
          CP
        </span>
      )}
      {showRotary && (
        <span className={`${sizeCls} inline-flex items-center font-bold rounded bg-orange-100 text-orange-700`} title="Rotary trained">
          Rot
        </span>
      )}
      {gapCount > 0 && (
        <span className={`${sizeCls} inline-flex items-center gap-0.5 font-bold rounded bg-amber-100 text-amber-700`} title={`${gapCount} training gap${gapCount !== 1 ? 's' : ''}`}>
          <AlertTriangle className={compact ? 'w-2 h-2' : 'w-2.5 h-2.5'} />
          {gapCount}
        </span>
      )}
    </div>
  );
}