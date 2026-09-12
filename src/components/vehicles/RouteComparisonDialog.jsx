import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, Marker } from 'react-leaflet';
import { Route, Loader2, Navigation, MapPin, TrendingDown, TrendingUp, GitCompare, Clock, Gauge } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';

const UK_CENTER = [52.3, -1.5];

// Decode a Google Maps encoded polyline string into [lat, lng] pairs
function decodePolyline(encoded) {
  const coords = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : result >> 1;
    coords.push([lat * 1e-5, lng * 1e-5]);
  }
  return coords;
}

/**
 * RouteComparisonDialog — overlays three route polylines on a map:
 * 1. Actual driven route (brand green, solid) — from breadcrumbs
 * 2. Google Maps optimal A→B road route (cyan, dashed)
 * 3. Optimized delivery stop-order route (amber, dashed)
 * Shows a summary panel with distance/time deltas.
 *
 * @param {Object|null} trip - { start_lat, start_lng, end_lat, end_lng, driver_staff_id, date, vehicle_id }
 * @param {Array} breadcrumbs - actual GPS breadcrumbs for the trip
 */
export default function RouteComparisonDialog({ trip, breadcrumbs = [], onClose }) {
  const [showStops, setShowStops] = useState(true);

  const { data: comparison, isLoading } = useQuery({
    queryKey: ['route-comparison', trip?.vehicle_id, trip?.date, trip?.start_lat, trip?.end_lat],
    queryFn: async () => {
      if (!trip?.start_lat || !trip?.start_lng) return null;
      const res = await base44.functions.invoke('getRouteComparison', {
        start_lat: trip.start_lat,
        start_lng: trip.start_lng,
        end_lat: trip.end_lat,
        end_lng: trip.end_lng,
        driver_staff_id: trip.driver_staff_id || null,
        date: trip.date || null,
      });
      return res?.data || res;
    },
    enabled: !!trip && !!trip.start_lat,
  });

  const actualPath = useMemo(
    () => breadcrumbs.filter(b => b.lat && b.lng).map(b => [b.lat, b.lng]),
    [breadcrumbs]
  );

  const googlePath = useMemo(() => {
    if (!comparison?.google_optimal?.polyline) return [];
    return comparison.google_optimal.polyline;
  }, [comparison]);

  const stopOrderPath = useMemo(() => {
    if (!comparison?.optimized_stops?.polyline) return [];
    return comparison.optimized_stops.polyline;
  }, [comparison]);

  const stops = comparison?.optimized_stops?.stops || [];

  // Fit bounds to all polylines
  const allPoints = useMemo(() => {
    const pts = [...actualPath, ...googlePath, ...stopOrderPath];
    return pts.filter(p => p[0] != null && p[1] != null);
  }, [actualPath, googlePath, stopOrderPath]);

  const center = useMemo(() => {
    if (actualPath.length > 0) return actualPath[Math.floor(actualPath.length / 2)];
    if (allPoints.length > 0) return allPoints[0];
    return UK_CENTER;
  }, [actualPath, allPoints]);

  if (!trip) return null;

  const actualKm = (comparison?.actual_distance_km || 0).toFixed(1);
  const googleKm = (comparison?.google_optimal?.distance_km || 0).toFixed(1);
  const stopKm = (comparison?.optimized_stops?.distance_km || 0).toFixed(1);
  const googleMin = comparison?.google_optimal?.duration_min || 0;
  const stopMin = comparison?.optimized_stops?.duration_min || 0;

  const deltaKm = (Number(actualKm) - Number(googleKm)).toFixed(1);
  const deltaMin = Math.round(googleMin > 0 ? (comparison?.actual_duration_min || 0) - googleMin : 0);

  return (
    <Dialog open={!!trip} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg stat-gradient-brand flex items-center justify-center">
              <GitCompare className="w-4 h-4 text-white" />
            </div>
            Route Comparison
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex flex-col items-center py-16">
            <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
            <p className="text-sm text-slate-500">Fetching optimal routes from Google Maps…</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Map */}
            <div className="rounded-xl overflow-hidden border border-slate-200" style={{ height: 400 }}>
              <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
                {/* Actual driven route — brand green, solid */}
                {actualPath.length > 1 && (
                  <Polyline positions={actualPath} pathOptions={{ color: '#2E5A1A', weight: 4, opacity: 0.85 }} />
                )}
                {/* Google Maps optimal — cyan, dashed */}
                {googlePath.length > 1 && (
                  <Polyline positions={googlePath} pathOptions={{ color: '#06b6d4', weight: 3, opacity: 0.7, dashArray: '8 6' }} />
                )}
                {/* Optimized stop order — amber, dashed */}
                {showStops && stopOrderPath.length > 1 && (
                  <Polyline positions={stopOrderPath} pathOptions={{ color: '#f59e0b', weight: 3, opacity: 0.7, dashArray: '8 6' }} />
                )}
                {/* Start marker — emerald */}
                {actualPath.length > 0 && (
                  <CircleMarker center={actualPath[0]} radius={8} pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.9, weight: 3 }}>
                    <Popup><div className="text-xs font-bold text-emerald-700">Start</div></Popup>
                  </CircleMarker>
                )}
                {/* End marker — rose */}
                {actualPath.length > 1 && (
                  <CircleMarker center={actualPath[actualPath.length - 1]} radius={8} pathOptions={{ color: '#f43f5e', fillColor: '#f43f5e', fillOpacity: 0.9, weight: 3 }}>
                    <Popup><div className="text-xs font-bold text-rose-700">End</div></Popup>
                  </CircleMarker>
                )}
                {/* Delivery stop markers */}
                {showStops && stops.map((s, i) => (
                  <CircleMarker key={i} center={[s.lat, s.lng]} radius={6} pathOptions={{ color: '#f59e0b', fillColor: '#fbbf24', fillOpacity: 0.8, weight: 2 }}>
                    <Popup>
                      <div className="text-xs space-y-0.5">
                        <p className="font-bold text-amber-700">Stop {s.sequence}</p>
                        <p className="text-slate-600">{s.address}</p>
                        {s.job_name && <p className="text-slate-500">{s.job_name}</p>}
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1.5"><span className="w-4 h-1 rounded-full bg-primary" /> Actual Driven</span>
              <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 border-t-2 border-dashed border-cyan-500" /> Google Optimal A→B</span>
              {stops.length > 0 && (
                <button onClick={() => setShowStops(s => !s)} className="flex items-center gap-1.5">
                  <span className={`w-4 h-0.5 border-t-2 border-dashed ${showStops ? 'border-amber-500' : 'border-slate-300'}`} />
                  <span className={showStops ? 'text-slate-700 font-medium' : 'text-slate-400'}>Optimized Stops ({stops.length})</span>
                </button>
              )}
            </div>

            {/* Summary tiles */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="hub-glass rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1"><Route className="w-3.5 h-3.5 text-primary" /><p className="text-[10px] uppercase font-semibold text-slate-400">Actual</p></div>
                <p className="text-lg font-bold text-primary tabular-nums">{actualKm}<span className="text-xs font-normal"> km</span></p>
                <p className="text-[10px] text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" /> {comparison?.actual_duration_min || 0} min</p>
              </div>
              <div className="hub-glass rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1"><Navigation className="w-3.5 h-3.5 text-cyan-600" /><p className="text-[10px] uppercase font-semibold text-slate-400">Google Optimal</p></div>
                <p className="text-lg font-bold text-cyan-700 tabular-nums">{googleKm}<span className="text-xs font-normal"> km</span></p>
                <p className="text-[10px] text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" /> {googleMin} min</p>
              </div>
              {stops.length > 0 ? (
                <div className="hub-glass rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1"><MapPin className="w-3.5 h-3.5 text-amber-600" /><p className="text-[10px] uppercase font-semibold text-slate-400">Optimized Stops</p></div>
                  <p className="text-lg font-bold text-amber-700 tabular-nums">{stopKm}<span className="text-xs font-normal"> km</span></p>
                  <p className="text-[10px] text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" /> {stopMin} min · {stops.length} stops</p>
                </div>
              ) : (
                <div className="hub-glass rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1"><MapPin className="w-3.5 h-3.5 text-slate-400" /><p className="text-[10px] uppercase font-semibold text-slate-400">Stops</p></div>
                  <p className="text-sm text-slate-400 italic mt-1">No delivery stops for this driver/date</p>
                </div>
              )}
            </div>

            {/* Delta analysis */}
            <div className="hub-glass rounded-xl p-3">
              <p className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5"><Gauge className="w-3.5 h-3.5 text-primary" /> Deviation Analysis</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  {Number(deltaKm) > 0 ? (
                    <TrendingUp className="w-4 h-4 text-rose-500" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-emerald-500" />
                  )}
                  <div>
                    <p className="text-[10px] text-slate-400">Distance vs Optimal</p>
                    <p className={`text-sm font-bold tabular-nums ${Number(deltaKm) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {Number(deltaKm) > 0 ? '+' : ''}{deltaKm} km
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {deltaMin > 0 ? (
                    <TrendingUp className="w-4 h-4 text-rose-500" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-emerald-500" />
                  )}
                  <div>
                    <p className="text-[10px] text-slate-400">Time vs Optimal</p>
                    <p className={`text-sm font-bold tabular-nums ${deltaMin > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {deltaMin > 0 ? '+' : ''}{deltaMin} min
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}