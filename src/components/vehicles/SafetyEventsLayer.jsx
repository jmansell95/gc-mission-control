import React, { useMemo } from 'react';
import { CircleMarker, Popup, Tooltip } from 'react-leaflet';
import { ShieldAlert, Zap, Gauge, AlertTriangle, Navigation } from 'lucide-react';

const EVENT_COLORS = {
  speeding: '#ef4444',
  harsh_braking: '#f59e0b',
  harsh_accel: '#f97316',
  harsh_cornering: '#8b5cf6',
  seatbelt: '#ec4899',
  idling: '#64748b',
  other: '#64748b',
};

const EVENT_LABELS = {
  speeding: 'Speeding',
  harsh_braking: 'Harsh Braking',
  harsh_accel: 'Harsh Acceleration',
  harsh_cornering: 'Harsh Cornering',
  seatbelt: 'Seatbelt',
  idling: 'Idling',
  other: 'Safety Event',
};

/**
 * SafetyEventsLayer — renders coloured CircleMarkers on the Leaflet map
 * for each safety violation event. Click a marker for event details
 * (type, speed, time, driver).
 *
 * @param {Array} events - safety events from getVehicleSafetyEvents
 */
export default function SafetyEventsLayer({ events = [] }) {
  const validEvents = useMemo(
    () => events.filter(e => e.latitude != null && e.longitude != null),
    [events]
  );

  if (validEvents.length === 0) return null;

  return (
    <>
      {validEvents.map((e, i) => {
        const color = EVENT_COLORS[e.violation_type] || EVENT_COLORS.other;
        return (
          <CircleMarker
            key={e.id || i}
            center={[Number(e.latitude), Number(e.longitude)]}
            radius={6}
            pathOptions={{ color, fillColor: color, fillOpacity: 0.8, weight: 2 }}
          >
            <Tooltip>
              <div className="text-xs">
                <p className="font-bold" style={{ color }}>{EVENT_LABELS[e.violation_type] || e.violation_label}</p>
                {e.datetime && <p className="text-slate-500">{new Date(e.datetime).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>}
              </div>
            </Tooltip>
            <Popup>
              <div className="text-xs space-y-1 min-w-[180px]">
                <div className="flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" style={{ color }} />
                  <p className="font-bold text-sm" style={{ color }}>{EVENT_LABELS[e.violation_type] || e.violation_label}</p>
                </div>
                {e.datetime && (
                  <p className="text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(e.datetime).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
                {e.driver_name && <p className="text-slate-600">Driver: {e.driver_name}</p>}
                {e.speed_kph != null && (
                  <p className="flex items-center gap-1 text-slate-600">
                    <Gauge className="w-3 h-3" /> {Math.round(e.speed_kph)} km/h
                    {e.speed_limit_kph != null && <span className="text-slate-400">(limit: {Math.round(e.speed_limit_kph)} km/h)</span>}
                  </p>
                )}
                {e.duration_seconds != null && e.duration_seconds > 0 && (
                  <p className="text-slate-500">Duration: {Math.round(e.duration_seconds)}s</p>
                )}
                <p className="text-slate-400 text-[10px]">{e.rule_name || 'Geotab rule'}</p>
                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  e.severity === 'high' ? 'bg-red-100 text-red-700' :
                  e.severity === 'medium' ? 'bg-amber-100 text-amber-700' :
                  'bg-slate-100 text-slate-500'
                }`}>
                  {e.severity?.toUpperCase()} severity
                </span>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}

// Inline Clock icon for the popup (avoids extra import noise)
function Clock({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

export { EVENT_COLORS, EVENT_LABELS };