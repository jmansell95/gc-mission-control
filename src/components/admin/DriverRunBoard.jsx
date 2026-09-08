import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { Navigation, MapPin, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

function numberedIcon(n, completed) {
  const bg = completed ? '#10b981' : '#2E5A1A';
  return L.divIcon({
    className: 'driver-stop-marker',
    html: `<div style="width:26px;height:26px;border-radius:50%;background:${bg};color:white;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.35);">${n}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

export default function DriverRunBoard({ deliveries, jobs, drivers, onSelectDelivery }) {
  const runs = useMemo(() => {
    const byDriver = new Map();
    for (const d of deliveries) {
      const key = d.driver_staff_id || 'unassigned';
      if (!byDriver.has(key)) {
        const driver = drivers.find(s => s.id === d.driver_staff_id);
        byDriver.set(key, { driverId: key, driverName: d.driver_staff_name || driver?.name || 'Unassigned', stops: [] });
      }
      byDriver.get(key).stops.push(d);
    }
    for (const run of byDriver.values()) {
      run.stops.sort((a, b) => {
        const sa = a.optimized_sequence_index ?? 9999;
        const sb = b.optimized_sequence_index ?? 9999;
        if (sa !== sb) return sa - sb;
        return new Date(a.scheduled_date) - new Date(b.scheduled_date);
      });
    }
    return [...byDriver.values()];
  }, [deliveries, drivers]);

  const getCoords = (d) => {
    const job = jobs.find(j => j.id === d.job_id);
    if (job && job.site_lat && job.site_lng) return [job.site_lat, job.site_lng];
    return null;
  };

  if (runs.length === 0) {
    return (
      <div className="hub-glass rounded-hub text-center py-12 text-slate-400">
        <Navigation className="w-8 h-8 mx-auto mb-2 text-slate-300" />
        No deliveries to route
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {runs.map(run => {
        const positions = run.stops.map(getCoords).filter(Boolean);
        const hasMap = positions.length >= 2;
        const overdueCount = run.stops.filter(d => d.status === 'pending' && d.scheduled_date && new Date(d.scheduled_date + 'T23:59:59') < new Date()).length;
        return (
          <div key={run.driverId} className="hub-glass rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200/60 flex items-center gap-2.5 bg-slate-50/50">
              <div className="w-9 h-9 rounded-full bg-[#2E5A1A] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                {(run.driverName || '?').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">{run.driverName}</p>
                <p className="text-[11px] text-slate-500">{run.stops.length} stops{hasMap ? ` · ${positions.length} mappable` : ''}</p>
              </div>
              {overdueCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                  <AlertTriangle className="w-3 h-3" /> {overdueCount} overdue
                </span>
              )}
              <Navigation className="w-4 h-4 text-slate-400 flex-shrink-0" />
            </div>

            {hasMap && (
              <div className="h-44 bg-slate-100 border-b border-slate-100">
                <MapContainer center={positions[0]} zoom={11} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false} attributionControl={false}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Polyline positions={positions} pathOptions={{ color: '#2E5A1A', weight: 3, opacity: 0.5, dashArray: '6 8' }} />
                  {run.stops.map((d, i) => {
                    const pos = getCoords(d);
                    if (!pos) return null;
                    return (
                      <Marker
                        key={d.id}
                        position={pos}
                        icon={numberedIcon(i + 1, d.status === 'completed')}
                        eventHandlers={{ click: () => onSelectDelivery?.(d) }}
                      />
                    );
                  })}
                </MapContainer>
              </div>
            )}

            <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
              {run.stops.map((d, i) => {
                const dest = d.delivery_type === 'supplier_collection' ? d.pickup_address : d.delivery_address;
                const isOverdue = d.status === 'pending' && d.scheduled_date && new Date(d.scheduled_date + 'T23:59:59') < new Date();
                return (
                  <button key={d.id} onClick={() => onSelectDelivery?.(d)} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition text-left">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${d.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : isOverdue ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>
                      {d.status === 'completed' ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800 truncate">{d.job_name || 'Delivery task'}</p>
                      <p className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                        <MapPin className="w-3 h-3 flex-shrink-0" /> {dest || 'No address'}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <span className="text-[10px] text-slate-400 block">{format(new Date(d.scheduled_date + 'T00:00:00'), 'dd MMM')}</span>
                      {isOverdue && <span className="text-[10px] font-bold text-rose-600">overdue</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}