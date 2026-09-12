import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Activity, RefreshCw, Gauge, Navigation, Square } from 'lucide-react';

export default function VehicleUtilisationWidget() {
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [fromDate, setFromDate] = useState(weekAgo);
  const [toDate, setToDate] = useState(today);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['vehicle-utilisation', fromDate, toDate],
    queryFn: async () => {
      const res = await base44.functions.invoke('getVehicleUtilisation', { from_date: fromDate, to_date: toDate });
      return res?.data ?? res;
    },
  });

  const fleet = data?.fleet || { driving_pct: 0, idle_pct: 0, parked_pct: 0, driving_hours: 0, idle_hours: 0, parked_hours: 0 };
  const vehicles = data?.vehicles || [];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
            <Activity className="w-4 h-4 text-violet-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">Vehicle Utilisation</h3>
            <p className="text-[11px] text-slate-400">Driving vs idle vs parked time</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
            className="px-2 py-1 border border-slate-200 rounded-lg text-xs text-slate-600 focus:outline-none focus:border-primary" />
          <span className="text-xs text-slate-300">→</span>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
            className="px-2 py-1 border border-slate-200 rounded-lg text-xs text-slate-600 focus:outline-none focus:border-primary" />
          <button onClick={() => refetch()} disabled={isFetching}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="px-4 pb-4 text-center text-xs text-slate-400">Calculating utilisation…</div>
      ) : vehicles.length === 0 ? (
        <div className="px-4 pb-4 text-center text-xs text-slate-400">
          No GPS data in this period. Sync Geotab to populate utilisation metrics.
        </div>
      ) : (
        <div className="px-4 pb-4">
          {/* Fleet aggregate bar */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[11px] font-bold text-slate-500 uppercase">Fleet Average</p>
              <p className="text-[11px] text-slate-400">{vehicles.length} vehicles · {fleet.driving_hours + fleet.idle_hours + fleet.parked_hours}h logged</p>
            </div>
            <div className="flex h-6 rounded-lg overflow-hidden">
              <div className="bg-emerald-500 flex items-center justify-center text-[10px] font-bold text-white" style={{ width: `${fleet.driving_pct}%` }}>
                {fleet.driving_pct > 8 && `${fleet.driving_pct}%`}
              </div>
              <div className="bg-amber-400 flex items-center justify-center text-[10px] font-bold text-white" style={{ width: `${fleet.idle_pct}%` }}>
                {fleet.idle_pct > 8 && `${fleet.idle_pct}%`}
              </div>
              <div className="bg-slate-300 flex items-center justify-center text-[10px] font-bold text-slate-600" style={{ width: `${fleet.parked_pct}%` }}>
                {fleet.parked_pct > 8 && `${fleet.parked_pct}%`}
              </div>
            </div>
            <div className="flex items-center gap-3 mt-1.5 text-[10px]">
              <span className="flex items-center gap-1 text-emerald-600"><Navigation className="w-2.5 h-2.5" /> Driving {fleet.driving_hours}h</span>
              <span className="flex items-center gap-1 text-amber-600"><Gauge className="w-2.5 h-2.5" /> Idle {fleet.idle_hours}h</span>
              <span className="flex items-center gap-1 text-slate-500"><Square className="w-2.5 h-2.5" /> Parked {fleet.parked_hours}h</span>
            </div>
          </div>

          {/* Per-vehicle bars (top 5 by driving hours) */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold text-slate-500 uppercase mb-1">Top Vehicles by Driving Hours</p>
            {vehicles.slice(0, 5).map(v => (
              <div key={v.vehicle_id} className="flex items-center gap-2">
                <span className="font-mono text-[11px] font-bold text-slate-600 w-20 truncate flex-shrink-0">{v.registration_number}</span>
                <div className="flex-1 flex h-4 rounded overflow-hidden">
                  <div className="bg-emerald-500" style={{ width: `${v.driving_pct}%` }} />
                  <div className="bg-amber-400" style={{ width: `${v.idle_pct}%` }} />
                  <div className="bg-slate-300" style={{ width: `${v.parked_pct}%` }} />
                </div>
                <span className="text-[10px] text-slate-400 w-12 text-right flex-shrink-0">{v.driving_hours}h drive</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}