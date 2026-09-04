import React from 'react';
import { MapPin, Loader2 } from 'lucide-react';

/**
 * TrackingIndicator — a small pill shown in the staff app header when
 * GPS tracking is actively capturing the crew member's location.
 * Shows a pulsing green dot + "Tracking" label while active.
 */
export default function TrackingIndicator({ isTracking, pointsQueued = 0 }) {
  if (!isTracking) return null;
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