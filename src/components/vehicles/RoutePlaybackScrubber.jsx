import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup } from 'react-leaflet';
import { Play, Pause, FastForward, Rewind, X, Clock, Gauge } from 'lucide-react';

const KM_TO_MI = 0.621371;
function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/**
 * RoutePlaybackScrubber — replays a trip's breadcrumb path point-by-point on a
 * map with play/pause, speed multiplier (1x/2x/4x) and a draggable timeline.
 * Purely client-side: animates the breadcrumb array already returned by
 * getVehicleLocationHistory — no extra backend call.
 */
export default function RoutePlaybackScrubber({ breadcrumbs, trip, onClose }) {
  const valid = (breadcrumbs || []).filter(b => b?.lat != null && b?.lng != null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const timerRef = useRef(null);

  const path = valid.map(b => [b.lat, b.lng]);
  const center = path.length ? path[Math.floor(path.length / 2)] : [51.5, -0.1];
  const current = valid[index];
  const currentPos = current ? [current.lat, current.lng] : null;

  // Playback loop — advance one breadcrumb per tick; tick interval shrinks
  // with the speed multiplier.
  useEffect(() => {
    if (!playing) return;
    timerRef.current = setInterval(() => {
      setIndex(i => {
        if (i >= valid.length - 1) { setPlaying(false); return i; }
        return i + 1;
      });
    }, 700 / speed);
    return () => clearInterval(timerRef.current);
  }, [playing, speed, valid.length]);

  // Reset when the trip changes.
  useEffect(() => { setIndex(0); setPlaying(false); }, [trip?.trip_id]);

  if (valid.length < 2) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
        <p className="text-xs text-slate-400">Not enough breadcrumb points to replay this trip.</p>
        <button onClick={onClose} className="mt-2 text-xs text-emerald-700 font-semibold">Close</button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-emerald-50 border-b border-emerald-100">
        <div className="flex items-center gap-2">
          <FastForward className="w-4 h-4 text-emerald-700" />
          <span className="text-xs font-bold text-emerald-800">Route Playback</span>
          <span className="text-[10px] text-emerald-600">{index + 1} / {valid.length} points</span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-emerald-100 rounded-lg transition">
          <X className="w-4 h-4 text-emerald-700" />
        </button>
      </div>

      <div style={{ height: '220px' }} className="relative">
        <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false} zoomControl={false}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {path.length >= 2 && <Polyline positions={path} pathOptions={{ color: '#2E5A1A', weight: 4, opacity: 0.6 }} />}
          {path.length >= 2 && index > 0 && (
            <Polyline positions={path.slice(0, index + 1)} pathOptions={{ color: '#8DC63F', weight: 5, opacity: 0.95 }} />
          )}
          <CircleMarker center={path[0]} pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 1 }} radius={6}><Popup>Start</Popup></CircleMarker>
          <CircleMarker center={path[path.length - 1]} pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 1 }} radius={6}><Popup>End</Popup></CircleMarker>
          {(trip?.stops || []).filter(s => s.lat != null).map((s, i) => (
            <CircleMarker key={i} center={[s.lat, s.lng]} pathOptions={{ color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.8 }} radius={4}>
              <Popup>Stop {i + 1}</Popup>
            </CircleMarker>
          ))}
          {currentPos && (
            <CircleMarker center={currentPos} pathOptions={{ color: '#1d4ed8', fillColor: '#1d4ed8', fillOpacity: 1 }} radius={8}>
              <Popup>Current position</Popup>
            </CircleMarker>
          )}
        </MapContainer>
      </div>

      <div className="px-3 py-2.5 space-y-2 bg-white">
        <input type="range" min={0} max={valid.length - 1} value={index}
          onChange={e => { setIndex(Number(e.target.value)); setPlaying(false); }}
          className="w-full accent-emerald-600" />
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button onClick={() => { setIndex(0); setPlaying(false); }} className="p-1.5 rounded-lg hover:bg-slate-100 transition" title="Restart">
              <Rewind className="w-4 h-4 text-slate-600" />
            </button>
            <button onClick={() => setPlaying(p => !p)} className="p-2 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition">
              {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <div className="flex bg-slate-100 rounded-lg p-0.5">
              {[1, 2, 4].map(s => (
                <button key={s} onClick={() => setSpeed(s)}
                  className={`px-2 py-1 text-[11px] font-bold rounded-md transition ${speed === s ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}>
                  {s}x
                </button>
              ))}
            </div>
          </div>
          <div className="text-right text-[11px] text-slate-500">
            <div className="flex items-center gap-1 justify-end"><Clock className="w-3 h-3" /> {current ? formatTime(current.timestamp) : '—'}</div>
            {current?.speed_kph != null && (
              <div className="flex items-center gap-1 justify-end"><Gauge className="w-3 h-3" /> {Math.round(current.speed_kph * KM_TO_MI)} mph</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}