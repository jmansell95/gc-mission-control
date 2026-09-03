import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FlaskConical, Truck, X, CheckCircle2, Loader2, MapPin, Package, User, Link2, ArrowRight } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';

/**
 * SampleRunDrawer — lives in the Delivery Hub. Opens pre-loaded with
 * eligible samples passed from the Geotech tab via router state.
 *
 * Auto-chains TWO linked DeliveryLog tasks (collection + delivery),
 * preserving the two-leg chaining concept from the old modal.
 */
export default function SampleRunDrawer({ prefill, onClose }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  // Fetch samples for the job so we can show the full checklist
  const { data: samples = [] } = useQuery({
    queryKey: ['samples-for-job', prefill.jobId],
    queryFn: () => base44.entities.Sample.filter({ job_id: prefill.jobId }, '-collection_date'),
    enabled: !!prefill.jobId,
  });

  const { data: allStaff = [] } = useQuery({
    queryKey: ['delivery-staff-active'],
    queryFn: () => base44.entities.Staff.filter({ is_active: true }),
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-for-labs'],
    queryFn: () => base44.entities.Supplier.list(),
  });

  // Fetch existing sample deliveries to mark already-scheduled samples
  const { data: sampleDeliveries = [] } = useQuery({
    queryKey: ['sample-deliveries-for-job', prefill.jobId],
    queryFn: () => base44.entities.DeliveryLog.filter({ job_id: prefill.jobId }, '-scheduled_date'),
    enabled: !!prefill.jobId,
  });

  const scheduledSampleIds = useMemo(() => {
    const set = new Set();
    sampleDeliveries.forEach(d => {
      if ((d.delivery_type === 'sample_collection' || d.delivery_type === 'sample_delivery') && d.sample_ids) {
        d.sample_ids.split(',').map(id => id.trim()).filter(Boolean).forEach(id => set.add(id));
      }
    });
    return set;
  }, [sampleDeliveries]);

  // Pre-select the samples passed from the geotech tab
  const prefillIds = prefill.sampleIds || [];
  const [selectedIds, setSelectedIds] = useState(() => {
    // Match prefill sampleIds to actual Sample records
    return samples.filter(s => prefillIds.includes(s.id)).map(s => s.id);
  });

  // Re-sync once samples load (they may not be ready on first render)
  useEffect(() => {
    if (samples.length > 0 && selectedIds.length === 0 && prefillIds.length > 0) {
      setSelectedIds(samples.filter(s => prefillIds.includes(s.id)).map(s => s.id));
    }
  }, [samples, prefillIds, selectedIds.length]);

  const [driverId, setDriverId] = useState('');
  const [collectionDate, setCollectionDate] = useState(new Date().toISOString().slice(0, 10));
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().slice(0, 10));
  const [labId, setLabId] = useState('');
  const [pickupAddress, setPickupAddress] = useState(prefill.pickupAddress || '');
  const [transferPoint, setTransferPoint] = useState('Ground Control Depot');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [notes, setNotes] = useState('');

  const drivers = allStaff.filter(s => s.is_active !== false);
  const labs = suppliers.filter(s => s.name?.match(/lab|geol|soil|test|analy/i));
  const labOptions = labs.length > 0 ? labs : suppliers;

  const toggleSample = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleLabChange = (id) => {
    setLabId(id);
    const lab = suppliers.find(s => s.id === id);
    if (lab) {
      setDeliveryAddress(lab.name ? `${lab.name}${lab.yard_address ? ', ' + lab.yard_address : ''}` : '');
      setContactName(lab.contact_name || '');
      setContactPhone(lab.contact_phone || '');
    }
  };

  const canSubmit = selectedIds.length > 0 && driverId && collectionDate && deliveryDate && pickupAddress && deliveryAddress;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const driver = drivers.find(s => s.id === driverId);
      const sampleIdList = selectedIds.join(',');
      const selectedSamples = samples.filter(s => selectedIds.includes(s.id));
      const itemsList = selectedSamples.map(s => `${s.sample_id}${s.borehole_ref ? ' (' + s.borehole_ref + ')' : ''}`).join(', ');
      const sharedItems = `Samples: ${itemsList}`;

      // Leg 1 — collect samples from site
      const collectionTask = await base44.entities.DeliveryLog.create({
        job_id: prefill.jobId,
        job_name: prefill.jobName || '',
        driver_staff_id: driverId,
        driver_staff_name: driver?.name || '',
        delivery_type: 'sample_collection',
        status: 'pending',
        items: sharedItems,
        sample_ids: sampleIdList,
        samples_accounted: false,
        pickup_address: pickupAddress || '',
        delivery_address: transferPoint || 'Ground Control Depot',
        contact_name: '',
        contact_phone: '',
        scheduled_date: collectionDate,
        notes: notes || '',
        chargeable: false,
      });

      // Leg 2 — deliver samples to the lab (child, linked back)
      await base44.entities.DeliveryLog.create({
        job_id: prefill.jobId,
        job_name: prefill.jobName || '',
        driver_staff_id: driverId,
        driver_staff_name: driver?.name || '',
        delivery_type: 'sample_delivery',
        status: 'pending',
        items: sharedItems,
        sample_ids: sampleIdList,
        samples_accounted: false,
        pickup_address: transferPoint || 'Ground Control Depot',
        delivery_address: deliveryAddress || '',
        contact_name: contactName || '',
        contact_phone: contactPhone || '',
        scheduled_date: deliveryDate,
        notes: notes || '',
        chargeable: false,
        parent_delivery_id: collectionTask.id,
        handover_from_staff_name: driver?.name || '',
      });

      toast({
        title: 'Sample run scheduled',
        description: `${selectedIds.length} sample${selectedIds.length === 1 ? '' : 's'} — collect → deliver to lab. Both legs assigned to ${driver?.name || 'driver'}.`,
      });
      queryClient.invalidateQueries({ queryKey: ['sample-deliveries-for-job', prefill.jobId] });
      queryClient.invalidateQueries({ queryKey: ['samples-for-job', prefill.jobId] });
      queryClient.invalidateQueries({ queryKey: ['admin-all-deliveries'] });
      onClose();
    } catch (e) {
      toast({ title: 'Error scheduling sample run', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full px-2.5 py-1.5 bg-[#0B1A0B] border border-[#2a3a2a] rounded-lg text-sm text-[#E0E0E0] placeholder-[#5a6a5a] focus:outline-none focus:border-[#FF9F1C]';

  return (
    <Sheet open onOpenChange={onClose}>
      <SheetContent side="right" className="bg-[#121411] border-[#2a3a2a] text-[#E0E0E0] max-w-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-[#E0E0E0]">
            <FlaskConical className="w-5 h-5 text-[#2EFF7D]" />
            Schedule Sample Run
          </SheetTitle>
          <SheetDescription className="flex items-center gap-1.5 text-[#A0A0A0]">
            <Link2 className="w-3.5 h-3.5" /> Creates a linked collection <ArrowRight className="w-3 h-3" /> delivery — both legs tracked on the driver's day plan.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          {/* Sample selection */}
          <div>
            <label className="block text-xs font-semibold text-[#A0A0A0] mb-2">
              Samples to include ({selectedIds.length} selected)
            </label>
            <div className="max-h-48 overflow-y-auto rounded-xl border border-[#2a3a2a] divide-y divide-[#2a3a2a]">
              {samples.filter(s => s.status === 'collected').map(s => {
                const isScheduled = scheduledSampleIds.has(s.sample_id);
                const isSelected = selectedIds.includes(s.id);
                return (
                  <button key={s.id} type="button" onClick={() => !isScheduled && toggleSample(s.id)}
                    disabled={isScheduled}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition ${isSelected ? 'bg-[#2EFF7D]/10' : 'bg-transparent hover:bg-[#1C201C]'} ${isScheduled ? 'opacity-40 cursor-not-allowed' : ''}`}>
                    <input type="checkbox" checked={isSelected} readOnly
                      className="w-4 h-4 accent-[#FF9F1C]" />
                    <div className="min-w-0 flex-1">
                      <span className="font-mono text-sm font-semibold text-[#E0E0E0]">{s.sample_id}</span>
                      <span className="text-xs text-[#A0A0A0] ml-2">
                        {s.borehole_ref && `${s.borehole_ref} · `}
                        {s.depth_from != null && `${s.depth_from}–${s.depth_to}m`}
                      </span>
                    </div>
                    {isScheduled && <span className="text-[10px] text-[#5a6a5a]">already scheduled</span>}
                  </button>
                );
              })}
              {samples.filter(s => s.status === 'collected').length === 0 && (
                <div className="px-3 py-4 text-center text-sm text-[#5a6a5a]">No samples ready for collection.</div>
              )}
            </div>
          </div>

          {/* Driver */}
          <div>
            <label className="block text-xs font-semibold text-[#A0A0A0] mb-1">
              <User className="w-3 h-3 inline mr-1" /> Driver (both legs)
            </label>
            <select value={driverId} onChange={e => setDriverId(e.target.value)}
              className={inputClass}>
              <option value="">Select driver…</option>
              {drivers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* Two-leg visual */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Leg 1 — Collection */}
            <div className="rounded-xl border border-[#00D4FF40] bg-[#00D4FF]/5 p-3 space-y-2.5">
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-[#00D4FF] text-[#0B1A0B] text-[10px] font-bold flex items-center justify-center">1</span>
                <Package className="w-3.5 h-3.5 text-[#00D4FF]" />
                <span className="text-xs font-bold text-[#00D4FF] uppercase tracking-wide">Collect from site</span>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[#5a6a5a] mb-0.5">Date</label>
                <input type="date" value={collectionDate} onChange={e => setCollectionDate(e.target.value)}
                  className={inputClass} />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[#5a6a5a] mb-0.5"><MapPin className="w-2.5 h-2.5 inline mr-0.5" />Pickup (site)</label>
                <input value={pickupAddress} onChange={e => setPickupAddress(e.target.value)}
                  placeholder="Site address"
                  className={inputClass} />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[#5a6a5a] mb-0.5">Drop to (transfer point)</label>
                <input value={transferPoint} onChange={e => setTransferPoint(e.target.value)}
                  placeholder="Ground Control Depot"
                  className={inputClass} />
              </div>
            </div>

            {/* Leg 2 — Delivery */}
            <div className="rounded-xl border border-[#2EFF7D40] bg-[#2EFF7D]/5 p-3 space-y-2.5">
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-[#2EFF7D] text-[#0B1A0B] text-[10px] font-bold flex items-center justify-center">2</span>
                <Truck className="w-3.5 h-3.5 text-[#2EFF7D]" />
                <span className="text-xs font-bold text-[#2EFF7D] uppercase tracking-wide">Deliver to lab</span>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[#5a6a5a] mb-0.5">Date</label>
                <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)}
                  min={collectionDate}
                  className={inputClass} />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[#5a6a5a] mb-0.5"><FlaskConical className="w-2.5 h-2.5 inline mr-0.5" />Laboratory</label>
                <select value={labId} onChange={e => handleLabChange(e.target.value)}
                  className={inputClass}>
                  <option value="">Select lab…</option>
                  {labOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[#5a6a5a] mb-0.5"><MapPin className="w-2.5 h-2.5 inline mr-0.5" />Lab address</label>
                <input value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)}
                  placeholder="Lab address"
                  className={inputClass} />
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#A0A0A0] mb-1">Lab contact name</label>
              <input value={contactName} onChange={e => setContactName(e.target.value)}
                className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#A0A0A0] mb-1">Lab contact phone</label>
              <input value={contactPhone} onChange={e => setContactPhone(e.target.value)}
                className={inputClass} />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-[#A0A0A0] mb-1">Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows="2"
              placeholder="Storage requirements, handling instructions, access notes…"
              className={inputClass} />
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-2 border-t border-[#2a3a2a]">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-[#A0A0A0] hover:text-[#E0E0E0]">Cancel</button>
            <button type="button" onClick={handleSubmit} disabled={!canSubmit || saving}
              className="flex items-center gap-2 px-4 py-2 bg-[#FF9F1C] text-[#1a1a1a] rounded-lg text-sm font-semibold hover:brightness-110 disabled:opacity-50 transition">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Schedule Sample Run
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}