import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { MapPin, Clock, Navigation, Loader2 } from 'lucide-react';

/**
 * StaffTrackingBadge — a compact card section showing a staff member's live
 * GPS tracking status, last known location, and today's movement summary.
 * Designed to sit on staff cards in the Staff Hub / People Directory.
 *
 * Props:
 *   - staffId: string
 *   - compact: boolean — if true, renders a single-line badge instead of a card
 */
export default function StaffTrackingBadge({ staffId, compact = false }) {
  const today = new Date().toISOString().slice(0, 10);

  const { data: latestLog } = useQuery({
    queryKey: ['staff-latest-location', staffId],
    queryFn: async () => {
      const logs = await base44.entities.StaffLocationLog.filter({ staff_id: staffId }, '-recorded_at', 1);
      return logs[0] || null;
    },
    enabled: !!staffId,
    staleTime: 15000,
  });

  const { data: todayEvents = [] } = useQuery({
    queryKey: ['staff-geofence-events-card', staffId, today],
    queryFn: () => base44.entities.StaffGeofenceEvent.filter({ staff_id: staffId, at: today }),
    enabled: !!staffId,
  });

  if (!latestLog) {
    if (compact) return null;
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 px-2 py-1">
        <MapPin className="w-3 h-3" /> No GPS data
      </div>
    );
  }

  const lastTime = latestLog.recorded_at
    ? new Date(latestLog.recorded_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : '—';
  const isStale = latestLog.recorded_at && (Date.now() - new Date(latestLog.recorded_at).getTime() > 30 * 60 * 1000);
  const siteArrival = todayEvents.find(e => e.geofence_type === 'site' && e.event_type === 'arrive');
  const siteDepart = todayEvents.find(e => e.geofence_type === 'site' && e.event_type === 'depart');
  const homeDepart = todayEvents.find(e => e.geofence_type === 'home' && e.event_type === 'depart');

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${isStale ? 'bg-slate-100 text-slate-400' : latestLog.is_moving ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${isStale ? 'bg-slate-300' : latestLog.is_moving ? 'bg-emerald-500 animate-pulse' : 'bg-blue-500'}`} />
        {isStale ? `Last seen ${lastTime}` : latestLog.is_moving ? 'Moving' : 'Stationary'}
      </span>
    );
  }

  return (
    <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${isStale ? 'bg-slate-300' : latestLog.is_moving ? 'bg-emerald-500 animate-pulse' : 'bg-blue-500'}`} />
          <span className="text-xs font-bold text-slate-700">
            {isStale ? 'Last seen' : latestLog.is_moving ? 'Moving' : 'Stationary'}
          </span>
        </div>
        <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
          <Clock className="w-2.5 h-2.5" /> {lastTime}
        </span>
      </div>
      <div className="flex items-center gap-3 text-[10px] text-slate-500">
        {homeDepart && (
          <span className="flex items-center gap-0.5">
            <MapPin className="w-2.5 h-2.5 text-slate-400" /> Left home {new Date(homeDepart.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        {siteArrival && (
          <span className="flex items-center gap-0.5">
            <MapPin className="w-2.5 h-2.5 text-emerald-500" /> On site {new Date(siteArrival.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        {siteDepart && (
          <span className="flex items-center gap-0.5">
            <MapPin className="w-2.5 h-2.5 text-blue-500" /> Left site {new Date(siteDepart.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        {!homeDepart && !siteArrival && !siteDepart && (
          <span className="text-slate-400">No geofence events yet today</span>
        )}
      </div>
    </div>
  );
}