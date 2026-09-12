import React from 'react';
import { Link } from 'react-router-dom';
import { Navigation } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

/**
 * Compact live status badge shown on a rota delivery banner when the driver's
 * delivery is in_progress. Shows the vehicle reg + a pulsing "Driving now"
 * indicator + last-updated relative time. Clicking jumps straight to that
 * vehicle's live view in the Fleet Hub.
 *
 * Only rendered for in_progress deliveries (pending/completed deliveries show
 * no live indicator). The live operator fields on the Vehicle record
 * (current_operator_id, operator_updated_at) are stamped by the delivery
 * lifecycle, so no extra fetch is needed.
 */
export default function LiveDriverBadge({ vehicle }) {
  if (!vehicle?.id) return null;
  const updated = vehicle.operator_updated_at
    ? formatDistanceToNow(new Date(vehicle.operator_updated_at), { addSuffix: true })
    : 'live';
  return (
    <Link
      to={`/fleet?liveVehicle=${vehicle.id}`}
      className="mt-1 flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary text-white text-[10px] font-bold hover:bg-primary/90 active:scale-95 transition touch-manipulation"
      title={`Live tracking — ${vehicle.registration_number || vehicle.name}\nTap to open in Fleet Hub`}
    >
      <span className="relative flex-shrink-0">
        <span className="w-2 h-2 rounded-full bg-[#8DC63F]" />
        <span className="absolute inset-0 w-2 h-2 rounded-full bg-[#8DC63F] animate-ping opacity-70" />
      </span>
      <Navigation className="w-3 h-3 flex-shrink-0" />
      <span className="font-mono truncate">{vehicle.registration_number || vehicle.name}</span>
      <span className="opacity-70 font-medium truncate hidden sm:inline">{updated}</span>
    </Link>
  );
}