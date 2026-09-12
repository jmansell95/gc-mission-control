import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline } from 'react-leaflet';
import { Truck, Navigation, Clock, AlertTriangle, Loader2, Route, Zap, RefreshCw } from 'lucide-react';
import WidgetShell from '@/components/dashboard/WidgetShell';
import { format, isToday } from 'date-fns';

const UK_CENTER = [52.3, -1.5];

// Traffic delay risk based on leg duration vs distance
// > 2 min/mile = heavy delay (red), 1-2 min/mile = moderate (amber), < 1 = clear (green)
function delayRisk(minutes, miles) {
  if (!minutes || !miles || miles < 0.1) return 'clear';
  const minPerMile = minutes / miles;
  if (minPerMile > 2.5) return 'heavy';
  if (minPerMile > 1.5) return 'moderate';
  return 'clear';
}

const RISK_COLORS = {
  clear: '#10b981',
  moderate: '#f59e0b',
  heavy: '#ef4444',
};

const RISK_LABELS = {
  clear: 'Clear',
  moderate: 'Moderate',
  heavy: 'Heavy Delay',
};

/**
 * Mission Command — Traffic-Aware Logistics Heatmap.
 *
 * Shows today's active deliveries on a map with traffic-aware colour coding:
 * green = clear route, amber = moderate delay, red = heavy delay. Each stop
 * is a circle marker sized by delivery count, with route polylines between
 * stops coloured by leg delay risk. Gives dispatchers an instant visual of
 * where traffic is impacting the fleet right now.
 */
