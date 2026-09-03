import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Route, Loader2, Clock, MapPin, TrendingDown, RefreshCw, AlertCircle,
  Timer, Calendar, User,
} from 'lucide-react';
import {
  reverseGeocodeFast, reverseGeocodeUpgrade, buildLabelFromParts,
  getCachedLabelSync, getCachedPartsSync,
} from '@/utils/reverseGeocode';
import TripDetailCard from './TripDetailCard';

const KM_TO_MI = 0.621371;
function kmToMi(km) { return (Number(km) || 0) * KM_TO_MI; }
function formatDuration(mins) {
  if (!mins) return '0m';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
function coordLabel(lat, lng) {
  if (lat == null || lng == null) return '—';
  return `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`;
}
function syncLabel(lat, lng) {
  if (lat == null || lng == null) return '—';
  return getCachedLabelSync(lat, lng) || coordLabel(lat, lng);
}
function toISODate(d) { return d.toISOString().slice(0, 10); }
function todayStr() { return toISODate(new Date()); }

const PRESETS = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: 'month', label: 'This Month' },
];

function applyPreset(id) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const to = toISODate(today);
  let from;
  if (id === 'today') from = to;
  else if (id === '7d') { const d = new Date(today); d.setDate(d.getDate() - 6); from = toISODate(d); }
  else if (id === '30d') { const d = new Date(today); d.setDate(d.getDate() - 29); from = toISODate(d); }
  else if (id === 'month') { const d = new Date(today.getFullYear(), today.getMonth(), 1); from = toISODate(d); }
  return { from, to };
}

function groupTripsByDay(trips) {
  const groups = {};
  for (const t of trips) {
    const key = new Date(t.start_time).toISOString().slice(0, 10);
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  }
  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, dayTrips]) => ({
      date, trips: dayTrips,
      distance: dayTrips.reduce((s, t) => s + (t.distance_km || 0), 0),
      duration: dayTrips.reduce((s, t) => s + (t.duration_minutes || 0), 0),
      idle: dayTrips.reduce((s, t) => s + (t.idle_minutes || 0), 0),
      stops: dayTrips.reduce((s, t) => s + (t.stop_count || 0), 0),
      tripCount: dayTrips.length,
    }));
}

/**
 * TripHistoryPanel — real From/To date pickers plus quick presets, day-grouped
 * rich trip cards, and a whole-range summary strip. Reuses the existing
 * getVehicleLocationHistory (geotab_history) backend and the progressive
 * reverse-geocoding pipeline.
 */
