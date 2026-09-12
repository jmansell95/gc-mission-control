import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { isToday, format } from 'date-fns';
import { Clock, PlayCircle, CheckCircle2, AlertTriangle, MapPin, Package, ShieldCheck, Navigation, Truck, ArrowRightLeft, FlaskConical } from 'lucide-react';
import SafeToDrivePanel from '@/components/logistics/SafeToDrivePanel';
import PrintLoadManifest from '@/components/logistics/PrintLoadManifest';
import PrintPickList from '@/components/logistics/PrintPickList';
import { totalWeight } from '@/utils/loadWeight';

const typeConfig = {
  site_delivery: { label: 'Delivery', icon: Truck, color: 'emerald' },
  supplier_collection: { label: 'Collection', icon: Package, color: 'blue' },
  supplier_delivery: { label: 'Goods In', icon: Package, color: 'cyan' },
  item_handover: { label: 'Handover', icon: ArrowRightLeft, color: 'violet' },
  sample_collection: { label: 'Sample Pick', icon: FlaskConical, color: 'amber' },
  sample_delivery: { label: 'Sample Drop', icon: FlaskConical, color: 'amber' },
};

const statusDot = {
  pending: { bg: 'bg-slate-300', ring: 'ring-slate-200' },
  in_progress: { bg: 'bg-blue-500', ring: 'ring-blue-200' },
  completed: { bg: 'bg-emerald-500', ring: 'ring-emerald-200' },
  failed: { bg: 'bg-rose-500', ring: 'ring-rose-200' },
};

