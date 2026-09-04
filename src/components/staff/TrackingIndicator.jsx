import React from 'react';
import { MapPin, Loader2, AlertTriangle, WifiOff } from 'lucide-react';

/**
 * TrackingIndicator — a small pill shown in the staff app header that
 * reflects the real GPS capture state:
 *
 *   - Green "Tracking"    → actively receiving GPS fixes and flushing data
 *   - Amber "Waiting…"     → watch started but no fix received yet
 *   - Amber "No GPS signal" → position unavailable / no fix after timeout
 *   - Red "Location off"  → permission denied; tappable to retry
 *
 * FIX: Previously showed a green pill the moment the watch started, even
 * if every position call errored (permission denied). Now only shows
 * green after a real GPS fix, and surfaces errors visibly.
 */
export default function TrackingIndicator({ isTracking, hasFix, pointsQueued = 0, errorType, onRetry }) {
  // Not tracking and no error → hidden
  if (!isTracking && !errorType) return null;

  // Permission denied — red pill, tappable to retry
  if (errorType === 'permission_denied' || errorType === 'permanently_denied') {
    return (
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-300 hover:bg-red-500/30 transition"
        title="Location permission denied — tap to retry"
      >
        <AlertTriangle className="w-2.5 h-2.5" />
        Location off — tap to enable
      </button>
    );
  }

  // No GPS signal — position unavailable or no-fix timeout
  if (errorType === 'no_fix_timeout' || errorType === 'position_unavailable') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300">
        <WifiOff className="w-2.5 h-2.5" />
        No GPS signal
      </span>
    );
  }

  // Waiting for first GPS fix — amber pill
  if (isTracking && !hasFix) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300">
        <Loader2 className="w-2.5 h-2.5 animate-spin" />
        Waiting for GPS…
      </span>
    );
  }

  // Actively tracking with a real fix — green pill
  if (hasFix) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-400/20 text-emerald-200">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
        </span>
        <MapPin className="w-2.5 h-2.5" />
        Tracking{pointsQueued > 0 ? ` · ${pointsQueued}` : ''}
      </span>
    );
  }

  return null;
}