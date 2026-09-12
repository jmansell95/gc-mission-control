import React from 'react';
import { MapContainer, TileLayer, Marker, CircleMarker } from 'react-leaflet';
import { MapPin, Clock, Navigation, ExternalLink, Loader2 } from 'lucide-react';
import { useReverseGeocode } from '@/hooks/useReverseGeocode';

/**
 * A small, non-interactive Leaflet "snapshot" map showing a vehicle's last
 * known GPS position. Designed to sit inside a fleet card — no zoom controls,
 * no dragging, just a static pin thumbnail with a last-seen timestamp and
 * a Google Maps link. Uses the two-phase reverse geocode hook so the address
 * appears instantly (BigDataCloud) then upgrades to street-level (Nominatim).
 */
export default function VehicleLocationMiniMap({ lat, lng, timestamp, ignition_on, speed_kph, driver_name }) {
  // Two-phase geocoding: instant BigDataCloud → background Nominatim upgrade
  const { label: address, isLoading: addrLoading } = useReverseGeocode(lat, lng);

  const gmapsUrl = lat != null && lng != null
    ? `https://www.google.com/maps?q=${lat},${lng}`
    : null;

  if (lat == null || lng == null) {
    return (
      <div className="flex flex-col items-center justify-center h-24 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-400 gap-1">
        <MapPin className="w-4 h-4 text-slate-300" />
        <span>No live location</span>
      </div>
    );
  }

  const pos = [lat, lng];
  const colour = ignition_on ? '#2E5A1A' : '#94a3b8';
  const icon = window.L?.divIcon({
    html: `<div style="background:${colour};width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.45)"></div>`,
    className: 'hazard-map-marker',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });

  return (
    <div className="rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
      <div className="relative h-24">
        <MapContainer
          center={pos}
          zoom={15}
          className="w-full h-full"
          zoomControl={false}
          dragging={false}
          scrollWheelZoom={false}
          doubleClickZoom={false}
          touchZoom={false}
          keyboard={false}
          attributionControl={false}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {icon ? (
            <Marker position={pos} icon={icon} />
          ) : (
            <CircleMarker center={pos} radius={6} pathOptions={{ color: colour, fillColor: colour, fillOpacity: 1 }} />
          )}
        </MapContainer>

        {/* Status chip */}
        <span className="absolute top-1 right-1 flex items-center gap-1 bg-white/90 text-[9px] font-semibold px-1.5 py-0.5 rounded shadow-sm">
          <span className={`w-1.5 h-1.5 rounded-full ${ignition_on ? 'bg-emerald-500' : 'bg-slate-400'}`} />
          {ignition_on ? 'Engine On' : 'Off'}
        </span>

        {/* Last seen */}
        {timestamp && (
          <span className="absolute bottom-1 left-1 bg-white/90 text-slate-600 text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1 shadow-sm">
            <Clock className="w-2.5 h-2.5" />
            {new Date(timestamp).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </span>
        )}

        {speed_kph != null && speed_kph > 0 && (
          <span className="absolute bottom-1 right-1 bg-white/90 text-slate-600 text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1 shadow-sm">
            <Navigation className="w-2.5 h-2.5" /> {Math.round(speed_kph * 0.621371)} mph
          </span>
        )}
      </div>

      {/* Address bar with Google Maps link — prominent road + postcode display */}
      <div className="px-2.5 py-2 bg-white border-t border-slate-100">
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-primary flex-shrink-0" />
          <span className="text-xs text-slate-800 font-semibold truncate flex-1">
            {addrLoading ? <span className="flex items-center gap-1 text-slate-400"><Loader2 className="w-3 h-3 animate-spin" /> Locating…</span>
              : address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`}
          </span>
          {gmapsUrl && (
            <a
              href={gmapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-0.5 text-[10px] font-semibold text-blue-600 hover:text-blue-700 hover:underline flex-shrink-0"
            >
              Maps <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}