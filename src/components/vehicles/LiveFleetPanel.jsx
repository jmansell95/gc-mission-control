import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Navigation, Gauge, Users, Loader2, Car } from 'lucide-react';
import GeotabLiveMap from '@/components/vehicles/GeotabLiveMap';

/**
 * LiveFleetPanel — the "Live" segment of the Fleet Hub.
 *
 * Self-sufficient: fetches fresh Geotab driving/ignition status (mode 'live',
 * which overlays DeviceStatusInfo on top of cached logs) and polls every 60s
 * so the "Driving Now" list reflects reality right now — not stale delivery
 * task state.
 *
 * Shows a compact KPI strip (driving / parked / tracked / refresh cadence),
 * a driving-now driver list, and the full live fleet map.
 */
export default function LiveFleetPanel() {
  const { data: liveData, isLoading } = useQuery({
    queryKey: ['fleet-hub-live-driving'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getVehicleLocationHistory', { mode: 'live', limit: 500 });
      return res?.data ?? res;
    },
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const vehicles = liveData?.vehicles || [];

  const driving = useMemo(
    () => vehicles.filter(v => v.is_driving_now || (v.speed_kph || 0) > 0),
    [vehicles]
  );
  const parked = vehicles.length - driving.length;

  return (
    <div className="space-y-4">
      {/* Live KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="hub-glass rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center"><Navigation className="w-3.5 h-3.5 text-blue-600" /></div>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Driving Now</p>
          </div>
          <p className="text-lg sm:text-xl font-bold tabular-nums text-slate-900">{driving.length}</p>
          <p className="text-[10px] text-slate-400">live vehicles moving</p>
        </div>
        <div className="hub-glass rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center"><Car className="w-3.5 h-3.5 text-slate-500" /></div>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Parked</p>
          </div>
          <p className="text-lg sm:text-xl font-bold tabular-nums text-slate-900">{parked}</p>
          <p className="text-[10px] text-slate-400">stopped / engine off</p>
        </div>
        <div className="hub-glass rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-[#2E5A1A]/10 flex items-center justify-center"><Users className="w-3.5 h-3.5 text-[#2E5A1A]" /></div>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Tracked</p>
          </div>
          <p className="text-lg sm:text-xl font-bold tabular-nums text-slate-900">{vehicles.length}</p>
          <p className="text-[10px] text-slate-400">Geotab devices</p>
        </div>
        <div className="hub-glass rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center"><Gauge className="w-3.5 h-3.5 text-emerald-600" /></div>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Refresh</p>
          </div>
          <p className="text-lg sm:text-xl font-bold tabular-nums text-slate-900">60s</p>
          <p className="text-[10px] text-slate-400">auto-polling</p>
        </div>
      </div>

      {/* Driving-now driver list */}
      <div className="hub-glass rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Navigation className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-bold text-slate-900">Driving Now</h3>
          <span className="text-xs text-slate-400">({driving.length})</span>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
        ) : driving.length === 0 ? (
          <div className="text-center py-8 text-sm text-slate-400">No vehicles currently moving.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {driving.map(v => (
              <div key={v.vehicle_id} className="flex items-center gap-3 p-3 rounded-xl bg-blue-50/60 border border-blue-100">
                <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Navigation className="w-4 h-4 text-blue-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900 font-mono truncate">{v.registration_number || v.vehicle_name || '—'}</p>
                  <p className="text-xs text-slate-500 truncate">{v.driver_name || 'Unknown driver'}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-blue-600 tabular-nums">{Math.round(v.speed_kph || 0)}<span className="text-[10px] font-normal text-slate-400"> km/h</span></p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Live fleet map */}
      <GeotabLiveMap />
    </div>
  );
}