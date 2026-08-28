import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Truck, Package, ArrowRightLeft, MapPin, Plus, X, Clock, Navigation,
  Sparkles, Loader2, AlertTriangle, CheckCircle2, PlayCircle, Trash2,
  ChevronUp, ChevronDown, GripVertical, User, Phone, FileText, Calendar,
  Route as RouteIcon, FlaskConical, ClipboardList,
} from 'lucide-react';
import { format, isToday, parseISO } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import { Skeleton, EmptyState } from '@/components/StateViews';
import RouteOptimizeBar from '@/components/delivery/RouteOptimizeBar';

const STOP_TYPES = [
  { value: 'site_delivery', label: 'Site Delivery', icon: Truck, dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700 ring-emerald-200' },
  { value: 'supplier_collection', label: 'Collection', icon: Package, dot: 'bg-blue-500', badge: 'bg-blue-100 text-blue-700 ring-blue-200' },
  { value: 'item_handover', label: 'Handover', icon: ArrowRightLeft, dot: 'bg-purple-500', badge: 'bg-purple-100 text-purple-700 ring-purple-200' },
  { value: 'sample_collection', label: 'Sample Collect', icon: FlaskConical, dot: 'bg-teal-500', badge: 'bg-teal-100 text-teal-700 ring-teal-200' },
  { value: 'sample_delivery', label: 'Sample to Lab', icon: FlaskConical, dot: 'bg-cyan-500', badge: 'bg-cyan-100 text-cyan-700 ring-cyan-200' },
];

const STATUS_META = {
  pending: { label: 'Pending', cls: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
  in_progress: { label: 'In Transit', cls: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  completed: { label: 'Done', cls: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  failed: { label: 'Failed', cls: 'bg-rose-100 text-rose-700', dot: 'bg-rose-500' },
};

function getStopAddress(d) {
  return d.delivery_type === 'supplier_collection' ? (d.pickup_address || '') : (d.delivery_address || '');
}

function fmtDuration(mins) {
  if (!mins) return '—';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function DriverDayPlanner() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDriver, setSelectedDriver] = useState('');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reordering, setReordering] = useState(null);
  const [formData, setFormData] = useState({
    delivery_type: 'site_delivery',
    job_id: '',
    items: '',
    pickup_address: '',
    delivery_address: '',
    contact_name: '',
    contact_phone: '',
    notes: '',
  });

  const { data: allStaff = [], isLoading: staffLoading } = useQuery({
    queryKey: ['planner-staff'],
    queryFn: () => base44.entities.Staff.filter({ is_active: true }),
  });

  const { data: allDeliveries = [] } = useQuery({
    queryKey: ['admin-all-deliveries'],
    queryFn: () => base44.entities.DeliveryLog.list('-scheduled_date', 500),
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['planner-jobs'],
    queryFn: () => base44.entities.Job.list(),
  });

  // Drivers who have deliveries assigned, plus all active staff as options
  const driverOptions = useMemo(() => {
    const driverIds = new Set(allDeliveries.map(d => d.driver_staff_id).filter(Boolean));
    const driversWithDeliveries = allStaff.filter(s => driverIds.has(s.id));
    const otherStaff = allStaff.filter(s => !driverIds.has(s.id));
    return { driversWithDeliveries, otherStaff };
  }, [allDeliveries, allStaff]);

  // Filter deliveries for the selected driver + date
  const dayDeliveries = useMemo(() => {
    if (!selectedDriver || !selectedDate) return [];
    return allDeliveries
      .filter(d => d.driver_staff_id === selectedDriver && d.scheduled_date === selectedDate)
      .sort((a, b) => {
        const aIdx = a.optimized_sequence_index;
        const bIdx = b.optimized_sequence_index;
        if (aIdx != null && bIdx != null) return aIdx - bIdx;
        if (aIdx != null) return -1;
        if (bIdx != null) return 1;
        return new Date(a.created_date || 0) - new Date(b.created_date || 0);
      });
  }, [allDeliveries, selectedDriver, selectedDate]);

  const activeStops = dayDeliveries.filter(d => d.status === 'pending' || d.status === 'in_progress');
  const completedStops = dayDeliveries.filter(d => d.status === 'completed');
  const totalDuration = dayDeliveries.reduce((sum, d) => sum + (d.leg_duration_minutes || 0), 0);
  const totalDistance = dayDeliveries.reduce((sum, d) => sum + (d.leg_distance_miles || 0), 0);
  const lastEta = dayDeliveries.length > 0 ? dayDeliveries[dayDeliveries.length - 1].optimized_eta : null;
  const selectedDriverName = allStaff.find(s => s.id === selectedDriver)?.name || '';
  const isOptimized = dayDeliveries.some(d => d.route_optimized_at);

  const handleAddStop = async (e) => {
    e.preventDefault();
    if (!selectedDriver || !selectedDate) return;
    setSaving(true);
    try {
      const driver = allStaff.find(s => s.id === selectedDriver);
      const job = jobs.find(j => j.id === formData.job_id);
      await base44.entities.DeliveryLog.create({
        driver_staff_id: selectedDriver,
        driver_staff_name: driver?.name || '',
        job_id: formData.job_id || '',
        job_name: job?.name || '',
        delivery_type: formData.delivery_type,
        status: 'pending',
        items: formData.items,
        pickup_address: formData.pickup_address,
        delivery_address: formData.delivery_address,
        contact_name: formData.contact_name,
        contact_phone: formData.contact_phone,
        scheduled_date: selectedDate,
        notes: formData.notes,
        chargeable: formData.delivery_type !== 'item_handover',
      });
      queryClient.invalidateQueries({ queryKey: ['admin-all-deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['my-deliveries'] });
      toast({ title: 'Stop added', description: `${STOP_TYPES.find(t => t.value === formData.delivery_type)?.label} for ${driver?.name || 'driver'}` });
      setFormData({ delivery_type: 'site_delivery', job_id: '', items: '', pickup_address: '', delivery_address: '', contact_name: '', contact_phone: '', notes: '' });
      setShowAddForm(false);
    } catch (err) {
      console.error('Add stop error:', err);
      toast({ title: 'Could not add stop', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleDeleteStop = async (id) => {
    if (!confirm('Remove this stop from the driver\'s day?')) return;
    try {
      await base44.entities.DeliveryLog.delete(id);
      queryClient.invalidateQueries({ queryKey: ['admin-all-deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['my-deliveries'] });
      toast({ title: 'Stop removed' });
    } catch (err) {
      toast({ title: 'Could not remove stop', variant: 'destructive' });
    }
  };

  const handleMoveStop = async (id, direction) => {
    const idx = dayDeliveries.findIndex(d => d.id === id);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= dayDeliveries.length) return;
    const a = dayDeliveries[idx];
    const b = dayDeliveries[swapIdx];
    setReordering(id);
    try {
      await base44.entities.DeliveryLog.bulkUpdate([
        { id: a.id, optimized_sequence_index: swapIdx + 1 },
        { id: b.id, optimized_sequence_index: idx + 1 },
      ]);
      queryClient.invalidateQueries({ queryKey: ['admin-all-deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['my-deliveries'] });
    } catch (err) {
      toast({ title: 'Could not reorder', variant: 'destructive' });
    }
    setReordering(null);
  };

  const handleOptimized = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['admin-all-deliveries'] });
    queryClient.invalidateQueries({ queryKey: ['my-deliveries'] });
  }, [queryClient]);

  return (
    <div className="space-y-4">
      {/* Planner header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl stat-gradient-emerald flex items-center justify-center">
            <Navigation className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Driver Day Planner</h2>
            <p className="text-xs text-slate-500">Plan a driver's whole day — drops, collections & handovers in one ordered list</p>
          </div>
        </div>

        {/* Driver + Date selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Driver</label>
            <select value={selectedDriver} onChange={e => setSelectedDriver(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 bg-white">
              <option value="">Select driver…</option>
              {driverOptions.driversWithDeliveries.length > 0 && (
                <optgroup label="With deliveries assigned">
                  {driverOptions.driversWithDeliveries.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </optgroup>
              )}
              {driverOptions.otherStaff.length > 0 && (
                <optgroup label="All active staff">
                  {driverOptions.otherStaff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </optgroup>
              )}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Date</label>
            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
          </div>
        </div>
      </div>

      {!selectedDriver ? (
        <div className="bg-white rounded-2xl border border-slate-200">
          <EmptyState icon={Navigation} title="Select a driver to plan their day" message="Pick a driver and date above to see and organise all their stops." />
        </div>
      ) : (
        <>
          {/* Day summary bar */}
          {dayDeliveries.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-3.5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg stat-gradient-amber flex items-center justify-center">
                    <Calendar className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{selectedDriverName}'s Day</p>
                    <p className="text-sm font-bold text-slate-900">{format(parseISO(selectedDate), 'EEE dd MMM yyyy')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-right">
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase">Stops</p>
                    <p className="text-sm font-bold text-slate-800 tabular-nums">{dayDeliveries.length}</p>
                  </div>
                  <div className="w-px h-8 bg-slate-200" />
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase">Drive</p>
                    <p className="text-sm font-bold text-slate-800 tabular-nums">{fmtDuration(totalDuration)}</p>
                  </div>
                  <div className="w-px h-8 bg-slate-200" />
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase">Distance</p>
                    <p className="text-sm font-bold text-slate-800 tabular-nums">{totalDistance.toFixed(1)} mi</p>
                  </div>
                  {lastEta && (
                    <>
                      <div className="w-px h-8 bg-slate-200" />
                      <div>
                        <p className="text-[10px] font-semibold text-slate-400 uppercase">Finish ETA</p>
                        <p className="text-sm font-bold text-emerald-700 tabular-nums">{format(new Date(lastEta), 'HH:mm')}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
              {/* Status pills */}
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> {activeStops.length} Active
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="w-3 h-3" /> {completedStops.length} Done
                </span>
                {isOptimized && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-700">
                    <Sparkles className="w-3 h-3" /> Route optimised
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Route optimize bar */}
          {activeStops.length >= 2 && (
            <RouteOptimizeBar driverStaffId={selectedDriver} date={selectedDate} count={activeStops.length} onOptimized={handleOptimized} />
          )}

          {/* Add stop button */}
          <button onClick={() => setShowAddForm(s => !s)}
            className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 active:scale-[0.98] transition shadow-sm">
            <Plus className="w-4 h-4" /> Add Stop to {selectedDriverName}'s Day
          </button>

          {/* Quick add form */}
          {showAddForm && (
            <form onSubmit={handleAddStop} className="bg-white rounded-2xl border border-emerald-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-slate-900">New Stop</p>
                <button type="button" onClick={() => setShowAddForm(false)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              {/* Stop type chips */}
              <div className="flex flex-wrap gap-2">
                {STOP_TYPES.map(t => (
                  <button key={t.value} type="button" onClick={() => setFormData(p => ({ ...p, delivery_type: t.value }))}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition ${formData.delivery_type === t.value ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    <t.icon className="w-3.5 h-3.5" /> {t.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Job (optional)</label>
                  <select value={formData.job_id} onChange={e => setFormData(p => ({ ...p, job_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500 bg-white">
                    <option value="">No specific job</option>
                    {jobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
                  </select>
                </div>
                {formData.delivery_type === 'supplier_collection' ? (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Collection Address *</label>
                    <input type="text" required value={formData.pickup_address} onChange={e => setFormData(p => ({ ...p, pickup_address: e.target.value }))}
                      placeholder="Supplier yard / depot address" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500" />
                  </div>
                ) : (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Delivery Address *</label>
                    <input type="text" required value={formData.delivery_address} onChange={e => setFormData(p => ({ ...p, delivery_address: e.target.value }))}
                      placeholder="Site address or handover location" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500" />
                  </div>
                )}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Items</label>
                  <input type="text" value={formData.items} onChange={e => setFormData(p => ({ ...p, items: e.target.value }))}
                    placeholder="What's being moved (e.g. 'Rig parts, casing')" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Contact Name</label>
                  <input type="text" value={formData.contact_name} onChange={e => setFormData(p => ({ ...p, contact_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Contact Phone</label>
                  <input type="text" value={formData.contact_phone} onChange={e => setFormData(p => ({ ...p, contact_phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                  <textarea value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} rows={2}
                    placeholder="Access instructions, timing constraints…" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500 resize-none" />
                </div>
              </div>
              <button type="submit" disabled={saving}
                className="w-full inline-flex items-center justify-center gap-2 py-3 bg-emerald-700 text-white rounded-xl font-bold text-sm hover:bg-emerald-800 disabled:opacity-60 active:scale-95 transition">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {saving ? 'Adding…' : 'Add to Day Plan'}
              </button>
            </form>
          )}

          {/* Ordered stop list */}
          {dayDeliveries.length === 0 && !showAddForm ? (
            <div className="bg-white rounded-2xl border border-slate-200">
              <EmptyState icon={Navigation} title="No stops planned yet" message={`Add the first stop for ${selectedDriverName} on ${format(parseISO(selectedDate), 'dd MMM')}.`} />
            </div>
          ) : (
            <div className="space-y-2">
              {dayDeliveries.map((d, idx) => {
                const type = STOP_TYPES.find(t => t.value === d.delivery_type) || STOP_TYPES[0];
                const status = STATUS_META[d.status] || STATUS_META.pending;
                const addr = getStopAddress(d);
                const job = jobs.find(j => j.id === d.job_id);
                const isCompleted = d.status === 'completed';
                const isFirst = idx === 0;
                const isLast = idx === dayDeliveries.length - 1;
                return (
                  <div key={d.id} className={`bg-white rounded-xl border ${isCompleted ? 'border-slate-100 opacity-75' : 'border-slate-200'} overflow-hidden transition hover:shadow-sm`}>
                    <div className="flex items-stretch">
                      {/* Sequence number */}
                      <div className={`flex flex-col items-center justify-center px-3 ${type.dot} text-white min-w-[48px]`}>
                        <span className="text-lg font-bold tabular-nums">{idx + 1}</span>
                      </div>
                      {/* Content */}
                      <div className="flex-1 p-3 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ring-1 ${type.badge}`}>
                                <type.icon className="w-3 h-3" /> {type.label}
                              </span>
                              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${status.cls}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} /> {status.label}
                              </span>
                              {d.leg_duration_minutes > 0 && !isCompleted && (
                                <span className="text-[10px] text-slate-400 font-medium tabular-nums">
                                  {fmtDuration(d.leg_duration_minutes)} drive
                                </span>
                              )}
                              {d.optimized_eta && !isCompleted && (
                                <span className="text-[10px] text-emerald-600 font-semibold tabular-nums">
                                  ETA {format(new Date(d.optimized_eta), 'HH:mm')}
                                </span>
                              )}
                            </div>
                            {job && <p className="text-sm font-bold text-slate-900 truncate">{job.name}</p>}
                            {addr && (
                              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                <span className="truncate">{addr}</span>
                              </p>
                            )}
                            {d.items && <p className="text-xs text-slate-400 mt-0.5 truncate">{d.items}</p>}
                            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                              {d.contact_name && <span className="text-[11px] text-slate-400 flex items-center gap-1"><User className="w-3 h-3" /> {d.contact_name}</span>}
                              {d.contact_phone && <span className="text-[11px] text-slate-400 flex items-center gap-1"><Phone className="w-3 h-3" /> {d.contact_phone}</span>}
                              {d.handover_to_staff_name && <span className="text-[11px] text-purple-600 font-medium flex items-center gap-1"><ArrowRightLeft className="w-3 h-3" /> → {d.handover_to_staff_name}</span>}
                            </div>
                          </div>
                          {/* Actions */}
                          <div className="flex flex-col gap-1 flex-shrink-0">
                            {!isCompleted && (
                              <>
                                <button onClick={() => handleMoveStop(d.id, 'up')} disabled={isFirst || reordering === d.id}
                                  className="p-1.5 hover:bg-slate-100 rounded-lg disabled:opacity-30 transition" title="Move up">
                                  {reordering === d.id ? <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" /> : <ChevronUp className="w-3.5 h-3.5 text-slate-400" />}
                                </button>
                                <button onClick={() => handleMoveStop(d.id, 'down')} disabled={isLast || reordering === d.id}
                                  className="p-1.5 hover:bg-slate-100 rounded-lg disabled:opacity-30 transition" title="Move down">
                                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                                </button>
                              </>
                            )}
                            <button onClick={() => handleDeleteStop(d.id)}
                              className="p-1.5 hover:bg-rose-50 rounded-lg transition" title="Remove stop">
                              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Completed stops summary */}
          {completedStops.length > 0 && (
            <div className="bg-emerald-50/50 rounded-xl border border-emerald-100 p-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <p className="text-xs font-semibold text-emerald-800">{completedStops.length} stop{completedStops.length !== 1 ? 's' : ''} completed today</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}