import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  X, Truck, Package, ArrowRightLeft, MapPin, Clock, CheckCircle2, PlayCircle,
  AlertTriangle, Navigation, Link2, User, Phone, ChevronRight, Calendar,
  ShieldCheck, FlaskConical, Store, Loader2, FileCheck, Weight,
} from 'lucide-react';
import { format, isToday, parseISO } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import DeliveryRouteMap from '@/components/delivery/DeliveryRouteMap';
import RouteOptimizeBar from '@/components/delivery/RouteOptimizeBar';
import PrintLoadManifest from '@/components/logistics/PrintLoadManifest';
import PrintPickList from '@/components/logistics/PrintPickList';
import TrailerPicker from '@/components/logistics/TrailerPicker';

const typeConfig = {
  site_delivery: { label: 'Delivery', icon: Truck, accent: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' },
  supplier_delivery: { label: 'Goods In', icon: Store, accent: 'bg-teal-500', badge: 'bg-teal-50 text-teal-700 ring-1 ring-teal-200' },
  supplier_collection: { label: 'Collection', icon: Package, accent: 'bg-blue-500', badge: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' },
  item_handover: { label: 'Handover', icon: ArrowRightLeft, accent: 'bg-purple-500', badge: 'bg-purple-50 text-purple-700 ring-1 ring-purple-200' },
  sample_collection: { label: 'Sample Collect', icon: FlaskConical, accent: 'bg-teal-500', badge: 'bg-teal-50 text-teal-700 ring-1 ring-teal-200' },
  sample_delivery: { label: 'Sample to Lab', icon: FlaskConical, accent: 'bg-cyan-500', badge: 'bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200' },
};

const statusConfig = {
  pending: { label: 'Scheduled', icon: Clock, color: 'text-slate-500', badge: 'bg-slate-100 text-slate-600' },
  in_progress: { label: 'In Transit', icon: PlayCircle, color: 'text-blue-600', badge: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Completed', icon: CheckCircle2, color: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700' },
  failed: { label: 'Failed', icon: AlertTriangle, color: 'text-red-600', badge: 'bg-red-100 text-red-700' },
};

const LEG_CONFIG = {
  collect: { icon: Package, label: 'Collect', badge: 'bg-blue-100 text-blue-700 ring-blue-200' },
  transfer: { icon: ArrowRightLeft, label: 'Transfer', badge: 'bg-amber-100 text-amber-700 ring-amber-200' },
  deliver: { icon: Truck, label: 'Deliver', badge: 'bg-emerald-100 text-emerald-700 ring-emerald-200' },
};

const LEG_STATUS = {
  pending: { label: 'Pending', cls: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400' },
  in_transit: { label: 'In Transit', cls: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  complete: { label: 'Complete', cls: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
};

function fmtDuration(mins) {
  if (!mins) return '—';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function DeliveryDetailDrawer({ delivery, jobs, staff, onClose }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [reconciling, setReconciling] = useState(false);
  const [savingTrailer, setSavingTrailer] = useState(false);

  // Active trailers from the asset inventory
  const { data: trailers = [] } = useQuery({
    queryKey: ['active-trailers'],
    queryFn: () => base44.entities.SiteAsset.filter({ asset_type: 'trailer', is_active: true }),
  });

  const handleTrailerChange = async (trailerId, trailer) => {
    setSavingTrailer(true);
    try {
      await base44.entities.DeliveryLog.update(delivery.id, {
        trailer_id: trailerId || '',
        trailer_name: trailer?.name || '',
      });
      queryClient.invalidateQueries({ queryKey: ['admin-all-deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['driver-hub-deliveries'] });
      toast({ title: trailerId ? 'Trailer assigned' : 'Trailer removed', description: trailer?.name || '' });
    } catch (e) {
      toast({ title: 'Could not update trailer', description: e.message, variant: 'destructive' });
    } finally {
      setSavingTrailer(false);
    }
  };

  const job = jobs.find(j => j.id === delivery.job_id);
  const driver = staff.find(s => s.id === delivery.driver_staff_id);
  const handoverTo = staff.find(s => s.id === delivery.handover_to_staff_id);
  const dest = delivery.delivery_type === 'supplier_collection' ? delivery.pickup_address : delivery.delivery_address;
  const type = typeConfig[delivery.delivery_type] || typeConfig.site_delivery;
  const status = statusConfig[delivery.status] || statusConfig.pending;
  const TypeIcon = type.icon;
  const StatusIcon = status.icon;

  // Driver's day stops
  const { data: driverStops = [] } = useQuery({
    queryKey: ['driver-day-stops', delivery.driver_staff_id, delivery.scheduled_date],
    queryFn: () => base44.entities.DeliveryLog.filter({ driver_staff_id: delivery.driver_staff_id, scheduled_date: delivery.scheduled_date }),
    enabled: !!delivery.driver_staff_id,
  });

  // Vehicle for this delivery (for weight/manifest)
  const { data: deliveryVehicle } = useQuery({
    queryKey: ['delivery-vehicle', delivery.vehicle_id],
    queryFn: () => base44.entities.Vehicle.get(delivery.vehicle_id),
    enabled: !!delivery.vehicle_id,
  });

  // Chain legs for the job
  const { data: chainLegs = [] } = useQuery({
    queryKey: ['job-chain-legs-detail', delivery.job_id],
    queryFn: () => base44.entities.DeliveryLeg.filter({ job_id: delivery.job_id }),
    enabled: !!delivery.job_id,
  });

  const sortedDriverStops = [...driverStops].sort((a, b) => {
    const aIdx = a.optimized_sequence_index;
    const bIdx = b.optimized_sequence_index;
    if (aIdx != null && bIdx != null) return aIdx - bIdx;
    if (aIdx != null) return -1;
    if (bIdx != null) return 1;
    return new Date(a.created_date || 0) - new Date(b.created_date || 0);
  });

  const sortedChainLegs = [...chainLegs].sort((a, b) => (a.leg_sequence || 0) - (b.leg_sequence || 0));
  const currentStopIndex = sortedDriverStops.findIndex(s => s.id === delivery.id);

  // Reconciliation
  const eligibleLegs = chainLegs.filter(l => l.status === 'in_transit' && l.photo_url && l.signature_url);

  const handleReconcile = async () => {
    if (eligibleLegs.length === 0) return;
    setReconciling(true);
    try {
      const toUpdate = eligibleLegs.map(l => ({ id: l.id, status: 'complete' }));
      await base44.entities.DeliveryLeg.bulkUpdate(toUpdate);
      toast({ title: `✓ ${toUpdate.length} deliveries reconciled` });
      queryClient.invalidateQueries({ queryKey: ['job-chain-legs-detail'] });
      queryClient.invalidateQueries({ queryKey: ['admin-all-deliveries'] });
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setReconciling(false);
    }
  };

  const detailRows = [
    { label: 'Type', value: type.label },
    { label: 'Status', value: status.label },
    { label: 'Job', value: delivery.job_name || job?.name },
    { label: 'Driver', value: delivery.driver_staff_name || driver?.name },
    { label: 'Scheduled', value: delivery.scheduled_date && format(new Date(delivery.scheduled_date + 'T00:00:00'), 'EEE dd MMM yyyy') },
    { label: 'Destination', value: dest },
    { label: 'Pickup', value: delivery.pickup_address },
    { label: 'Items', value: delivery.items },
    { label: 'Contact', value: delivery.contact_name },
    { label: 'Phone', value: delivery.contact_phone },
    { label: 'PO Number', value: delivery.po_number },
    { label: 'Notes', value: delivery.notes },
    { label: 'Condition', value: delivery.condition_report },
    { label: 'Signed by', value: delivery.signed_by_name },
    { label: 'Completed at', value: delivery.completed_at && format(new Date(delivery.completed_at), 'dd MMM yyyy HH:mm') },
    { label: 'Handover to', value: delivery.handover_to_staff_name || handoverTo?.name },
    { label: 'Handover from', value: delivery.handover_from_staff_name },
    { label: 'GPS', value: delivery.gps_coordinates },
  ].filter(r => r.value);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative bg-white w-full max-w-md xl:max-w-lg h-full overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl ${type.accent} flex items-center justify-center`}>
              <TypeIcon className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Delivery Details</h2>
              <p className="text-xs text-slate-500">{delivery.job_name || job?.name || 'Delivery task'}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Status banner */}
          <div className={`flex items-center gap-2.5 p-3 rounded-xl ${status.badge}`}>
            <StatusIcon className="w-5 h-5" />
            <span className="font-semibold text-sm">{status.label}</span>
            {delivery.scheduled_date && (
              <span className="text-xs ml-auto flex items-center gap-1 opacity-70">
                <Calendar className="w-3 h-3" />{format(new Date(delivery.scheduled_date + 'T00:00:00'), 'dd MMM')}
              </span>
            )}
          </div>

          {/* Linked sample run banner */}
          {delivery.parent_delivery_id && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-cyan-50 border border-cyan-200">
              <Link2 className="w-4 h-4 text-cyan-700 flex-shrink-0" />
              <span className="text-xs font-semibold text-cyan-800">Part of a linked sample run — collection and delivery tracked together.</span>
            </div>
          )}

          {/* Warehouse pick list — always available */}
          <div className="flex items-center gap-2">
            <PrintPickList
              delivery={delivery}
              job={job}
              vehicle={deliveryVehicle}
              driverName={delivery.driver_staff_name}
            />
          </div>

          {/* Weight & safe-to-drive summary */}
          {(delivery.total_loaded_weight_kg || delivery.axle_guidance_note) && (
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 space-y-2">
              {delivery.total_loaded_weight_kg != null && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium flex items-center gap-1.5"><Weight className="w-3.5 h-3.5" /> Loaded Weight</span>
                  <span className={`font-bold tabular-nums ${
                    deliveryVehicle?.max_weight_kg && delivery.total_loaded_weight_kg > deliveryVehicle.max_weight_kg ? 'text-rose-600'
                    : deliveryVehicle?.max_weight_kg && delivery.total_loaded_weight_kg >= deliveryVehicle.max_weight_kg * 0.9 ? 'text-amber-600'
                    : 'text-slate-800'
                  }`}>
                    {Math.round(delivery.total_loaded_weight_kg)} kg
                    {deliveryVehicle?.max_weight_kg ? ` / ${Math.round(deliveryVehicle.max_weight_kg)} kg` : ''}
                    {delivery.weight_override && <span className="ml-1.5 text-[10px] text-rose-600 font-bold">(OVERRIDE)</span>}
                  </span>
                </div>
              )}
              {delivery.axle_guidance_note && (
                <div className="text-[11px] text-slate-600 leading-snug bg-white rounded-lg p-2 border border-slate-100">
                  <span className="font-bold text-slate-700">Axle Guidance:</span> {delivery.axle_guidance_note}
                </div>
              )}
              {deliveryVehicle && (
                <PrintLoadManifest
                  delivery={delivery}
                  vehicle={deliveryVehicle}
                  driverName={delivery.driver_staff_name}
                  items={(delivery.items || '').split(/\n|,(?=\s)/).map(x => x.trim()).filter(Boolean).map(x => ({ name: x, weight_kg: delivery.total_loaded_weight_kg || 0 }))}
                  axleGuidanceNote={delivery.axle_guidance_note}
                />
              )}
            </div>
          )}

          {/* Trailer assignment */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
            <TrailerPicker trailers={trailers} value={delivery.trailer_id || ''} onChange={handleTrailerChange} />
            {savingTrailer && <p className="text-[10px] text-slate-400 mt-1.5">Saving…</p>}
            {delivery.trailer_name && !delivery.trailer_id && (
              <p className="text-[11px] text-slate-500 mt-1.5">Previously: {delivery.trailer_name}</p>
            )}
          </div>

          {/* Signature & Photos */}
          {delivery.signature_url && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase mb-1.5">Signature</p>
              <img src={delivery.signature_url} alt="Signature" className="max-h-24 rounded-lg border border-slate-200" />
            </div>
          )}
          {delivery.photo_urls && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase mb-1.5">Photos</p>
              <div className="flex gap-2 flex-wrap">
                {delivery.photo_urls.split(',').filter(Boolean).map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                    <img src={url} alt={`Evidence ${i + 1}`} className="w-20 h-20 object-cover rounded-lg border border-slate-200" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Detail rows */}
          <div className="space-y-2.5">
            {detailRows.map(r => (
              <div key={r.label} className="border-b border-slate-100 pb-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{r.label}</p>
                <p className="text-sm text-slate-800 mt-0.5 whitespace-pre-wrap break-words">{String(r.value)}</p>
              </div>
            ))}
          </div>

          {/* Driver's Day section — integrated from Day Planner */}
          {delivery.driver_staff_id && sortedDriverStops.length > 0 && (
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg stat-gradient-amber flex items-center justify-center">
                  <Navigation className="w-3.5 h-3.5 text-white" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">Driver's Day</h3>
                <span className="text-xs font-bold text-slate-500 bg-slate-200 rounded-full px-2 py-0.5">{sortedDriverStops.length} stops</span>
              </div>
              {/* Day summary */}
              <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
                <span>{sortedDriverStops.filter(s => s.status === 'pending' || s.status === 'in_progress').length} active</span>
                <span>·</span>
                <span>{sortedDriverStops.filter(s => s.status === 'completed').length} done</span>
                <span>·</span>
                <span>{sortedDriverStops.reduce((sum, d) => sum + (d.leg_distance_miles || 0), 0).toFixed(1)} mi</span>
              </div>
              {/* Route optimiser */}
              {sortedDriverStops.filter(s => s.status === 'pending' || s.status === 'in_progress').length >= 2 && (
                <div className="mb-3">
                  <RouteOptimizeBar driverStaffId={delivery.driver_staff_id} date={delivery.scheduled_date} count={sortedDriverStops.filter(s => s.status !== 'completed').length} />
                </div>
              )}
              {/* Stop list */}
              <div className="space-y-1.5">
                {sortedDriverStops.map((stop, idx) => {
                  const stopType = typeConfig[stop.delivery_type] || typeConfig.site_delivery;
                  const stopStatus = statusConfig[stop.status] || statusConfig.pending;
                  const StopIcon = stopType.icon;
                  const isCurrent = stop.id === delivery.id;
                  const addr = stop.delivery_type === 'supplier_collection' ? stop.pickup_address : stop.delivery_address;
                  return (
                    <div key={stop.id} className={`flex items-center gap-2.5 p-2 rounded-lg ${isCurrent ? 'bg-emerald-50 border border-emerald-200' : 'bg-white border border-slate-100'}`}>
                      <div className={`w-6 h-6 rounded-full ${stopType.accent} text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0`}>
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <StopIcon className="w-3 h-3 text-slate-400 flex-shrink-0" />
                          <p className="text-xs font-semibold text-slate-700 truncate">{stop.job_name || 'No job'}</p>
                          {isCurrent && <span className="text-[9px] font-bold text-emerald-600 bg-emerald-100 px-1 rounded">THIS</span>}
                        </div>
                        {addr && <p className="text-[10px] text-slate-400 truncate mt-0.5">{addr}</p>}
                      </div>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${stopStatus.badge} flex-shrink-0`}>
                        {stopStatus.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Delivery Chain section — integrated from Chain Builder */}
          {delivery.job_id && sortedChainLegs.length > 0 && (
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg stat-gradient-blue flex items-center justify-center">
                  <Link2 className="w-3.5 h-3.5 text-white" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">Delivery Chain</h3>
                <span className="text-xs font-bold text-slate-500 bg-slate-200 rounded-full px-2 py-0.5">{sortedChainLegs.length} legs</span>
              </div>
              {/* Chain flow visual */}
              <div className="flex items-center gap-1 mb-3 overflow-x-auto pb-1">
                {sortedChainLegs.map((leg, i) => {
                  const cfg = LEG_CONFIG[leg.leg_type] || LEG_CONFIG.collect;
                  const st = LEG_STATUS[leg.status] || LEG_STATUS.pending;
                  const Icon = cfg.icon;
                  return (
                    <React.Fragment key={leg.id}>
                      {i > 0 && <ChevronRight className="w-3 h-3 text-slate-300 flex-shrink-0" />}
                      <div className={`inline-flex items-center gap-1 text-[9px] px-2 py-1 rounded-full font-semibold ring-1 flex-shrink-0 ${cfg.badge}`}>
                        <Icon className="w-2.5 h-2.5" />{leg.leg_sequence}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
              {/* Leg list */}
              <div className="space-y-1.5">
                {sortedChainLegs.map(leg => {
                  const cfg = LEG_CONFIG[leg.leg_type] || LEG_CONFIG.collect;
                  const st = LEG_STATUS[leg.status] || LEG_STATUS.pending;
                  const Icon = cfg.icon;
                  return (
                    <div key={leg.id} className="flex items-center gap-2.5 p-2 bg-white rounded-lg border border-slate-100">
                      <span className="text-xs font-bold text-slate-400 w-5 text-center">{leg.leg_sequence}</span>
                      <span className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full font-semibold ring-1 ${cfg.badge}`}>
                        <Icon className="w-2.5 h-2.5" />{cfg.label}
                      </span>
                      <div className="flex-1 min-w-0 text-xs text-slate-600 truncate">
                        <span className="font-medium">{leg.from_location || '—'}</span>
                        <ChevronRight className="w-2.5 h-2.5 inline mx-0.5 text-slate-300" />
                        <span className="font-medium">{leg.to_location || '—'}</span>
                      </div>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${st.cls} flex-shrink-0`}>{st.label}</span>
                    </div>
                  );
                })}
              </div>
              {/* Reconciliation */}
              {eligibleLegs.length > 0 && (
                <button
                  onClick={handleReconcile}
                  disabled={reconciling}
                  className="w-full mt-3 inline-flex items-center justify-center gap-2 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition"
                >
                  {reconciling ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {reconciling ? 'Reconciling…' : `Fast-Approve ${eligibleLegs.length} Leg${eligibleLegs.length !== 1 ? 's' : ''}`}
                </button>
              )}
            </div>
          )}

          {/* Route map */}
          {delivery.job_id && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Route Map</p>
              <DeliveryRouteMapLegs jobId={delivery.job_id} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DeliveryRouteMapLegs({ jobId }) {
  const { data: legs = [] } = useQuery({
    queryKey: ['delivery-legs-map', jobId],
    queryFn: () => base44.entities.DeliveryLeg.filter({ job_id: jobId }),
    enabled: !!jobId,
  });
  if (!legs.length) return null;
  return <DeliveryRouteMap legs={legs} />;
}