export default function TripHistoryPanel({ vehicle }) {
  const initial = applyPreset('7d');
  const [fromDate, setFromDate] = useState(initial.from);
  const [toDate, setToDate] = useState(initial.to);
  const [activePreset, setActivePreset] = useState('7d');
  const [expanded, setExpanded] = useState(null);

  const fromDateISO = useMemo(() => fromDate ? new Date(fromDate + 'T00:00:00').toISOString() : undefined, [fromDate]);
  const toDateISO = useMemo(() => toDate ? new Date(toDate + 'T23:59:59').toISOString() : undefined, [toDate]);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['geotab-trip-history-v2', vehicle?.id, fromDateISO, toDateISO],
    queryFn: async () => {
      const res = await base44.functions.invoke('getVehicleLocationHistory', {
        mode: 'geotab_history', vehicle_id: vehicle.id,
        from_date: fromDateISO, to_date: toDateISO, limit: 500,
      });
      return res?.data || res;
    },
    enabled: !!vehicle?.id && !!vehicle?.geotab_device_id && !!fromDateISO && !!toDateISO,
  });

  const trips = data?.trips || [];
  const breadcrumbs = data?.breadcrumbs || [];

  // Index of each trip in the flat trips array — used to track the expanded card.
  const indexById = useMemo(() => {
    const m = {};
    trips.forEach((t, i) => { m[t.trip_id] = i; });
    return m;
  }, [trips]);

  // Instant labels from persistent cache, then progressive geocoding.
  const initialGeocoded = useMemo(() => {
    const out = {};
    for (const t of trips) {
      out[t.trip_id] = {
        start_location: syncLabel(t.start_lat, t.start_lng),
        end_location: syncLabel(t.end_lat, t.end_lng),
        stops: (t.stops || []).map(s => ({ ...s, location: s.location || syncLabel(s.lat, s.lng) })),
      };
    }
    return out;
  }, [trips]);
  const [geocodedTrips, setGeocodedTrips] = useState(initialGeocoded);
  useEffect(() => { setGeocodedTrips(initialGeocoded); }, [initialGeocoded]);

  useEffect(() => {
    if (trips.length === 0) return;
    let cancelled = false;
    const needs = new Map();
    for (const t of trips) {
      for (const c of [{ lat: t.start_lat, lng: t.start_lng }, { lat: t.end_lat, lng: t.end_lng }]) {
        if (c.lat == null) continue;
        const key = `${Number(c.lat).toFixed(4)},${Number(c.lng).toFixed(4)}`;
        if (!getCachedPartsSync(c.lat, c.lng)?.road) needs.set(key, c);
      }
      for (const s of (t.stops || [])) {
        if (s.lat == null) continue;
        const key = `${Number(s.lat).toFixed(4)},${Number(s.lng).toFixed(4)}`;
        if (!getCachedPartsSync(s.lat, s.lng)?.road) needs.set(key, { lat: s.lat, lng: s.lng });
      }
    }
    if (needs.size === 0) return;
    const rebuild = (partsMap) => {
      const out = {};
      for (const t of trips) {
        const sKey = t.start_lat != null ? `${Number(t.start_lat).toFixed(4)},${Number(t.start_lng).toFixed(4)}` : null;
        const eKey = t.end_lat != null ? `${Number(t.end_lat).toFixed(4)},${Number(t.end_lng).toFixed(4)}` : null;
        out[t.trip_id] = {
          start_location: sKey && partsMap[sKey] ? (buildLabelFromParts(partsMap[sKey]) || coordLabel(t.start_lat, t.start_lng)) : syncLabel(t.start_lat, t.start_lng),
          end_location: eKey && partsMap[eKey] ? (buildLabelFromParts(partsMap[eKey]) || coordLabel(t.end_lat, t.end_lng)) : syncLabel(t.end_lat, t.end_lng),
          stops: (t.stops || []).map(s => {
            const key = s.lat != null ? `${Number(s.lat).toFixed(4)},${Number(s.lng).toFixed(4)}` : null;
            return { ...s, location: key && partsMap[key] ? (buildLabelFromParts(partsMap[key]) || coordLabel(s.lat, s.lng)) : (s.location || syncLabel(s.lat, s.lng)) };
          }),
        };
      }
      return out;
    };
    (async () => {
      const partsMap = {};
      await Promise.all([...needs.values()].map(async (c) => {
        if (cancelled) return;
        try {
          const parts = await reverseGeocodeFast(c.lat, c.lng);
          if (parts) {
            partsMap[`${Number(c.lat).toFixed(4)},${Number(c.lng).toFixed(4)}`] = parts;
            if (!cancelled) setGeocodedTrips(rebuild(partsMap));
          }
        } catch (_) {}
      }));
      if (cancelled) return;
      for (const c of needs.values()) {
        if (cancelled) return;
        const key = `${Number(c.lat).toFixed(4)},${Number(c.lng).toFixed(4)}`;
        if (partsMap[key]?.road) continue;
        try {
          const up = await reverseGeocodeUpgrade(c.lat, c.lng);
          if (up) { partsMap[key] = up; if (!cancelled) setGeocodedTrips(rebuild(partsMap)); }
        } catch (_) {}
      }
    })();
    return () => { cancelled = true; };
  }, [trips]);

  if (!vehicle?.geotab_device_id) {
    return (
      <div className="text-center py-10 bg-slate-50 rounded-xl">
        <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-400">No Geotab device linked to this vehicle.</p>
      </div>
    );
  }

  const totalDistance = data?.total_distance_km || 0;
  const totalDrive = trips.reduce((s, t) => s + (t.duration_minutes || 0), 0);
  const totalIdle = trips.reduce((s, t) => s + (t.idle_minutes || 0), 0);
  const totalStops = trips.reduce((s, t) => s + (t.stop_count || 0), 0);
  const driverName = vehicle?.geotab_driver_name || vehicle?.geotab_keeper_name || '';

  const handlePreset = (id) => {
    const { from, to } = applyPreset(id);
    setFromDate(from); setToDate(to); setActivePreset(id);
  };
  const handleFromChange = (v) => { setFromDate(v); setActivePreset(null); };
  const handleToChange = (v) => { setToDate(v); setActivePreset(null); };

  const dayGroups = groupTripsByDay(trips);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Route className="w-4 h-4 text-emerald-700" />
          <h3 className="text-sm font-bold text-slate-800">Trip History</h3>
          <span className="text-[10px] text-slate-400">Geotab · {vehicle.registration_number}</span>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input type="date" value={fromDate} max={toDate} onChange={e => handleFromChange(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:border-emerald-400" />
            <span className="text-slate-300 text-xs">→</span>
            <input type="date" value={toDate} min={fromDate} max={todayStr()} onChange={e => handleToChange(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:border-emerald-400" />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {PRESETS.map(p => (
              <button key={p.id} onClick={() => handlePreset(p.id)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${activePreset === p.id ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {p.label}
              </button>
            ))}
            <button onClick={() => refetch()} disabled={isFetching}
              className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition">
              {isFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" /> : <RefreshCw className="w-3.5 h-3.5 text-slate-500" />}
            </button>
          </div>
        </div>
      </div>

      {driverName && (
        <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          <User className="w-3.5 h-3.5 text-slate-400" /> Driver: <span className="font-semibold text-slate-700">{driverName}</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-10 bg-slate-50 rounded-xl">
          <Loader2 className="w-6 h-6 text-emerald-700 animate-spin" />
          <span className="ml-2 text-sm text-slate-500">Fetching trips from Geotab…</span>
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-sm text-rose-600">{error.message || 'Failed to fetch trip history'}</div>
      ) : trips.length === 0 ? (
        <div className="text-center py-10 bg-slate-50 rounded-xl">
          <Route className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-400">No trips recorded between {fromDate} and {toDate}.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 rounded-lg p-3 border border-cyan-200">
              <p className="text-[10px] uppercase text-cyan-600 font-semibold flex items-center gap-1"><Route className="w-3 h-3" /> Trips</p>
              <p className="text-xl font-bold text-cyan-700 tabular-nums mt-0.5">{trips.length}</p>
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg p-3 border border-emerald-200">
              <p className="text-[10px] uppercase text-emerald-600 font-semibold flex items-center gap-1"><TrendingDown className="w-3 h-3" /> Miles</p>
              <p className="text-xl font-bold text-emerald-700 tabular-nums mt-0.5">{kmToMi(totalDistance).toFixed(0)}</p>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border border-blue-200">
              <p className="text-[10px] uppercase text-blue-600 font-semibold flex items-center gap-1"><Clock className="w-3 h-3" /> Drive</p>
              <p className="text-xl font-bold text-blue-700 tabular-nums mt-0.5">{formatDuration(totalDrive)}</p>
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-3 border border-amber-200">
              <p className="text-[10px] uppercase text-amber-600 font-semibold flex items-center gap-1"><Timer className="w-3 h-3" /> Idle</p>
              <p className="text-xl font-bold text-amber-700 tabular-nums mt-0.5">{formatDuration(totalIdle)}</p>
            </div>
            <div className="bg-gradient-to-br from-violet-50 to-violet-100 rounded-lg p-3 border border-violet-200">
              <p className="text-[10px] uppercase text-violet-600 font-semibold flex items-center gap-1"><MapPin className="w-3 h-3" /> Stops</p>
              <p className="text-xl font-bold text-violet-700 tabular-nums mt-0.5">{totalStops}</p>
            </div>
          </div>

          <div className="space-y-3">
            {dayGroups.map(dg => {
              const dateObj = new Date(dg.date + 'T00:00:00');
              const isToday = dg.date === todayStr();
              const dayLabel = dateObj.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
              return (
                <div key={dg.date} className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-slate-50 to-white">
                    <Calendar className="w-4 h-4 text-slate-500" />
                    <span className="text-sm font-bold text-slate-800">{dayLabel}</span>
                    {isToday && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-100 text-cyan-700 font-bold">TODAY</span>}
                    <div className="ml-auto flex items-center gap-3 text-xs flex-shrink-0">
                      <span className="flex items-center gap-0.5 text-slate-500 font-semibold"><Route className="w-3 h-3" />{dg.tripCount}</span>
                      <span className="flex items-center gap-0.5 text-emerald-600 font-bold"><TrendingDown className="w-3 h-3" />{kmToMi(dg.distance).toFixed(1)}mi</span>
                      <span className="flex items-center gap-0.5 text-slate-500 font-semibold"><Clock className="w-3 h-3" />{formatDuration(dg.duration)}</span>
                      <span className="flex items-center gap-0.5 text-amber-600 font-semibold"><Timer className="w-3 h-3" />{formatDuration(dg.idle)}</span>
                      <span className="flex items-center gap-0.5 text-violet-600 font-semibold"><MapPin className="w-3 h-3" />{dg.stops}</span>
                    </div>
                  </div>
                  <div className="p-2 space-y-2 bg-white">
                    {dg.trips.map(trip => {
                      const geo = geocodedTrips[trip.trip_id];
                      const merged = geo ? { ...trip, start_location: geo.start_location, end_location: geo.end_location, stops: geo.stops } : trip;
                      const idx = indexById[trip.trip_id] ?? 0;
                      return (
                        <TripDetailCard key={trip.trip_id} trip={merged} breadcrumbs={breadcrumbs}
                          isExpanded={expanded === idx} onToggle={() => setExpanded(expanded === idx ? null : idx)} />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}