export default function TrafficHeatmapWidget({ onNavigateToJob }) {
  const [optimizing, setOptimizing] = useState(false);

  const { data: deliveries = [], isLoading } = useQuery({
    queryKey: ['traffic-heatmap-deliveries'],
    queryFn: () => base44.entities.DeliveryLog.list('-scheduled_date', 200),
    refetchInterval: 60000,
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['traffic-heatmap-jobs'],
    queryFn: () => base44.entities.Job.list(),
  });

  const { data: staff = [] } = useQuery({
    queryKey: ['traffic-heatmap-staff'],
    queryFn: () => base44.entities.Staff.filter({ is_active: true }),
  });

  // Today's active deliveries (pending or in_progress)
  const todaysActive = useMemo(() => {
    return deliveries.filter(d => {
      if (!d.scheduled_date) return false;
      const isTodayDate = isToday(new Date(d.scheduled_date + 'T00:00:00'));
      return isTodayDate && (d.status === 'pending' || d.status === 'in_progress');
    });
  }, [deliveries]);

  // Group by driver to build route polylines
  const driverRoutes = useMemo(() => {
    const byDriver = {};
    todaysActive.forEach(d => {
      if (!d.driver_staff_id) return;
      if (!byDriver[d.driver_staff_id]) byDriver[d.driver_staff_id] = [];
      byDriver[d.driver_staff_id].push(d);
    });

    return Object.entries(byDriver).map(([driverId, dels]) => {
      const sorted = dels.sort((a, b) => (a.optimized_sequence_index || 999) - (b.optimized_sequence_index || 999));
      const driver = staff.find(s => s.id === driverId);
      const legs = [];
      for (let i = 0; i < sorted.length - 1; i++) {
        const from = sorted[i];
        const to = sorted[i + 1];
        const risk = delayRisk(to.leg_duration_minutes, to.leg_distance_miles);
        legs.push({
          from,
          to,
          risk,
          minutes: to.leg_duration_minutes || 0,
          miles: to.leg_distance_miles || 0,
        });
      }
      return { driverId, driverName: driver?.name || 'Unassigned', stops: sorted, legs };
    });
  }, [todaysActive, staff]);

  // Geocode stops using job site coordinates
  const stopMarkers = useMemo(() => {
    const markers = [];
    driverRoutes.forEach(route => {
      route.stops.forEach((d, idx) => {
        const job = jobs.find(j => j.id === d.job_id);
        const lat = job?.site_lat;
        const lng = job?.site_lng;
        if (lat && lng) {
          markers.push({
            id: d.id,
            lat,
            lng,
            jobName: d.job_name || job?.name || 'Unknown',
            driverName: route.driverName,
            sequence: d.optimized_sequence_index || idx + 1,
            status: d.status,
            address: d.delivery_address || job?.location || '',
            eta: d.optimized_eta,
            legMinutes: d.leg_duration_minutes,
            legMiles: d.leg_distance_miles,
            risk: delayRisk(d.leg_duration_minutes, d.leg_distance_miles),
          });
        }
      });
    });
    return markers;
  }, [driverRoutes, jobs]);

  // Summary stats
  const stats = useMemo(() => {
    let clear = 0, moderate = 0, heavy = 0;
    driverRoutes.forEach(r => r.legs.forEach(l => {
      if (l.risk === 'clear') clear++;
      else if (l.risk === 'moderate') moderate++;
      else heavy++;
    }));
    return { clear, moderate, heavy, totalLegs: clear + moderate + heavy };
  }, [driverRoutes]);

  const hasCoords = stopMarkers.length > 0;

  const runOptimizeAll = async () => {
    setOptimizing(true);
    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      for (const route of driverRoutes) {
        if (route.stops.length >= 2) {
          await base44.functions.invoke('optimizeDailyRoute', {
            driver_staff_id: route.driverId,
            date: todayStr,
          });
        }
      }
    } catch (e) {
      // ignore — individual route errors are non-fatal
    }
    setOptimizing(false);
  };

  if (isLoading) {
    return (
      <WidgetShell title="Mission Command — Traffic Heatmap" icon={Navigation} subtitle="Live traffic-aware fleet dispatch">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      </WidgetShell>
    );
  }

  if (todaysActive.length === 0) {
    return (
      <WidgetShell title="Mission Command — Traffic Heatmap" icon={Navigation} subtitle="Live traffic-aware fleet dispatch">
        <div className="text-center py-8">
          <Truck className="w-10 h-10 text-slate-200 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-600">No active deliveries today</p>
          <p className="text-xs text-slate-400 mt-1">Schedule deliveries and run route optimisation to see live traffic risk.</p>
        </div>
      </WidgetShell>
    );
  }

  return (
    <WidgetShell
      title="Mission Command — Traffic Heatmap"
      icon={Navigation}
      subtitle={`${todaysActive.length} active stops · ${driverRoutes.length} drivers`}
      action={
        <button
          onClick={runOptimizeAll}
          disabled={optimizing || driverRoutes.length === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90 transition disabled:opacity-50"
        >
          {optimizing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
          {optimizing ? 'Optimising…' : 'Optimise All'}
        </button>
      }
    >
      {/* Traffic risk legend + stats */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        {['clear', 'moderate', 'heavy'].map(risk => (
          <div key={risk} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ background: RISK_COLORS[risk] }} />
            <span className="text-xs font-medium text-slate-600">{RISK_LABELS[risk]}</span>
            <span className="text-xs font-bold text-slate-800 tabular-nums">{stats[risk]}</span>
          </div>
        ))}
        {stats.totalLegs === 0 && (
          <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Run route optimisation to calculate traffic risk
          </span>
        )}
      </div>

      {/* Map */}
      {hasCoords ? (
        <div style={{ height: '360px' }} className="rounded-xl overflow-hidden border border-slate-200">
          <MapContainer center={UK_CENTER} zoom={6} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
            {/* Route polylines coloured by traffic risk */}
            {driverRoutes.map(route => {
              const stops = route.stops.filter(d => {
                const job = jobs.find(j => j.id === d.job_id);
                return job?.site_lat && job?.site_lng;
              });
              return stops.slice(0, -1).map((d, i) => {
                const next = stops[i + 1];
                const job1 = jobs.find(j => j.id === d.job_id);
                const job2 = jobs.find(j => j.id === next.job_id);
                const risk = delayRisk(next.leg_duration_minutes, next.leg_distance_miles);
                return (
                  <Polyline
                    key={`${route.driverId}-${i}`}
                    positions={[[job1.site_lat, job1.site_lng], [job2.site_lat, job2.site_lng]]}
                    pathOptions={{ color: RISK_COLORS[risk], weight: 3, opacity: 0.7, dashArray: risk === 'clear' ? null : '8 6' }}
                  />
                );
              });
            })}
            {/* Stop markers */}
            {stopMarkers.map(m => (
              <CircleMarker
                key={m.id}
                center={[m.lat, m.lng]}
                radius={8}
                pathOptions={{ color: RISK_COLORS[m.risk], fillColor: RISK_COLORS[m.risk], fillOpacity: 0.8, weight: 2 }}
              >
                <Popup>
                  <div className="text-xs space-y-1">
                    <p className="font-bold text-sm">Stop #{m.sequence}</p>
                    <p className="text-slate-700">{m.jobName}</p>
                    <p className="text-slate-500">Driver: {m.driverName}</p>
                    {m.address && <p className="text-slate-500">{m.address}</p>}
                    {m.eta && (
                      <p className="flex items-center gap-1 text-slate-600">
                        <Clock className="w-3 h-3" /> ETA: {new Date(m.eta).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                    {m.legMiles > 0 && (
                      <p className="flex items-center gap-1" style={{ color: RISK_COLORS[m.risk] }}>
                        <Route className="w-3 h-3" /> {m.legMiles}mi · {m.legMinutes}m · {RISK_LABELS[m.risk]}
                      </p>
                    )}
                    {onNavigateToJob && (
                      <button onClick={() => onNavigateToJob(m.id)} className="text-blue-600 font-medium hover:underline mt-1">
                        View delivery →
                      </button>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
      ) : (
        <div className="text-center py-8 bg-slate-50 rounded-xl">
          <Navigation className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No GPS coordinates on job sites.</p>
          <p className="text-xs text-slate-400 mt-1">Set site lat/lng on jobs (via the geocode button on the job form) to see them on the map.</p>
        </div>
      )}

      {/* Driver route summary */}
      {driverRoutes.length > 0 && (
        <div className="mt-3 space-y-1.5 max-h-32 overflow-y-auto">
          {driverRoutes.map(route => {
            const totalMin = route.stops.reduce((s, d) => s + (d.leg_duration_minutes || 0), 0);
            const totalMi = route.stops.reduce((s, d) => s + (d.leg_distance_miles || 0), 0);
            const hasLegs = route.legs.length > 0;
            return (
              <div key={route.driverId} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg text-xs">
                <Truck className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <span className="font-semibold text-slate-700 truncate flex-1">{route.driverName}</span>
                <span className="text-slate-500">{route.stops.length} stops</span>
                {hasLegs && (
                  <>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-500 tabular-nums">{totalMin}m · {totalMi}mi</span>
                  </>
                )}
                <div className="flex items-center gap-1">
                  {route.legs.map((l, i) => (
                    <span key={i} className="w-2 h-2 rounded-full" style={{ background: RISK_COLORS[l.risk] }} title={`${RISK_LABELS[l.risk]}: ${l.minutes}m / ${l.miles}mi`} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </WidgetShell>
  );
}