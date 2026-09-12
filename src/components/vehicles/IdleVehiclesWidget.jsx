import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, RefreshCw, Clock, Truck } from 'lucide-react';

export default function IdleVehiclesWidget() {
  const [threshold, setThreshold] = useState(30);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['idle-vehicles', threshold],
    queryFn: async () => {
      const res = await base44.functions.invoke('checkIdleVehicles', { idle_threshold_days: threshold });
      return res?.data ?? res;
    },
  });

  const idle = data?.idle || [];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${idle.length > 0 ? 'bg-orange-50' : 'bg-emerald-50'}`}>
            <AlertTriangle className={`w-4 h-4 ${idle.length > 0 ? 'text-orange-600' : 'text-emerald-600'}`} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">Idle Vehicle Watch</h3>
            <p className="text-[11px] text-slate-400">Vehicles with no activity — review for disposal</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select value={threshold} onChange={e => setThreshold(Number(e.target.value))}
            className="px-2 py-1 border border-slate-200 rounded-lg text-xs text-slate-600 focus:outline-none focus:border-primary">
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
          </select>
          <button onClick={() => refetch()} disabled={isFetching}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="px-4 pb-4 text-center text-xs text-slate-400">Checking vehicle activity…</div>
      ) : idle.length === 0 ? (
        <div className="px-4 pb-4 flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 rounded-lg p-2.5 mx-4 mb-4">
          <Truck className="w-4 h-4" />
          <span>All vehicles have been active in the last {threshold} days.</span>
        </div>
      ) : (
        <div className="px-4 pb-4">
          <div className="flex items-center gap-2 mb-2 text-xs font-bold text-orange-700">
            <AlertTriangle className="w-3.5 h-3.5" />
            {idle.length} vehicle{idle.length !== 1 ? 's' : ''} idle for {threshold}+ days
          </div>
          <div className="space-y-1.5">
            {idle.slice(0, 6).map(v => (
              <div key={v.vehicle_id} className="flex items-center gap-2 bg-orange-50/50 border border-orange-100 rounded-lg p-2">
                <span className="font-mono text-xs font-bold text-slate-700 flex-shrink-0">{v.registration_number}</span>
                <span className="text-[11px] text-slate-500 flex-1 truncate">{v.vehicle_name}</span>
                <span className="text-[11px] font-semibold text-orange-600 flex items-center gap-1 flex-shrink-0">
                  <Clock className="w-3 h-3" />
                  {v.days_idle >= 999 ? 'Never seen' : `${v.days_idle}d idle`}
                </span>
              </div>
            ))}
            {idle.length > 6 && (
              <p className="text-[10px] text-slate-400 text-center pt-1">+{idle.length - 6} more idle vehicles</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}