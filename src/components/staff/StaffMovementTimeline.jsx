import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { MapPin, Home, Briefcase, Navigation, Clock, ArrowRight, Loader2, Route, Truck } from 'lucide-react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup } from 'react-leaflet';

const EVENT_META = {
  home: { icon: Home, colour: '#64748b', label: 'Home' },
  site: { icon: Briefcase, colour: '#10b981', label: 'Site' },
  supplier: { icon: MapPin, colour: '#8b5cf6', label: 'Supplier' },
  inter_site: { icon: Navigation, colour: '#3b82f6', label: 'Inter-site' },
};

function timeStr(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

/**
 * StaffMovementTimeline — shows a staff member's geofence events for today
 * as a vertical timeline (departed home → arrived site → departed site →
 * arrived home) with travel durations, plus a mini breadcrumb trail map.
 *
 * Vehicle proxy: when no phone GPS breadcrumbs exist for today, falls back
 * to the assigned vehicle's Geotab GPS trail so driving time is visible
 * even before phone tracking is working. Vehicle-derived breadcrumbs are
 * shown in indigo with a "via vehicle" note.
 *
 * Used on the Staff Profile page for self-transparency and manager audit.
 */
export default function StaffMovementTimeline({ staffId, staffName }) {
  const today = new Date().toISOString().slice(0, 10);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['staff-geofence-events', staffId, today],
    queryFn: () => base44.entities.StaffGeofenceEvent.filter({ staff_id: staffId, at: today }),
    enabled: !!staffId,
  });

  const { data: breadcrumbs = [] } = useQuery({
    queryKey: ['staff-breadcrumbs', staffId, today],
    queryFn: async () => {
      const all = await base44.entities.StaffLocationLog.filter({ staff_id: staffId, recorded_at: today });
      return all.sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at));
    },
    enabled: !!staffId,
  });

  // Vehicle proxy: fetch today's assignment to get the vehicle_id, then fetch
  // the vehicle's GPS trail for today as a fallback when phone GPS is empty.
  const { data: todayAssignment } = useQuery({
    queryKey: ['staff-today-assignment-for-timeline', staffId, today],
    queryFn: async () => {
      const all = await base44.entities.RotaAssignment.filter({ staff_id: staffId, assigned_date: today });
      return all[0] || null;
    },
    enabled: !!staffId,
  });

  const vehicleId = todayAssignment?.vehicle_id || null;

  const { data: vehicleBreadcrumbs = [] } = useQuery({
    queryKey: ['vehicle-breadcrumbs-for-staff-timeline', vehicleId, today],
    queryFn: async () => {
      if (!vehicleId) return [];
      const all = await base44.entities.VehicleLocationLog.filter({ vehicle_id: vehicleId, timestamp: today });
      return all.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    },
    enabled: !!vehicleId,
  });

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => new Date(a.at) - new Date(b.at)),
    [events],
  );

  // Use phone breadcrumbs if available; otherwise fall back to vehicle GPS
  const usingVehicleProxy = breadcrumbs.length === 0 && vehicleBreadcrumbs.length > 0;
  const breadcrumbData = usingVehicleProxy
    ? vehicleBreadcrumbs.filter(b => b.lat && b.lng)
    : breadcrumbs.filter(b => b.lat && b.lng);

  const breadcrumbPath = useMemo(
    () => breadcrumbData.map(b => [b.lat, b.lng]),
    [breadcrumbData],
  );

  const polylineColour = usingVehicleProxy ? '#6366f1' : '#2E5A1A';

  if (isLoading) {
    return (
      <div className="insight-card rounded-2xl p-5 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  if (sortedEvents.length === 0 && breadcrumbPath.length === 0) {
    return (
      <div className="insight-card rounded-2xl p-5 text-center">
        <Route className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm font-semibold text-slate-600">No movement data yet</p>
        <p className="text-xs text-slate-400 mt-1">GPS tracking events will appear here once {staffName || 'this staff member'} starts their shift.</p>
      </div>
    );
  }

  return (
    <div className="field-card overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <Route className="w-4 h-4 text-[#2E5A1A]" />
        <h3 className="text-sm font-bold text-slate-900">Today's Movements</h3>
        <span className="text-xs text-slate-400 ml-auto">{sortedEvents.length} events · {breadcrumbPath.length} GPS points</span>
      </div>

      {usingVehicleProxy && (
        <div className="px-4 py-2 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2">
          <Truck className="w-3.5 h-3.5 text-indigo-600" />
          <p className="text-xs text-indigo-700 font-medium">
            Showing vehicle GPS trail (no phone GPS yet today) · {vehicleBreadcrumbs[0]?.vehicle_name || 'assigned vehicle'}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
        {/* Timeline */}
        <div className="space-y-0">
          {sortedEvents.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">No geofence events yet today.</p>
          ) : (
            <div className="relative pl-6">
              {/* Vertical line */}
              <div className="absolute left-2.5 top-2 bottom-2 w-0.5 bg-slate-200" />
              {sortedEvents.map((ev, i) => {
                const meta = EVENT_META[ev.geofence_type] || EVENT_META.home;
                const Icon = meta.icon;
                const isArrive = ev.event_type === 'arrive';
                return (
                  <div key={ev.id || i} className="relative pb-4 last:pb-0">
                    {/* Dot */}
                    <div
                      className="absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center ring-2 ring-white"
                      style={{ background: meta.colour }}
                    >
                      <Icon className="w-2.5 h-2.5 text-white" />
                    </div>
                    <div className="ml-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">
                          {isArrive ? 'Arrived' : 'Departed'}
                        </span>
                        <span className="text-xs text-slate-500">{meta.label}</span>
                        {ev.linked_geofence_name && ev.geofence_type === 'site' && (
                          <span className="text-xs text-slate-400 truncate">· {ev.linked_geofence_name}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                        <Clock className="w-3 h-3" />
                        {timeStr(ev.at)}
                        {ev.travel_minutes != null && ev.travel_minutes > 0 && (
                          <span className="text-blue-600 font-medium">
                            · {Math.floor(ev.travel_minutes / 60)}h {ev.travel_minutes % 60}m travel
                          </span>
                        )}
                        {ev.duration_on_site_minutes != null && ev.duration_on_site_minutes > 0 && (
                          <span className="text-emerald-600 font-medium">
                            · {Math.floor(ev.duration_on_site_minutes / 60)}h {ev.duration_on_site_minutes % 60}m on site
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Breadcrumb mini-map */}
        {breadcrumbPath.length > 0 && (
          <div className="rounded-xl overflow-hidden border border-slate-200" style={{ height: 240 }}>
            <MapContainer
              center={breadcrumbPath[0] || [52.3, -1.5]}
              zoom={13}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={false}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
              {breadcrumbPath.length > 1 && (
                <Polyline positions={breadcrumbPath} pathOptions={{ color: polylineColour, weight: 3, opacity: 0.7, dashArray: usingVehicleProxy ? '8 6' : undefined }} />
              )}
              {breadcrumbPath.length > 0 && (
                <CircleMarker center={breadcrumbPath[0]} radius={6} pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.9, weight: 2 }}>
                  <Popup><div className="text-xs font-bold text-emerald-700">Start</div></Popup>
                </CircleMarker>
              )}
              {breadcrumbPath.length > 1 && (
                <CircleMarker center={breadcrumbPath[breadcrumbPath.length - 1]} radius={6} pathOptions={{ color: '#f43f5e', fillColor: '#f43f5e', fillOpacity: 0.9, weight: 2 }}>
                  <Popup><div className="text-xs font-bold text-rose-700">Current</div></Popup>
                </CircleMarker>
              )}
            </MapContainer>
          </div>
        )}
      </div>
    </div>
  );
}