export default function DriverDayPlan({ deliveries, jobs, drivers, onSelectDelivery }) {
  const [selectedDriver, setSelectedDriver] = useState('all');

  const { data: vehicles = [] } = useQuery({
    queryKey: ['driver-day-vehicles'],
    queryFn: () => base44.entities.Vehicle.list('-created_date', 500),
  });

  const todayDeliveries = useMemo(
    () => deliveries.filter(d => isToday(new Date(d.scheduled_date + 'T00:00:00'))),
    [deliveries]
  );

  const driversToday = useMemo(() => {
    const ids = new Set(todayDeliveries.map(d => d.driver_staff_id).filter(Boolean));
    return drivers.filter(s => ids.has(s.id));
  }, [todayDeliveries, drivers]);

  const runs = useMemo(() => {
    let list = todayDeliveries;
    if (selectedDriver !== 'all') list = list.filter(d => d.driver_staff_id === selectedDriver);
    const byDriver = new Map();
    for (const d of list) {
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
        return (a.started_at || '').localeCompare(b.started_at || '');
      });
    }
    return [...byDriver.values()];
  }, [todayDeliveries, selectedDriver, drivers]);

  if (todayDeliveries.length === 0) {
    return (
      <div className="hub-glass rounded-hub text-center py-12 text-slate-400 text-ui-body">
        <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300" />
        No deliveries scheduled for today
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Driver selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setSelectedDriver('all')}
          className={`px-3 py-1.5 rounded-lg text-ui-caption font-semibold transition ${selectedDriver === 'all' ? 'bg-primary text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
        >
          All drivers ({todayDeliveries.length})
        </button>
        {driversToday.map(d => {
          const count = todayDeliveries.filter(x => x.driver_staff_id === d.id).length;
          const active = selectedDriver === d.id;
          return (
            <button
              key={d.id}
              onClick={() => setSelectedDriver(d.id)}
              className={`px-3 py-1.5 rounded-lg text-ui-caption font-semibold transition ${active ? 'bg-primary text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              {d.name} ({count})
            </button>
          );
        })}
      </div>

      {runs.map(run => {
        const completed = run.stops.filter(s => s.status === 'completed').length;
        const overdue = run.stops.filter(s => s.status === 'pending' && s.scheduled_date && new Date(s.scheduled_date + 'T23:59:59') < new Date()).length;
        // Find the vehicle for this run (first delivery with a vehicle_id)
        const vehicleId = run.stops.find(s => s.vehicle_id)?.vehicle_id;
        const runVehicle = vehicles.find(v => v.id === vehicleId) || null;
        // Sum loaded weight — prefer denormalised total_loaded_weight_kg, fall back to weight_kg
        const runLoadedKg = run.stops.reduce((s, d) => s + (Number(d.total_loaded_weight_kg) || Number(d.weight_kg) || 0), 0);
        const runAxleNote = run.stops.find(s => s.axle_guidance_note)?.axle_guidance_note || '';
        return (
          <div key={run.driverId} className="hub-glass rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200/60 flex items-center gap-2.5 bg-slate-50/50">
              <div className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center text-ui-caption font-bold flex-shrink-0">
                {(run.driverName || '?').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-ui-subheading font-bold text-slate-900 truncate">{run.driverName}</p>
                <p className="text-ui-caption text-slate-500">{completed}/{run.stops.length} completed{overdue > 0 && <span className="text-rose-600 font-medium"> · {overdue} overdue</span>}</p>
              </div>
              {runVehicle && (
                <PrintLoadManifest
                  delivery={run.stops[0]}
                  vehicle={runVehicle}
                  driverName={run.driverName}
                  items={run.stops.flatMap(s => (s.items || '').split(/\n|,(?=\s)/).map(x => x.trim()).filter(Boolean).map(x => ({ name: x, weight_kg: 0 })))}
                  axleGuidanceNote={runAxleNote}
                />
              )}
              <Navigation className="w-4 h-4 text-slate-400" />
            </div>

            {/* Safe-to-drive payload panel — first thing the driver sees */}
            {runVehicle && (
              <div className="px-4 pt-3">
                <SafeToDrivePanel
                  vehicle={runVehicle}
                  totalLoadedKg={runLoadedKg}
                  axleGuidanceNote={runAxleNote}
                  stopsCount={run.stops.length}
                />
              </div>
            )}

            {/* Vertical timeline */}
            <div className="relative px-4 py-4 pl-10">
              <div className="absolute left-[18px] top-8 bottom-8 w-0.5 bg-slate-200" />
              <div className="space-y-1">
                {run.stops.map((d, i) => {
                  const type = typeConfig[d.delivery_type] || typeConfig.site_delivery;
                  const TypeIcon = type.icon;
                  const dot = statusDot[d.status] || statusDot.pending;
                  const dest = d.delivery_type === 'supplier_collection' ? d.pickup_address : d.delivery_address;
                  const isOverdue = d.status === 'pending' && d.scheduled_date && new Date(d.scheduled_date + 'T23:59:59') < new Date();
                  const isAtRisk = d.status === 'pending' && d.scheduled_date && !isOverdue && new Date(d.scheduled_date) < new Date(Date.now() + 24 * 60 * 60 * 1000);
                  const itemLines = (d.items || '').split(/\n|,(?=\s)/).map(s => s.trim()).filter(Boolean);
                  return (
                    <button
                      key={d.id}
                      onClick={() => onSelectDelivery?.(d)}
                      className="relative flex gap-3 w-full text-left py-2.5 px-2 -mx-2 rounded-lg hover:bg-slate-50 transition"
                    >
                      {/* Timeline dot */}
                      <div className="absolute -left-[22px] top-4 flex items-center justify-center">
                        <span className={`w-3.5 h-3.5 rounded-full ${dot.bg} ring-4 ${dot.ring} flex-shrink-0`} />
                      </div>
                      {/* Stop number badge */}
                      <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                        {i + 1}
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-ui-micro font-semibold bg-${type.color}-50 text-${type.color}-700`}>
                            <TypeIcon className="w-3 h-3" /> {type.label}
                          </span>
                          {isOverdue && (
                            <span className="inline-flex items-center gap-0.5 text-ui-micro font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">
                              <AlertTriangle className="w-2.5 h-2.5" /> overdue
                            </span>
                          )}
                          {isAtRisk && (
                            <span className="inline-flex items-center gap-0.5 text-ui-micro font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                              <Clock className="w-2.5 h-2.5" /> at risk
                            </span>
                          )}
                          {d.status === 'completed' && d.signed_by_name && (
                            <span className="inline-flex items-center gap-0.5 text-ui-micro font-medium text-emerald-600">
                              <ShieldCheck className="w-3 h-3" /> POD: {d.signed_by_name}
                            </span>
                          )}
                        </div>
                        <p className="text-ui-body font-semibold text-slate-900 leading-tight truncate">{d.job_name || 'Delivery task'}</p>
                        {dest && (
                          <p className="text-ui-caption text-slate-500 flex items-start gap-1 leading-snug">
                            <MapPin className="w-3 h-3 flex-shrink-0 mt-0.5" /> <span className="line-clamp-1">{dest}</span>
                          </p>
                        )}
                        {itemLines.length > 0 && (
                          <p className="text-ui-caption text-slate-400 flex items-center gap-1">
                            <Package className="w-3 h-3 flex-shrink-0" /> {itemLines.length} item{itemLines.length > 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                      <div className="flex-shrink-0 text-right space-y-1">
                        {d.optimized_eta && <span className="text-ui-micro text-slate-400 block">{format(new Date(d.optimized_eta), 'HH:mm')}</span>}
                        {d.leg_distance_miles != null && <span className="text-ui-micro text-slate-400 block">{d.leg_distance_miles.toFixed(1)} mi</span>}
                        <span onClick={e => e.stopPropagation()} className="block">
                          <PrintPickList
                            delivery={d}
                            job={jobs?.find(j => j.id === d.job_id)}
                            vehicle={runVehicle}
                            driverName={run.driverName}
                          />
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}