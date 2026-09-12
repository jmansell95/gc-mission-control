import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { MapContainer, TileLayer, Marker, Polyline, CircleMarker } from 'react-leaflet';
import { Route, Clock, Navigation, Gauge, MapPin, Loader2, ChevronRight } from 'lucide-react';

/**
 * TripTimeline — fetches location history for a vehicle from Geotab and
 * renders it as a scrollable visual timeline of trips. Each trip shows
 * start/end time, duration, distance, and a mini-route map.
 */
function formatDuration(mins) {
  if (!mins || mins < 0) return '—';
  if (mins < 60) return `${Math.round(mins)}m`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function TripMiniMap({ points }) {
  if (!points || points.length < 2) return null;
  const path = points.map(p => [p.lat, p.lng]);
  const center = path[Math.floor(path.length / 2)];

  return (
    <div className="h-32 rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
      <MapContainer center={center} zoom={12} className="w-full h-full"
        zoomControl={false} dragging={false} scrollWheelZoom={false}
        doubleClickZoom={false} touchZoom={false} keyboard={false} attributionControl={false}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Polyline positions={path} pathOptions={{ color: '#2E5A1A', weight: 3, opacity: 0.7 }} />
        <CircleMarker center={path[0]} radius={5} pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 1 }} />
        <CircleMarker center={path[path.length - 1]} radius={5} pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 1 }} />
      </MapContainer>
    </div>
  );
}

export default function TripTimeline({ vehicleId }) {
  const [expanded, setExpanded] = useState(null);

  const { data: history, isLoading } = useQuery({
    queryKey: ['vehicle-trip-history', vehicleId],
    queryFn: async () => {
      if (!vehicleId) return null;
      const res = await base44.functions.invoke('getVehicleLocationHistory', {
        mode: 'history',
        vehicle_id: vehicleId,
        limit: 500,
      });
      const d = res?.data ?? res;
      return d;
    },
    enabled: !!vehicleId,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center py-8">
        <Loader2 className="w-6 h-6 text-primary animate-spin mb-2" />
        <p className="text-xs text-slate-400">Loading trip history...</p>
      </div>
    );
  }

  const points = Array.isArray(history?.points) ? history.points : [];
  if (points.length === 0) {
    return (
      <div className="text-center py-8">
        <Route className="w-8 h-8 text-slate-200 mx-auto mb-2" />
        <p className="text-xs text-slate-400">No trip history yet. Sync from Geotab to populate.</p>
      </div>
    );
  }

  // Group points into trips by ignition on/off transitions
  const trips = [];
  let currentTrip = null;
  for (const p of points) {
    if (p.ignition_on && !currentTrip) {
      currentTrip = { points: [p], startTime: p.timestamp, startLat: p.lat, startLng: p.lng };
    } else if (p.ignition_on && currentTrip) {
      currentTrip.points.push(p);
      currentTrip.endTime = p.timestamp;
      currentTrip.endLat = p.lat;
      currentTrip.endLng = p.lng;
    } else if (!p.ignition_on && currentTrip) {
      currentTrip.endTime = currentTrip.endTime || p.timestamp;
      trips.push(currentTrip);
      currentTrip = null;
    }
  }
  if (currentTrip) trips.push(currentTrip);
  trips.reverse(); // most recent first

  if (trips.length === 0) {
    return (
      <div className="text-center py-8">
        <Route className="w-8 h-8 text-slate-200 mx-auto mb-2" />
        <p className="text-xs text-slate-400">No trips detected in the available history.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-slate-400 mb-1">{trips.length} trip(s) found · showing most recent first</p>
      {trips.slice(0, 20).map((trip, i) => {
        const isOpen = expanded === i;
        const start = new Date(trip.startTime);
        const end = trip.endTime ? new Date(trip.endTime) : null;
        const durationMins = end ? (end - start) / 60000 : 0;
        const distance = trip.points.reduce((acc, p, idx) => {
          if (idx === 0) return 0;
          const prev = trip.points[idx - 1];
          const dLat = (p.lat - prev.lat) * 111;
          const dLng = (p.lng - prev.lng) * 111 * Math.cos(prev.lat * Math.PI / 180);
          return acc + Math.sqrt(dLat * dLat + dLng * dLng);
        }, 0);

        return (
          <div key={i} className="border border-slate-200 rounded-lg overflow-hidden">
            <button onClick={() => setExpanded(isOpen ? null : i)}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 transition text-left">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center flex-shrink-0">
                <Route className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-800">
                  {start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · {start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  {end && ` → ${end.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}
                </p>
                <div className="flex items-center gap-3 mt-0.5 text-[10px] text-slate-400">
                  <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" /> {formatDuration(durationMins)}</span>
                  <span className="flex items-center gap-0.5"><Navigation className="w-2.5 h-2.5" /> {distance.toFixed(1)} km</span>
                  <span className="flex items-center gap-0.5"><Gauge className="w-2.5 h-2.5" /> {trip.points.length} pts</span>
                </div>
              </div>
              <ChevronRight className={`w-4 h-4 text-slate-300 flex-shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
            </button>
            {isOpen && (
              <div className="px-3 pb-3 border-t border-slate-100 pt-2">
                <TripMiniMap points={trip.points} />
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="bg-emerald-50 rounded-lg p-2">
                    <p className="text-[9px] uppercase text-emerald-400 font-semibold">Start</p>
                    <p className="text-[11px] font-medium text-emerald-700">{start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
                    <p className="text-[9px] text-emerald-500 font-mono mt-0.5">{trip.startLat?.toFixed(4)}, {trip.startLng?.toFixed(4)}</p>
                  </div>
                  <div className="bg-rose-50 rounded-lg p-2">
                    <p className="text-[9px] uppercase text-rose-400 font-semibold">End</p>
                    <p className="text-[11px] font-medium text-rose-700">{end ? end.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'}</p>
                    <p className="text-[9px] text-rose-500 font-mono mt-0.5">{trip.endLat?.toFixed(4)}, {trip.endLng?.toFixed(4)}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
      {trips.length > 20 && <p className="text-[11px] text-slate-400 text-center pt-1">+{trips.length - 20} more trips</p>}
    </div>
  );
}