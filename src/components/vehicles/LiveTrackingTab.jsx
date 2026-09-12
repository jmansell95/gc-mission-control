import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline, Marker, Tooltip, useMap } from 'react-leaflet';
import {
  Satellite, Loader2, RefreshCw, Navigation, Gauge, Clock, Car, Filter, Zap,
  MapPin, Calendar, Route, GitCompare, ShieldAlert, ChevronLeft, X,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import TripPlaybackScrubber from './TripPlaybackScrubber';
import SafetyEventsLayer from './SafetyEventsLayer';
import VehicleLiveDialog from './VehicleLiveDialog';
import RouteComparisonDialog from './RouteComparisonDialog';

const UK_CENTER = [52.3, -1.5];
const KM_TO_MI = 0.621371;

// ── Map helper: fit bounds when data changes ──
function MapBoundsFitter({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points || points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 14);
    } else {
      const bounds = points.filter(p => p[0] != null && p[1] != null);
      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      }
    }
  }, [points, map]);
  return null;
}

// ── Vehicle marker (live mode) ──
function VehicleMarker({ vehicle, onClick }) {
  const pos = [vehicle.lat, vehicle.lng];
  if (vehicle.lat == null || vehicle.lng == null) return null;
  const colour = vehicle.ignition_on ? '#2E5A1A' : '#94a3b8';
  const heading = vehicle.heading || 0;
  const arrowSvg = vehicle.ignition_on
    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="white" style="transform:rotate(${heading}deg);transition:transform 0.3s"><path d="M12 2L4 22l8-6 8 6z"/></svg>`
    : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3" fill="white"/></svg>`;
  const icon = window.L?.divIcon({
    html: `<div style="position:relative">
      <div style="background:${colour};width:32px;height:32px;border-radius:50%;border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center">${arrowSvg}</div>
      ${vehicle.ignition_on ? '<div style="position:absolute;inset:-6px;border-radius:50%;border:2px solid ' + colour + ';opacity:0.35;animation:pulse 2s infinite"></div>' : ''}
      <div style="position:absolute;top:-2px;left:50%;transform:translateX(-50%);background:${vehicle.ignition_on ? '#2E5A1A' : '#64748b'};color:white;font-size:9px;font-weight:700;padding:1px 5px;border-radius:4px;white-space:nowrap;font-family:monospace">${vehicle.registration_number || ''}</div>
    </div>`,
    className: 'hazard-map-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
  if (!icon) return <Marker position={pos}><Popup>{vehicle.registration_number}</Popup></Marker>;
  return (
    <Marker position={pos} icon={icon} eventHandlers={{ click: () => onClick(vehicle) }}>
      <Popup>
        <div className="text-xs space-y-1">
          <p className="font-bold text-sm font-mono">{vehicle.registration_number}</p>
          <p className="text-slate-600">{vehicle.vehicle_name}</p>
          <p className="flex items-center gap-1"><Navigation className="w-3 h-3" /> {vehicle.speed_kph} km/h {vehicle.ignition_on ? '🟢 Engine On' : '⚪ Engine Off'}</p>
          {vehicle.driver_name && <p>Driver: {vehicle.driver_name}</p>}
          <p className="text-slate-400">{new Date(vehicle.timestamp).toLocaleString('en-GB')}</p>
        </div>
      </Popup>
    </Marker>
  );
}

/**
 * LiveTrackingTab — the upgraded Live Tracking view for the Fleet Hub.
 *
 * Features:
 * - Large interactive map (pan/zoom/scroll)
 * - Live vehicle markers (click for status popup)
 * - Historical date replay (date picker)
 * - Trip playback scrubber (play/pause/speed)
 * - Safety event overlays (speeding, harsh braking, etc.)
 * - Route comparison (actual vs Google optimal vs optimized stops)
 */
export default function LiveTrackingTab({ initialVehicleId }) {
  const [selectedVehicle, setSelectedVehicle] = useState(null); // live vehicle object
  const [selectedVehicleId, setSelectedVehicleId] = useState(null); // for history queries
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedTripIndex, setSelectedTripIndex] = useState(0);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [showEvents, setShowEvents] = useState(true);
  const [filterMoving, setFilterMoving] = useState('all');
  const [dialogVehicle, setDialogVehicle] = useState(null);
  const [routeComparisonTrip, setRouteComparisonTrip] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);

  // ── Live locations ──
  const { data: liveData, isLoading: liveLoading, refetch: refetchLive, dataUpdatedAt, isFetching } = useQuery({
    queryKey: ['geotab-live-locations'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getVehicleLocationHistory', { mode: 'live_fast', limit: 500 });
      return res?.data ?? res;
    },
    refetchInterval: 20000,
    staleTime: 10000,
  });

  const allVehicles = liveData?.vehicles || [];
  const liveVehicles = useMemo(() => {
    if (filterMoving === 'moving') return allVehicles.filter(v => v.ignition_on);
    if (filterMoving === 'stopped') return allVehicles.filter(v => !v.ignition_on);
    return allVehicles;
  }, [allVehicles, filterMoving]);

  // ── Vehicle history (trips + breadcrumbs for selected vehicle/date) ──
  const historyQueryKey = selectedVehicleId
    ? ['vehicle-history', selectedVehicleId, selectedDate]
    : null;

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: historyQueryKey || ['vehicle-history-none'],
    queryFn: async () => {
      if (!selectedVehicleId) return null;
      const dayStart = new Date(selectedDate + 'T00:00:00');
      const dayEnd = new Date(selectedDate + 'T23:59:59');
      const res = await base44.functions.invoke('getVehicleLocationHistory', {
        mode: 'geotab_history',
        vehicle_id: selectedVehicleId,
        from_date: dayStart.toISOString(),
        to_date: dayEnd.toISOString(),
        limit: 500,
      });
      return res?.data ?? res;
    },
    enabled: !!selectedVehicleId,
  });

  const trips = historyData?.trips || [];
  const allBreadcrumbs = historyData?.breadcrumbs || [];

  // ── Safety events for selected vehicle/date ──
  const { data: safetyData } = useQuery({
    queryKey: ['vehicle-safety-events', selectedVehicleId, selectedDate],
    queryFn: async () => {
      if (!selectedVehicleId) return null;
      const dayStart = new Date(selectedDate + 'T00:00:00');
      const dayEnd = new Date(selectedDate + 'T23:59:59');
      const res = await base44.functions.invoke('getVehicleSafetyEvents', {
        vehicle_id: selectedVehicleId,
        from_date: dayStart.toISOString(),
        to_date: dayEnd.toISOString(),
        limit: 2000,
      });
      return res?.data ?? res;
    },
    enabled: !!selectedVehicleId && showEvents,
  });

  const safetyEvents = safetyData?.events || [];

  // ── Breadcrumbs for the selected trip ──
  const selectedTrip = trips[selectedTripIndex] || null;
  const tripBreadcrumbs = useMemo(() => {
    if (!selectedTrip || allBreadcrumbs.length === 0) return [];
    const tripStart = new Date(selectedTrip.start_time).getTime();
    const tripEnd = new Date(selectedTrip.end_time).getTime();
    return allBreadcrumbs.filter(b => {
      const t = new Date(b.timestamp).getTime();
      return t >= tripStart && t <= tripEnd;
    });
  }, [selectedTrip, allBreadcrumbs]);

  // Reset playback when trip changes
  useEffect(() => {
    setPlaybackIndex(0);
  }, [selectedTripIndex, selectedVehicleId, selectedDate]);

  // Auto-open the live dialog for a vehicle passed in from the rota's live
  // driver badge (?vehicle=<id>). Fires once when the live data has loaded
  // and the matching vehicle is found.
  useEffect(() => {
    if (!initialVehicleId || dialogVehicle || allVehicles.length === 0) return;
    const match = allVehicles.find(v => v.vehicle_id === initialVehicleId || v.id === initialVehicleId);
    if (match) setDialogVehicle(match);
  }, [initialVehicleId, allVehicles, dialogVehicle]);

  // ── Map data ──
  const isLiveMode = !selectedVehicleId;
  const mapMarkers = isLiveMode ? liveVehicles : [];
  const breadcrumbPath = useMemo(
    () => tripBreadcrumbs.filter(b => b.lat && b.lng).map(b => [b.lat, b.lng]),
    [tripBreadcrumbs]
  );

  // Playback marker position
  const playbackPos = tripBreadcrumbs.length > 0
    ? [tripBreadcrumbs[Math.min(playbackIndex, tripBreadcrumbs.length - 1)]?.lat, tripBreadcrumbs[Math.min(playbackIndex, tripBreadcrumbs.length - 1)]?.lng]
    : null;

  // Points for bounds fitting
  const boundsPoints = useMemo(() => {
    if (isLiveMode) {
      return liveVehicles.filter(v => v.lat && v.lng).map(v => [v.lat, v.lng]);
    }
    return breadcrumbPath;
  }, [isLiveMode, liveVehicles, breadcrumbPath]);

  // ── Handlers ──
  const handleVehicleClick = (vehicle) => {
    setDialogVehicle(vehicle);
  };

  const handleSelectRouteHistory = (vehicle) => {
    setSelectedVehicleId(vehicle.vehicle_id);
    setSelectedVehicle(vehicle);
    setSelectedTripIndex(0);
  };

  const handleBackToLive = () => {
    setSelectedVehicleId(null);
    setSelectedVehicle(null);
    setSelectedTripIndex(0);
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await base44.functions.invoke('syncGeotabFleet', { action: 'sync' });
      const d = res?.data || res;
      setSyncMsg({ ok: !!d.ok, text: d.message || d.error || 'Done' });
      refetchLive();
    } catch (e) {
      setSyncMsg({ ok: false, text: e.message || 'Sync failed' });
    }
    setSyncing(false);
  };

  const handleCompareRoutes = () => {
    if (!selectedTrip || tripBreadcrumbs.length < 2) return;
    const startBc = tripBreadcrumbs[0];
    const endBc = tripBreadcrumbs[tripBreadcrumbs.length - 1];
    const vehicle = allVehicles.find(v => v.vehicle_id === selectedVehicleId) || selectedVehicle;
    setRouteComparisonTrip({
      start_lat: startBc.lat,
      start_lng: startBc.lng,
      end_lat: endBc.lat,
      end_lng: endBc.lng,
      driver_staff_id: vehicle?.assigned_staff_id || null,
      date: selectedDate,
      vehicle_id: selectedVehicleId,
      actual_distance_km: selectedTrip.distance_km || 0,
      actual_duration_min: selectedTrip.duration_minutes || 0,
    });
  };

  const trackedCount = allVehicles.length;
  const movingCount = allVehicles.filter(v => v.ignition_on).length;
  const stoppedCount = trackedCount - movingCount;

  return (
    <div className="space-y-3">
      {/* ── Controls bar ── */}
      <div className="hub-glass rounded-2xl p-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2.5 flex-1 min-w-[200px]">
          <div className="w-10 h-10 rounded-xl stat-gradient-brand flex items-center justify-center icon-tile-glow">
            <Satellite className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">Live Vehicle Map</p>
            <p className="text-[11px] text-slate-500">{trackedCount} tracked · {movingCount} moving · {stoppedCount} stopped</p>
            <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${isFetching ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`} />
              {isFetching ? 'Syncing…' : `Synced ${dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}`}
              <span className="text-slate-300">·</span>
              <span className="text-primary font-semibold">Auto 20s</span>
            </p>
          </div>
        </div>

        {/* Filter pills (live mode only) */}
        {isLiveMode && (
          <div className="flex p-1 bg-slate-100 rounded-lg gap-0.5">
            {[
              { val: 'all', label: 'All', count: trackedCount },
              { val: 'moving', label: 'Moving', count: movingCount },
              { val: 'stopped', label: 'Stopped', count: stoppedCount },
            ].map(opt => (
              <button key={opt.val} onClick={() => setFilterMoving(opt.val)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${filterMoving === opt.val ? 'bg-white text-primary shadow-sm' : 'text-slate-500'}`}>
                {opt.val === 'moving' && <Zap className="w-3 h-3" />}
                {opt.val === 'stopped' && <Clock className="w-3 h-3" />}
                {opt.label}
                <span className={`text-[10px] tabular-nums ${filterMoving === opt.val ? 'text-[#8DC63F]' : 'text-slate-400'}`}>{opt.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Date picker (history mode) */}
        {!isLiveMode && (
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </div>
        )}

        {/* Safety events toggle */}
        {!isLiveMode && (
          <button
            onClick={() => setShowEvents(s => !s)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition ${showEvents ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-white border border-slate-200 text-slate-500'}`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            Events {safetyEvents.length > 0 && `(${safetyEvents.length})`}
          </button>
        )}

        {/* Route comparison */}
        {!isLiveMode && selectedTrip && tripBreadcrumbs.length >= 2 && (
          <button
            onClick={handleCompareRoutes}
            className="flex items-center gap-1.5 px-3 py-2 command-gradient text-white rounded-lg text-xs font-bold hover:opacity-90 transition"
          >
            <GitCompare className="w-3.5 h-3.5" /> Compare Routes
          </button>
        )}

        {/* Back to live */}
        {!isLiveMode && (
          <button onClick={handleBackToLive}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition">
            <ChevronLeft className="w-3.5 h-3.5" /> Live
          </button>
        )}

        <button onClick={handleSync} disabled={syncing}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary/90 disabled:opacity-50 transition">
          {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Sync
        </button>
        <button onClick={() => refetchLive()}
          className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {syncMsg && (
        <div className={`rounded-lg px-3 py-2 text-xs ${syncMsg.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
          {syncMsg.text}
        </div>
      )}

      {/* ── Split-pane: map + sidebar ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Map */}
        <div className="lg:col-span-2 hub-glass rounded-2xl overflow-hidden">
          {liveLoading && isLiveMode ? (
            <div className="flex flex-col items-center justify-center" style={{ height: 600 }}>
              <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
              <p className="text-sm text-slate-500">Loading live vehicle locations…</p>
            </div>
          ) : trackedCount === 0 && isLiveMode ? (
            <div className="flex flex-col items-center justify-center" style={{ height: 600 }}>
              <MapPin className="w-10 h-10 text-slate-300 mb-2" />
              <p className="text-sm font-semibold text-slate-700">No location data yet</p>
              <p className="text-xs text-slate-400 mt-1">Sync from Geotab to populate the live map.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 bg-slate-50/80">
                <Satellite className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold text-slate-800">
                  {isLiveMode ? 'Live Fleet Map' : `Route: ${selectedVehicle?.registration_number || ''}`}
                </h3>
                {!isLiveMode && selectedTrip && (
                  <span className="ml-auto text-[11px] text-slate-500 flex items-center gap-1">
                    <Route className="w-3 h-3" />
                    {(selectedTrip.distance_km || 0).toFixed(1)} km · {selectedTrip.duration_minutes || 0} min
                  </span>
                )}
                {isLiveMode && (
                  <span className="ml-auto text-xs text-slate-400">{liveVehicles.length} vehicles</span>
                )}
              </div>
              <div style={{ height: 560 }} className="relative rounded-b-2xl">
                <MapContainer center={UK_CENTER} zoom={6} style={{ height: '100%', width: '100%' }} scrollWheelZoom zoomControl dragging>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
                  <MapBoundsFitter points={boundsPoints} />
                  {/* Live vehicle markers */}
                  {isLiveMode && mapMarkers.map(v => (
                    <VehicleMarker key={v.vehicle_id || v.registration_number} vehicle={v} onClick={handleVehicleClick} />
                  ))}
                  {/* Breadcrumb trail */}
                  {!isLiveMode && breadcrumbPath.length > 1 && (
                    <Polyline positions={breadcrumbPath} pathOptions={{ color: '#2E5A1A', weight: 4, opacity: 0.7 }} />
                  )}
                  {/* Start marker */}
                  {!isLiveMode && breadcrumbPath.length > 0 && (
                    <CircleMarker center={breadcrumbPath[0]} radius={8} pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.9, weight: 3 }}>
                      <Popup><div className="text-xs font-bold text-emerald-700">Trip Start</div></Popup>
                    </CircleMarker>
                  )}
                  {/* End marker */}
                  {!isLiveMode && breadcrumbPath.length > 1 && (
                    <CircleMarker center={breadcrumbPath[breadcrumbPath.length - 1]} radius={8} pathOptions={{ color: '#f43f5e', fillColor: '#f43f5e', fillOpacity: 0.9, weight: 3 }}>
                      <Popup><div className="text-xs font-bold text-rose-700">Trip End</div></Popup>
                    </CircleMarker>
                  )}
                  {/* Playback marker */}
                  {!isLiveMode && playbackPos && playbackPos[0] != null && (() => {
                    const icon = window.L?.divIcon({
                      html: `<div style="background:#2E5A1A;width:28px;height:28px;border-radius:50%;border:3px solid white;box-shadow:0 2px 12px rgba(46,90,26,0.5);display:flex;align-items:center;justify-content:center">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="12" r="6"/></svg>
                      </div>
                      <div style="position:absolute;inset:-4px;border-radius:50%;border:2px solid #2E5A1A;opacity:0.3;animation:pulse 2s infinite"></div>`,
                      className: 'hazard-map-marker',
                      iconSize: [28, 28],
                      iconAnchor: [14, 14],
                    });
                    return icon ? <Marker position={playbackPos} icon={icon} /> : null;
                  })()}
                  {/* Safety events overlay */}
                  {!isLiveMode && showEvents && <SafetyEventsLayer events={safetyEvents} />}
                </MapContainer>
                {/* ── Map legend (vehicle vs staff) ── */}
                {isLiveMode && (
                  <div className="absolute bottom-3 left-3 z-[1000] bg-white/95 backdrop-blur rounded-lg shadow-lg border border-slate-200 px-3 py-2 text-[10px] space-y-1 pointer-events-none">
                    <p className="font-bold text-slate-700 text-[11px] mb-1">Legend</p>
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded-full bg-primary border-2 border-white flex items-center justify-center">
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="white"><path d="M3 6h13v9H3z"/><path d="M16 9h4l3 3v3h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>
                      </div>
                      <span className="text-slate-600">Vehicle (engine on)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded-full bg-slate-400 border-2 border-white" />
                      <span className="text-slate-600">Vehicle (engine off)</span>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-3">
          {isLiveMode ? (
            /* Vehicle list (live mode) */
            <div className="hub-glass rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5"><Car className="w-4 h-4 text-primary" /> Vehicles ({liveVehicles.length})</p>
                <span className="text-[10px] text-slate-400 flex items-center gap-1"><Filter className="w-3 h-3" /> {filterMoving}</span>
              </div>
              <div className="max-h-[540px] overflow-y-auto divide-y divide-slate-50">
                {liveVehicles.map(v => (
                  <button key={v.vehicle_id || v.registration_number}
                    onClick={() => handleVehicleClick(v)}
                    className="w-full text-left px-4 py-3 hover:bg-slate-50 transition">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-mono font-bold text-sm text-slate-900 truncate">{v.registration_number}</p>
                        <p className="text-[11px] text-slate-500 truncate">{v.vehicle_name}</p>
                      </div>
                      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${v.ignition_on ? 'bg-[#8DC63F] pulse-ring' : 'bg-slate-300'}`} />
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-400">
                      <span className="flex items-center gap-0.5"><Gauge className="w-3 h-3" /> {v.speed_kph} km/h</span>
                      <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" /> {v.timestamp ? new Date(v.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                      {v.driver_name && <span className="flex items-center gap-0.5 text-blue-500 truncate">{v.driver_name}</span>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Trip list + playback (history mode) */}
              {historyLoading ? (
                <div className="hub-glass rounded-2xl p-8 flex flex-col items-center">
                  <Loader2 className="w-6 h-6 text-primary animate-spin mb-2" />
                  <p className="text-xs text-slate-500">Loading trip history…</p>
                </div>
              ) : trips.length === 0 ? (
                <div className="hub-glass rounded-2xl p-8 text-center">
                  <Route className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">No trips recorded for {selectedDate}</p>
                  <p className="text-xs text-slate-400 mt-1">Try selecting a different date.</p>
                </div>
              ) : (
                <>
                  {/* Trip list */}
                  <div className="hub-glass rounded-2xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100">
                      <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5"><Route className="w-4 h-4 text-primary" /> Trips ({trips.length})</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{selectedDate}</p>
                    </div>
                    <div className="max-h-[240px] overflow-y-auto divide-y divide-slate-50">
                      {trips.map((t, i) => (
                        <button key={i}
                          onClick={() => setSelectedTripIndex(i)}
                          className={`w-full text-left px-4 py-2.5 transition ${selectedTripIndex === i ? 'bg-primary/5 border-l-2 border-primary' : 'hover:bg-slate-50'}`}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-700 tabular-nums">
                                {new Date(t.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                → {new Date(t.end_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                              <p className="text-[10px] text-slate-400">{(t.distance_km || 0).toFixed(1)} km · {t.duration_minutes || 0} min</p>
                            </div>
                            {selectedTripIndex === i && <span className="w-2 h-2 rounded-full bg-primary" />}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Playback scrubber */}
                  {tripBreadcrumbs.length > 1 && (
                    <TripPlaybackScrubber
                      breadcrumbs={tripBreadcrumbs}
                      currentIndex={playbackIndex}
                      onIndexChange={setPlaybackIndex}
                    />
                  )}

                  {/* Safety events summary */}
                  {showEvents && safetyEvents.length > 0 && (
                    <div className="hub-glass rounded-2xl p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                        <h4 className="text-xs font-bold text-slate-800">Safety Events ({safetyEvents.length})</h4>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { type: 'speeding', label: 'Speeding', color: 'text-rose-600 bg-rose-50' },
                          { type: 'harsh_braking', label: 'Harsh Braking', color: 'text-amber-600 bg-amber-50' },
                          { type: 'harsh_accel', label: 'Harsh Accel', color: 'text-orange-600 bg-orange-50' },
                          { type: 'harsh_cornering', label: 'Harsh Corner', color: 'text-violet-600 bg-violet-50' },
                        ].map(e => {
                          const count = safetyEvents.filter(ev => ev.violation_type === e.type).length;
                          if (count === 0) return null;
                          return (
                            <div key={e.type} className={`rounded-lg px-2 py-1.5 text-[10px] font-bold ${e.color}`}>
                              {e.label}: {count}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Dialogs ── */}
      <VehicleLiveDialog
        vehicle={dialogVehicle}
        onClose={() => setDialogVehicle(null)}
        onSelectRoute={handleSelectRouteHistory}
      />
      <RouteComparisonDialog
        trip={routeComparisonTrip}
        breadcrumbs={tripBreadcrumbs}
        onClose={() => setRouteComparisonTrip(null)}
      />
    </div>
  );
}