import React, { useState } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup } from 'react-leaflet';
import {
  ChevronDown, ChevronRight, MapPin, Navigation, Clock, Gauge, Activity, Timer,
  TrendingDown, ExternalLink, Circle, Flag, Square, Play,
} from 'lucide-react';
import RoutePlaybackScrubber from './RoutePlaybackScrubber';

const KM_TO_MI = 0.621371;
function kmToMi(km) { return (Number(km) || 0) * KM_TO_MI; }
function formatDuration(mins) {
  if (!mins) return '0m';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function coordLabel(lat, lng) {
  if (lat == null || lng == null) return '—';
  return `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`;
}

function TripRouteMap({ breadcrumbs, trip }) {
  const valid = (breadcrumbs || []).filter(b => b?.lat != null && b?.lng != null);
  const startCoord = trip.start_lat != null ? [trip.start_lat, trip.start_lng] : null;
  const endCoord = trip.end_lat != null ? [trip.end_lat, trip.end_lng] : null;
  const fallback = valid.length > 0 ? [valid[0].lat, valid[0].lng] : startCoord || endCoord;
  if (!fallback) return null;
  const path = valid.map(b => [b.lat, b.lng]);
  const center = path.length > 0 ? path[Math.floor(path.length / 2)] : fallback;
  return (
    <div style={{ height: '180px' }} className="rounded-lg overflow-hidden border border-slate-200">
      <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false} zoomControl={false}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {path.length >= 2 && <Polyline positions={path} pathOptions={{ color: '#2E5A1A', weight: 4, opacity: 0.85 }} />}
        {startCoord && <CircleMarker center={startCoord} pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 1 }} radius={6}><Popup>Start</Popup></CircleMarker>}
        {endCoord && <CircleMarker center={endCoord} pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 1 }} radius={6}><Popup>End</Popup></CircleMarker>}
        {(trip.stops || []).filter(s => s.lat != null).map((s, i) => (
          <CircleMarker key={i} center={[s.lat, s.lng]} pathOptions={{ color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.8 }} radius={4}>
            <Popup>Stop {i + 1}</Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}

function StopCard({ stop, index }) {
  const loc = stop.location || coordLabel(stop.lat, stop.lng);
  return (
    <div className="flex items-start gap-2.5 pl-4 py-1.5 relative">
      <div className="absolute left-[7px] top-0 bottom-0 w-px bg-amber-200" />
      <div className="w-3.5 h-3.5 rounded-full bg-amber-400 border-2 border-white shadow-sm flex-shrink-0 mt-0.5 z-10" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Square className="w-3 h-3 text-amber-500" />
          <span className="text-xs font-bold text-amber-700">Stop {index + 1}</span>
          <span className="text-[10px] text-slate-400">·</span>
          <span className="text-[10px] font-semibold text-slate-500">{formatDuration(stop.duration_minutes)}</span>
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <p className="text-xs text-slate-600 truncate flex-1">{loc}</p>
          {stop.lat != null && (
            <a href={`https://www.google.com/maps?q=${stop.lat},${stop.lng}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-blue-500 hover:text-blue-700 flex-shrink-0">
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
        <p className="text-[10px] text-slate-400 mt-0.5">{formatTime(stop.arrival_time)} → {formatTime(stop.departure_time)}</p>
      </div>
    </div>
  );
}

/**
 * TripDetailCard — enlarged, rich expandable trip card with full times, dates,
 * every stop, addresses, distance, duration, idle, max/avg speed, odometer,
 * a route mini-map, and a "Replay Route" button that opens the playback scrubber.
 */
export default function TripDetailCard({ trip, breadcrumbs, isExpanded, onToggle }) {
  const [showPlayback, setShowPlayback] = useState(false);

  const tripCrumbs = isExpanded ? (() => {
    const start = new Date(trip.start_time).getTime();
    const end = new Date(trip.end_time).getTime();
    return breadcrumbs.filter(b => {
      const t = new Date(b.timestamp).getTime();
      return t >= start - 60000 && t <= end + 60000;
    });
  })() : [];

  const distanceMi = kmToMi(trip.distance_km).toFixed(1);
  const isOvernight = new Date(trip.start_time).getHours() < 6;
  const startLoc = trip.start_location || coordLabel(trip.start_lat, trip.start_lng);
  const endLoc = trip.end_location || coordLabel(trip.end_lat, trip.end_lng);

  return (
    <div className={`bg-white border rounded-xl overflow-hidden transition ${isExpanded ? 'border-emerald-300 shadow-md' : 'border-slate-200 hover:border-slate-300'}`}>
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition text-left">
        {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-slate-700">
              {new Date(trip.start_time).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
            </span>
            <span className="text-xs text-slate-400">{formatTime(trip.start_time)} → {formatTime(trip.end_time)}</span>
            {isOvernight && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-600 font-bold">EARLY</span>}
          </div>
          <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
            <MapPin className="w-3 h-3 text-emerald-500 flex-shrink-0" />
            {trip.start_lat != null ? (
              <a href={`https://www.google.com/maps?q=${trip.start_lat},${trip.start_lng}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="truncate hover:text-blue-600 hover:underline">{startLoc}</a>
            ) : <span className="truncate">{startLoc}</span>}
            <Navigation className="w-2.5 h-2.5 text-slate-300 flex-shrink-0" />
            {trip.end_lat != null ? (
              <a href={`https://www.google.com/maps?q=${trip.end_lat},${trip.end_lng}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="truncate hover:text-blue-600 hover:underline">{endLoc}</a>
            ) : <span className="truncate">{endLoc}</span>}
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs flex-shrink-0">
          <span className="flex items-center gap-0.5 text-emerald-600 font-bold"><TrendingDown className="w-3.5 h-3.5" />{distanceMi}mi</span>
          <span className="flex items-center gap-0.5 text-slate-500"><Clock className="w-3.5 h-3.5" />{formatDuration(trip.duration_minutes)}</span>
          <span className="flex items-center gap-0.5 text-amber-600 font-semibold"><Timer className="w-3.5 h-3.5" />{formatDuration(trip.idle_minutes)}</span>
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 pt-1 bg-gradient-to-b from-slate-50/50 to-white space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-emerald-50 rounded-lg p-2.5 border border-emerald-100">
              <p className="text-[10px] uppercase text-emerald-600 font-semibold">Start</p>
              <p className="text-xs font-bold text-emerald-700">{formatDateTime(trip.start_time)}</p>
            </div>
            <div className="bg-rose-50 rounded-lg p-2.5 border border-rose-100">
              <p className="text-[10px] uppercase text-rose-600 font-semibold">End</p>
              <p className="text-xs font-bold text-rose-700">{formatDateTime(trip.end_time)}</p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <div className="bg-cyan-50 rounded-lg p-2 border border-cyan-100 text-center">
              <Gauge className="w-3.5 h-3.5 text-cyan-500 mx-auto mb-0.5" />
              <p className="text-[9px] uppercase text-cyan-500 font-semibold">Max</p>
              <p className="text-sm font-bold text-cyan-700 tabular-nums">{Math.round(kmToMi(trip.max_speed_kph))} <span className="text-[9px] font-normal">mph</span></p>
            </div>
            <div className="bg-violet-50 rounded-lg p-2 border border-violet-100 text-center">
              <Activity className="w-3.5 h-3.5 text-violet-500 mx-auto mb-0.5" />
              <p className="text-[9px] uppercase text-violet-500 font-semibold">Avg</p>
              <p className="text-sm font-bold text-violet-700 tabular-nums">{Math.round(kmToMi(trip.average_speed_kph || 0))} <span className="text-[9px] font-normal">mph</span></p>
            </div>
            <div className="bg-amber-50 rounded-lg p-2 border border-amber-100 text-center">
              <Timer className="w-3.5 h-3.5 text-amber-500 mx-auto mb-0.5" />
              <p className="text-[9px] uppercase text-amber-500 font-semibold">Idle</p>
              <p className="text-sm font-bold text-amber-700 tabular-nums">{formatDuration(trip.idle_minutes)}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-2 border border-slate-200 text-center">
              <Gauge className="w-3.5 h-3.5 text-slate-400 mx-auto mb-0.5" />
              <p className="text-[9px] uppercase text-slate-400 font-semibold">Odo</p>
              <p className="text-sm font-bold text-slate-600 tabular-nums">{Math.round(kmToMi(trip.odometer_km || 0)).toLocaleString()} <span className="text-[9px] font-normal">mi</span></p>
            </div>
          </div>

          {tripCrumbs.length > 0 && <TripRouteMap breadcrumbs={tripCrumbs} trip={trip} />}

          {tripCrumbs.length >= 2 && (
            <button onClick={(e) => { e.stopPropagation(); setShowPlayback(s => !s); }}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition">
              <Play className="w-3.5 h-3.5" /> {showPlayback ? 'Hide Playback' : 'Replay Route'}
            </button>
          )}
          {showPlayback && tripCrumbs.length >= 2 && (
            <RoutePlaybackScrubber breadcrumbs={tripCrumbs} trip={trip} onClose={() => setShowPlayback(false)} />
          )}

          <div className="space-y-0">
            <div className="flex items-start gap-2.5 py-1.5 relative">
              <div className="w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-white shadow-sm flex-shrink-0 mt-0.5 z-10" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5"><Circle className="w-3 h-3 text-emerald-500" /><span className="text-xs font-bold text-emerald-700">Start</span></div>
                <div className="flex items-center gap-1 mt-0.5">
                  <p className="text-xs text-slate-600 truncate flex-1">{startLoc}</p>
                  {trip.start_lat != null && (
                    <a href={`https://www.google.com/maps?q=${trip.start_lat},${trip.start_lng}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-blue-500 hover:text-blue-700 flex-shrink-0"><ExternalLink className="w-3 h-3" /></a>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">{formatDateTime(trip.start_time)}</p>
              </div>
            </div>
            {(trip.stops || []).map((stop, i) => <StopCard key={i} stop={stop} index={i} />)}
            <div className="flex items-start gap-2.5 py-1.5">
              <div className="w-3.5 h-3.5 rounded-full bg-rose-400 border-2 border-white shadow-sm flex-shrink-0 mt-0.5 z-10" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5"><Flag className="w-3 h-3 text-rose-500" /><span className="text-xs font-bold text-rose-700">End</span></div>
                <div className="flex items-center gap-1 mt-0.5">
                  <p className="text-xs text-slate-600 truncate flex-1">{endLoc}</p>
                  {trip.end_lat != null && (
                    <a href={`https://www.google.com/maps?q=${trip.end_lat},${trip.end_lng}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-blue-500 hover:text-blue-700 flex-shrink-0"><ExternalLink className="w-3 h-3" /></a>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">{formatDateTime(trip.end_time)}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}