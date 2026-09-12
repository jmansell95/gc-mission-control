import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet';
import { Truck, MapPin, Navigation, Package } from 'lucide-react';
import L from 'leaflet';

// Real-time route path map for deliveries — draws a polyline connecting
// collection → transfer → delivery legs on a leaflet map, with numbered
// markers at each stop and a directional path line.

const stopIcon = (label, color) => L.divIcon({
  className: 'hazard-map-marker',
  html: `<div style="background: ${color}; color: white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">${label}</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

export default function DeliveryRouteMap({ legs = [] }) {
  const stops = useMemo(() => {
    const points = [];
    for (const leg of legs) {
      if (leg.gps_lat && leg.gps_lng) {
        points.push({
          lat: leg.gps_lat,
          lng: leg.gps_lng,
          label: points.length + 1,
          name: leg.to_location || leg.from_location || `Stop ${points.length + 1}`,
          type: leg.leg_type,
          status: leg.status,
        });
      }
    }
    return points;
  }, [legs]);

  const polylinePositions = useMemo(() =>
    stops.map(s => [s.lat, s.lng]),
  [stops]);

  // Calculate bounds
  const center = useMemo(() => {
    if (!stops.length) return [51.5074, -0.1278]; // London default
    const latSum = stops.reduce((sum, s) => sum + s.lat, 0);
    const lngSum = stops.reduce((sum, s) => sum + s.lng, 0);
    return [latSum / stops.length, lngSum / stops.length];
  }, [stops]);

  if (!stops.length) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center bg-slate-50/50 rounded-xl">
        <Navigation className="w-8 h-8 text-slate-300 mb-2" />
        <p className="text-sm font-medium text-slate-400">No GPS coordinates available</p>
        <p className="text-xs text-slate-400 mt-1">Route path appears here when delivery legs have GPS data.</p>
      </div>
    );
  }

  const legColors = {
    collect: '#3b82f6',
    transfer: '#f59e0b',
    deliver: '#10b981',
  };

  return (
    <div className="rounded-xl overflow-hidden border border-slate-200">
      <MapContainer center={center} zoom={stops.length > 1 ? 10 : 12} style={{ height: '320px', width: '100%' }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap contributors'
        />
        {/* Route path line */}
        {polylinePositions.length > 1 && (
          <Polyline
            positions={polylinePositions}
            pathOptions={{ color: '#2E5A1A', weight: 3, opacity: 0.7, dashArray: '8,6' }}
          />
        )}
        {/* Stop markers */}
        {stops.map((stop, i) => (
          <Marker
            key={i}
            position={[stop.lat, stop.lng]}
            icon={stopIcon(stop.label, legColors[stop.type] || '#2E5A1A')}
          >
            <Popup>
              <div className="text-xs">
                <p className="font-bold mb-1">Stop {stop.label}: {stop.name}</p>
                <p className="capitalize">Type: {stop.type}</p>
                <p className="capitalize">Status: {stop.status}</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2 bg-white border-t border-slate-200 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span className="text-slate-600">Collect</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <span className="text-slate-600">Transfer</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-emerald-500" />
          <span className="text-slate-600">Deliver</span>
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <div className="w-6 h-0.5 bg-primary border-dashed" />
          <span className="text-slate-600">Route path</span>
        </div>
      </div>
    </div>
  );
}