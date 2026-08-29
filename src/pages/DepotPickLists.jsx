import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  ArrowLeft, ClipboardList, Printer, Truck, MapPin, Clock,
  CheckCircle2, Circle, Package, Navigation, AlertTriangle,
} from 'lucide-react';
import { isToday } from 'date-fns';
import PickListModal from '@/components/logistics/PickListModal';
import { buildPickListHtml, printPickListHtml } from '@/components/logistics/pickListHtml';
import { useToast } from '@/components/ui/use-toast';

/**
 * Depot Pick Lists — mobile-first page listing today's deliveries needing
 * warehouse picks, grouped by vehicle, with status badges and per-delivery
 * print + digital sign-off access.
 */
export default function DepotPickLists() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [openDelivery, setOpenDelivery] = useState(null);

  const { data: deliveries = [], isLoading } = useQuery({
    queryKey: ['depot-pick-lists'],
    queryFn: () => base44.entities.DeliveryLog.list('-scheduled_date', 500),
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['depot-pick-jobs'],
    queryFn: () => base44.entities.Job.list('-updated_date', 200),
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['depot-pick-vehicles'],
    queryFn: () => base44.entities.Vehicle.list(),
  });

  const todays = useMemo(
    () => deliveries.filter(d => isToday(new Date(d.scheduled_date + 'T00:00:00'))),
    [deliveries]
  );

  const pickStatus = (d) => {
    const stages = [!!d.picked_at, !!d.loaded_at, !!d.driver_checked_at];
    const done = stages.filter(Boolean).length;
    if (done === 0) return { key: 'pending', label: 'Pending', color: 'amber' };
    if (done === 3) return { key: 'complete', label: 'Complete', color: 'emerald' };
    return { key: 'picking', label: `${done}/3 Done`, color: 'blue' };
  };

  const grouped = useMemo(() => {
    const groups = {};
    todays.forEach(d => {
      const key = d.vehicle_id || 'unassigned';
      if (!groups[key]) groups[key] = [];
      groups[key].push(d);
    });
    return Object.entries(groups).map(([vid, list]) => ({
      vehicle: vehicles.find(v => v.id === vid) || null,
      vehicleId: vid,
      deliveries: list.sort((a, b) => (a.optimized_sequence_index || 99) - (b.optimized_sequence_index || 99)),
    }));
  }, [todays, vehicles]);

  const stats = useMemo(() => ({
    total: todays.length,
    pending: todays.filter(d => pickStatus(d).key === 'pending').length,
    picking: todays.filter(d => pickStatus(d).key === 'picking').length,
    complete: todays.filter(d => pickStatus(d).key === 'complete').length,
  }), [todays]);

  const statusStyles = {
    amber: 'bg-amber-100 text-amber-700 border-amber-200',
    blue: 'bg-blue-100 text-blue-700 border-blue-200',
    emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  };

  return (
    <div className="fixed inset-0 bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-2.5 safe-area-top flex-shrink-0">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition flex-shrink-0 active:scale-95 touch-manipulation">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center shadow-sm flex-shrink-0">
          <ClipboardList className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-bold text-slate-900 leading-tight">Depot Pick Lists</h1>
          <p className="text-[11px] text-slate-500">Today's deliveries · {stats.total} to pick</p>
        </div>
      </header>

      {/* Stats strip */}
      <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex gap-2 flex-shrink-0 overflow-x-auto no-scrollbar">
        <StatPill icon={Clock} label="Pending" value={stats.pending} color="amber" />
        <StatPill icon={Package} label="In Progress" value={stats.picking} color="blue" />
        <StatPill icon={CheckCircle2} label="Complete" value={stats.complete} color="emerald" />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto w-full p-4 space-y-4">
          {isLoading && (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-4 border-slate-200 border-t-[#2E5A1A] rounded-full animate-spin" />
            </div>
          )}

          {!isLoading && todays.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ClipboardList className="w-12 h-12 text-slate-300 mb-3" />
              <p className="text-sm font-semibold text-slate-600">No deliveries today</p>
              <p className="text-xs text-slate-400 mt-1">Pick lists appear here when deliveries are scheduled</p>
            </div>
          )}

          {grouped.map(group => (
            <div key={group.vehicleId} className="space-y-2">
              {/* Vehicle group header */}
              <div className="flex items-center gap-2 px-1 pt-1">
                <Truck className="w-4 h-4 text-[#2E5A1A]" />
                <h3 className="text-sm font-bold text-slate-800">
                  {group.vehicle ? `${group.vehicle.name}${group.vehicle.registration_number ? ` · ${group.vehicle.registration_number}` : ''}` : 'Unassigned Vehicle'}
                </h3>
                <span className="text-xs text-slate-400">· {group.deliveries.length} drop{group.deliveries.length !== 1 ? 's' : ''}</span>
              </div>

              {/* Delivery cards */}
              <div className="space-y-2">
                {group.deliveries.map(d => {
                  const job = jobs.find(j => j.id === d.job_id);
                  const status = pickStatus(d);
                  const itemCount = (d.items || '').split(/\n|,(?=\s)/).filter(x => x.trim()).length || 0;
                  return (
                    <div key={d.id} className="insight-card rounded-2xl p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {d.optimized_sequence_index && (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#2E5A1A] text-white text-xs font-bold flex-shrink-0">
                                {d.optimized_sequence_index}
                              </span>
                            )}
                            <p className="text-sm font-bold text-slate-900 truncate">{d.job_name || job?.name || 'Drop'}</p>
                          </div>
                          {d.delivery_address && (
                            <p className="text-xs text-slate-500 flex items-center gap-1 truncate">
                              <MapPin className="w-3 h-3 flex-shrink-0" /> {d.delivery_address}
                            </p>
                          )}
                        </div>
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold border flex-shrink-0 ${statusStyles[status.color]}`}>
                          {status.key === 'complete' ? <CheckCircle2 className="w-3 h-3" /> : status.key === 'pending' ? <Clock className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
                          {status.label}
                        </span>
                      </div>

                      {/* Item count + driver */}
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <Package className="w-3.5 h-3.5 text-slate-400" /> {itemCount} item{itemCount !== 1 ? 's' : ''}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Navigation className="w-3.5 h-3.5 text-slate-400" /> {d.driver_staff_name || 'Unassigned'}
                        </span>
                      </div>

                      {/* Stage indicators */}
                      <div className="flex items-center gap-1.5">
                        {[
                          { done: !!d.picked_at, label: 'Picked' },
                          { done: !!d.loaded_at, label: 'Loaded' },
                          { done: !!d.driver_checked_at, label: 'Checked' },
                        ].map((s, i) => (
                          <span key={i} className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold ${s.done ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                            {s.done ? <CheckCircle2 className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
                            {s.label}
                          </span>
                        ))}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => setOpenDelivery(d)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 bg-[#2E5A1A] text-white rounded-xl text-xs font-bold hover:bg-[#244715] transition touch-manipulation min-h-[44px]"
                        >
                          <ClipboardList className="w-3.5 h-3.5" /> Open & Sign Off
                        </button>
                        <button
                          onClick={() => {
                            const html = buildPickListHtml({
                              delivery: d, job, vehicle: group.vehicle, driverName: d.driver_staff_name,
                            });
                            printPickListHtml(html);
                          }}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 transition touch-manipulation min-h-[44px]"
                        >
                          <Printer className="w-3.5 h-3.5" /> Print
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pick list modal */}
      {openDelivery && (
        <PickListModal
          delivery={openDelivery}
          job={jobs.find(j => j.id === openDelivery.job_id)}
          vehicle={vehicles.find(v => v.id === openDelivery.vehicle_id)}
          driverName={openDelivery.driver_staff_name}
          open
          onClose={() => setOpenDelivery(null)}
        />
      )}
    </div>
  );
}

function StatPill({ icon: Icon, label, value, color }) {
  const colors = {
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };
  return (
    <div className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold ${colors[color]}`}>
      <Icon className="w-3.5 h-3.5" />
      <span className="tabular-nums">{value}</span> {label}
    </div>
  );
}