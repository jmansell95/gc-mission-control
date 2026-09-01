import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Truck, Plus, X, Package, MapPin, User, Phone, Calendar, FileText, ClipboardList, PoundSterling, Route, ToggleRight, ToggleLeft, AlertTriangle, Boxes, ExternalLink, Weight, FlaskConical, Drill } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import { Skeleton, EmptyState } from '@/components/StateViews';
import { canViewCostings } from '@/utils/access';
import { useAuth } from '@/lib/AuthContext';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const typeOptions = [
  { value: 'site_delivery', label: 'Site Delivery', icon: Truck },
  { value: 'supplier_collection', label: 'Supplier Collection', icon: Package },
  { value: 'item_handover', label: 'Item Handover', icon: ClipboardList },
  { value: 'sample_collection', label: 'Sample Collection', icon: FlaskConical },
  { value: 'sample_delivery', label: 'Sample to Lab', icon: FlaskConical },
];

export default function DeliveryManager({ jobId, jobName }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingDeliveryId, setEditingDeliveryId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    delivery_type: 'site_delivery',
    driver_staff_id: '',
    items: '',
    pickup_address: '',
    delivery_address: '',
    contact_name: '',
    contact_phone: '',
    po_number: '',
    scheduled_date: format(new Date(), 'yyyy-MM-dd'),
    vehicle_id: '',
    notes: '',
    chargeable: true,
    miles: '',
    billing_rule_id: '',
    weight_kg: '',
    volume_m3: '',
    linked_cost_item_ids: [],
    linked_rig_ids: []
  });

  const { data: deliveries = [], isLoading } = useQuery({
    queryKey: ['job-deliveries', jobId],
    queryFn: async () => {
      const list = await base44.entities.DeliveryLog.filter({ job_id: jobId });
      return list.sort((a, b) => new Date(b.scheduled_date) - new Date(a.scheduled_date));
    },
    enabled: !!jobId
  });

  const { data: staff = [] } = useQuery({ queryKey: ['delivery-staff'], queryFn: () => base44.entities.Staff.filter({ is_active: true }) });
  const { data: vehicles = [] } = useQuery({ queryKey: ['delivery-vehicles-mgr'], queryFn: () => base44.entities.Vehicle.list() });
  const { data: rigs = [] } = useQuery({ queryKey: ['delivery-rigs-mgr'], queryFn: () => base44.entities.SiteAsset.filter({ is_rig: true, is_active: true }) });
  const { data: billingRules = [] } = useQuery({ queryKey: ['billing-rules-delivery'], queryFn: () => base44.entities.BillingRule.filter({ rule_type: 'delivery', is_active: true }) });
  const { data: profile } = useQuery({ queryKey: ['my-staff-profile'], queryFn: async () => { const res = await base44.functions.invoke('getMyStaffProfile'); return res.data; } });
  // Show cost-gated content while the profile is loading or errored (published
  // site edge cases); enforce the real role gate once the profile resolves.
  const { user: authUser } = useAuth();
  const isPlatformAdmin = authUser?.role === 'admin';
  const canSeeCosts = !profile || canViewCostings(profile, isPlatformAdmin);
  const { data: job } = useQuery({ queryKey: ['job-for-delivery', jobId], queryFn: async () => { if (!jobId) return null; try { return await base44.entities.Job.get(jobId); } catch { return null; } }, enabled: !!jobId });
  const { data: costItems = [] } = useQuery({ queryKey: ['job-cost-items-delivery', jobId], queryFn: async () => { if (!jobId) return []; return await base44.entities.JobCostItem.filter({ job_id: jobId }); }, enabled: !!jobId });

  const isFirstSiteDelivery = formData.delivery_type === 'site_delivery' && !deliveries.some(d => d.delivery_type === 'site_delivery');

  const selectedVehicle = vehicles.find(v => v.id === formData.vehicle_id);
  const sameLoadDeliveries = deliveries.filter(d => d.vehicle_id === formData.vehicle_id && d.scheduled_date === formData.scheduled_date && d.id !== editingDeliveryId);
  const formWeight = formData.weight_kg === '' ? 0 : (parseFloat(formData.weight_kg) || 0);
  const formVolume = formData.volume_m3 === '' ? 0 : (parseFloat(formData.volume_m3) || 0);
  const totalLoadWeight = sameLoadDeliveries.reduce((sum, d) => sum + (Number(d.weight_kg) || 0), 0) + formWeight;
  const totalLoadVolume = sameLoadDeliveries.reduce((sum, d) => sum + (Number(d.volume_m3) || 0), 0) + formVolume;
  const isOverWeight = selectedVehicle?.max_weight_kg && totalLoadWeight > selectedVehicle.max_weight_kg;
  const isOverVolume = selectedVehicle?.max_volume_m3 && totalLoadVolume > selectedVehicle.max_volume_m3;

  const toggleGroup = (item) => {
    const ids = formData.linked_cost_item_ids || [];
    const isSelected = ids.includes(item.id);
    const newIds = isSelected ? ids.filter(id => id !== item.id) : [...ids, item.id];
    const desc = item.description || '';
    const parts = (formData.items || '').split(',').map(s => s.trim()).filter(Boolean);
    let newItems;
    if (isSelected) {
      newItems = parts.filter(p => p !== desc).join(', ');
    } else {
      if (!parts.includes(desc)) parts.push(desc);
      newItems = parts.join(', ');
    }
    setFormData(p => ({ ...p, linked_cost_item_ids: newIds, items: newItems }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.driver_staff_id || !formData.scheduled_date) {
      toast({ title: 'Missing details', description: 'Please select a driver and date.' });
      return;
    }
    setSaving(true);
    try {
      const driver = staff.find(s => s.id === formData.driver_staff_id);
      const payload = {
        ...formData,
        job_id: jobId,
        job_name: jobName || '',
        driver_staff_name: driver?.name || '',
        miles: formData.miles === '' ? 0 : parseFloat(formData.miles),
        chargeable: formData.delivery_type === 'item_handover' ? false : !!formData.chargeable,
        billing_rule_id: formData.billing_rule_id || '',
        weight_kg: formData.weight_kg === '' ? 0 : parseFloat(formData.weight_kg),
        volume_m3: formData.volume_m3 === '' ? 0 : parseFloat(formData.volume_m3),
        linked_cost_item_ids: Array.isArray(formData.linked_cost_item_ids) ? formData.linked_cost_item_ids.join(',') : '',
        linked_rig_ids: Array.isArray(formData.linked_rig_ids) ? formData.linked_rig_ids.join(',') : ''
      };
      let savedId = editingDeliveryId;
      if (editingDeliveryId) {
        await base44.entities.DeliveryLog.update(editingDeliveryId, payload);
        toast({ title: 'Delivery task updated', description: `${driver?.name || 'Driver'} · ${format(new Date(formData.scheduled_date + 'T00:00:00'), 'dd MMM')}.` });
      } else {
        payload.status = 'pending';
        const created = await base44.entities.DeliveryLog.create(payload);
        savedId = created.id;
        toast({ title: 'Delivery task created', description: `${driver?.name || 'Driver'} assigned for ${format(new Date(formData.scheduled_date + 'T00:00:00'), 'dd MMM')}.` });
      }
      // Calculate charge via backend function
      try {
        const res = await base44.functions.invoke('calculateCharge', {
          entity_type: 'delivery',
          billing_rule_id: formData.billing_rule_id || undefined,
          miles: payload.miles,
          chargeable: payload.chargeable
        });
        const cd = res.data;
        if (cd && savedId) {
          await base44.entities.DeliveryLog.update(savedId, {
            charge_amount: cd.charge_amount || 0,
            charge_breakdown: JSON.stringify(cd.breakdown || {}),
            billing_status: cd.billing_status || 'auto',
            billing_rule_id: cd.billing_rule_id || ''
          });
        }
      } catch (calcErr) { console.error('Charge calc error:', calcErr); }
      // Auto-update linked cost item locations
      const linkedIds = Array.isArray(formData.linked_cost_item_ids) ? formData.linked_cost_item_ids : [];
      if (linkedIds.length > 0 && savedId) {
        const newLocation = formData.delivery_type === 'supplier_collection' ? 'in_transit' : 'in_transit';
        try {
          await base44.entities.JobCostItem.bulkUpdate(
            linkedIds.map(id => ({ id, current_location: newLocation, location_updated_at: new Date().toISOString() }))
          );
          queryClient.invalidateQueries({ queryKey: ['job-cost-items-manifest', jobId] });
          queryClient.invalidateQueries({ queryKey: ['job-cost-items', jobId] });
        } catch (e) { console.error('Item location update error:', e); }
      }
      queryClient.invalidateQueries({ queryKey: ['job-deliveries', jobId] });
      setFormData({
        delivery_type: 'site_delivery',
        driver_staff_id: '',
        items: '',
        pickup_address: '',
        delivery_address: '',
        contact_name: '',
        contact_phone: '',
        po_number: '',
        scheduled_date: format(new Date(), 'yyyy-MM-dd'),
        vehicle_id: '',
        notes: '',
        chargeable: true,
        miles: '',
        billing_rule_id: '',
        weight_kg: '',
        volume_m3: '',
        linked_cost_item_ids: [],
        linked_rig_ids: []
      });
      setEditingDeliveryId(null);
      setShowForm(false);
    } catch (err) {
      console.error('Error creating delivery:', err);
      toast({ title: 'Error', description: 'Could not create delivery task.' });
    } finally {
      setSaving(false);
    }
  };

  const handleEditDelivery = (d) => {
    setFormData({
      delivery_type: d.delivery_type || 'site_delivery',
      driver_staff_id: d.driver_staff_id || '',
      items: d.items || '',
      pickup_address: d.pickup_address || '',
      delivery_address: d.delivery_address || '',
      contact_name: d.contact_name || '',
      contact_phone: d.contact_phone || '',
      po_number: d.po_number || '',
      scheduled_date: d.scheduled_date || format(new Date(), 'yyyy-MM-dd'),
      vehicle_id: d.vehicle_id || '',
      notes: d.notes || '',
      chargeable: d.chargeable !== false,
      miles: d.miles != null ? String(d.miles) : '',
      billing_rule_id: d.billing_rule_id || '',
      weight_kg: d.weight_kg != null ? String(d.weight_kg) : '',
      volume_m3: d.volume_m3 != null ? String(d.volume_m3) : '',
      linked_cost_item_ids: d.linked_cost_item_ids ? d.linked_cost_item_ids.split(',').filter(Boolean) : [],
      linked_rig_ids: d.linked_rig_ids ? d.linked_rig_ids.split(',').filter(Boolean) : []
    });
    setEditingDeliveryId(d.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this delivery task?')) return;
    try {
      await base44.entities.DeliveryLog.delete(id);
      queryClient.invalidateQueries({ queryKey: ['job-deliveries', jobId] });
      toast({ title: 'Delivery deleted' });
    } catch (e) {
      toast({ title: 'Error', description: 'Could not delete.' });
    }
  };

  const typeBadge = {
    site_delivery: 'bg-emerald-100 text-emerald-700',
    supplier_collection: 'bg-blue-100 text-blue-700',
    item_handover: 'bg-purple-100 text-purple-700',
    sample_collection: 'bg-teal-100 text-teal-700',
    sample_delivery: 'bg-cyan-100 text-cyan-700',
  };

  const statusBadge = {
    pending: 'bg-slate-100 text-slate-600',
    in_progress: 'bg-blue-50 text-blue-700',
    completed: 'bg-emerald-50 text-emerald-700',
    failed: 'bg-red-50 text-red-700'
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Truck className="w-5 h-5 text-emerald-600" />
          <h3 className="font-bold text-slate-900">Deliveries & Collections</h3>
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700">{deliveries.length}</span>
        </div>
        <button
          onClick={() => { setEditingDeliveryId(null); setShowForm(s => !s); }}
          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 text-sm font-semibold transition active:scale-95"
        >
          {showForm ? <><X className="w-4 h-4" /> Cancel</> : <><Plus className="w-4 h-4" /> New Task</>}
        </button>
      </div>

      {/* New / edit delivery form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">{editingDeliveryId ? 'Editing delivery task' : 'New delivery task'}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Delivery Type</label>
              <select value={formData.delivery_type} onChange={e => setFormData(p => ({ ...p, delivery_type: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600">
                {typeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Driver</label>
              <select value={formData.driver_staff_id} onChange={e => setFormData(p => ({ ...p, driver_staff_id: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600">
                <option value="">Select driver…</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Scheduled Date</label>
              <input type="date" value={formData.scheduled_date} onChange={e => setFormData(p => ({ ...p, scheduled_date: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Vehicle</label>
              <select value={formData.vehicle_id} onChange={e => setFormData(p => ({ ...p, vehicle_id: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600">
                <option value="">No vehicle</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.registration_number})</option>)}
              </select>
            </div>
          </div>
          {isFirstSiteDelivery && job?.requisition_list_url && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-blue-700">First delivery to site — check the requisition list</p>
                <p className="text-[10px] text-blue-500 truncate">{job.requisition_list_name || 'Requisition list'}</p>
              </div>
              <a href={job.requisition_list_url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-0.5 flex-shrink-0">
                View <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Items</label>
            <textarea value={formData.items} onChange={e => setFormData(p => ({ ...p, items: e.target.value }))} rows={2} placeholder="e.g. 2x Excavator, 1x Transformer, 50m Heras fencing"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 resize-none" />
          </div>
          {costItems.filter(ci => ci.category !== 'contractor_supplied').length > 0 && (
            <div>
              <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1"><Boxes className="w-3 h-3" /> Material Groups (from job)</label>
              <div className="flex flex-wrap gap-1.5">
                {costItems.filter(ci => ci.category !== 'contractor_supplied').map(item => {
                  const isSelected = (formData.linked_cost_item_ids || []).includes(item.id);
                  return (
                    <button key={item.id} type="button" onClick={() => toggleGroup(item)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${isSelected ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
                      {item.description}{item.quantity > 1 ? ` ×${item.quantity}` : ''}
                    </button>
                  );
                })}
              </div>
              {costItems.some(ci => ci.category === 'contractor_supplied') && (
                <p className="text-[10px] text-slate-400 mt-1.5">Contractor-supplied items are hidden — the contractor delivers those directly.</p>
              )}
            </div>
          )}
          {rigs.length > 0 && (formData.delivery_type === 'site_delivery' || formData.delivery_type === 'supplier_delivery' || formData.delivery_type === 'supplier_collection') && (
            <div>
              <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1"><Drill className="w-3 h-3" /> Rigs on this delivery</label>
              <p className="text-[10px] text-slate-400 mb-1.5">Link the rig(s) being moved so sign-off stamps them on-site (delivery) or releases them back to the yard (collection).</p>
              <div className="flex flex-wrap gap-1.5">
                {rigs.map(r => {
                  const isSelected = (formData.linked_rig_ids || []).includes(r.id);
                  return (
                    <button key={r.id} type="button" onClick={() => {
                      const ids = formData.linked_rig_ids || [];
                      const newIds = ids.includes(r.id) ? ids.filter(id => id !== r.id) : [...ids, r.id];
                      setFormData(p => ({ ...p, linked_rig_ids: newIds }));
                    }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${isSelected ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
                      {r.name}{r.rig_type && r.rig_type !== 'n/a' ? ` (${r.rig_type.toUpperCase()})` : ''}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Pickup Address</label>
              <input type="text" value={formData.pickup_address} onChange={e => setFormData(p => ({ ...p, pickup_address: e.target.value }))} placeholder="Supplier yard, depot, etc."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Delivery Address</label>
              <input type="text" value={formData.delivery_address} onChange={e => setFormData(p => ({ ...p, delivery_address: e.target.value }))} placeholder="Site address"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Contact Name</label>
              <input type="text" value={formData.contact_name} onChange={e => setFormData(p => ({ ...p, contact_name: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Contact Phone</label>
              <input type="tel" value={formData.contact_phone} onChange={e => setFormData(p => ({ ...p, contact_phone: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">PO Number</label>
              <input type="text" value={formData.po_number} onChange={e => setFormData(p => ({ ...p, po_number: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Access instructions, timing, etc."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 resize-none" />
          </div>
          {/* Vehicle load — manager only */}
          {canSeeCosts && (
            <div className="border-t border-slate-200 pt-3 space-y-3">
              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide flex items-center gap-1.5"><Weight className="w-3.5 h-3.5" /> Vehicle Load</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1"><Weight className="w-3 h-3" /> Weight (kg)</label>
                  <input type="number" min="0" step="1" value={formData.weight_kg} onChange={e => setFormData(p => ({ ...p, weight_kg: e.target.value }))}
                    placeholder="e.g. 500" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Volume (m³)</label>
                  <input type="number" min="0" step="0.1" value={formData.volume_m3} onChange={e => setFormData(p => ({ ...p, volume_m3: e.target.value }))}
                    placeholder="e.g. 2.5" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
                </div>
              </div>
              {selectedVehicle && (selectedVehicle.max_weight_kg || selectedVehicle.max_volume_m3) && (
                <div className={`rounded-lg p-2.5 text-xs flex items-center gap-2 ${(isOverWeight || isOverVolume) ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                  {(isOverWeight || isOverVolume) ? <AlertTriangle className="w-4 h-4 flex-shrink-0" /> : <Weight className="w-4 h-4 flex-shrink-0" />}
                  <div>
                    {selectedVehicle.max_weight_kg && (
                      <span className="font-semibold">{Math.round(totalLoadWeight)} / {selectedVehicle.max_weight_kg} kg</span>
                    )}
                    {selectedVehicle.max_weight_kg && selectedVehicle.max_volume_m3 && <span> · </span>}
                    {selectedVehicle.max_volume_m3 && (
                      <span className="font-semibold">{totalLoadVolume.toFixed(1)} / {selectedVehicle.max_volume_m3} m³</span>
                    )}
                    {sameLoadDeliveries.length > 0 && <span className="text-slate-400"> (incl. {sameLoadDeliveries.length} other task{sameLoadDeliveries.length > 1 ? 's' : ''})</span>}
                    {isOverWeight && <span className="font-bold"> · Over weight by {Math.round(totalLoadWeight - selectedVehicle.max_weight_kg)} kg!</span>}
                    {isOverVolume && <span className="font-bold"> · Over volume by {(totalLoadVolume - selectedVehicle.max_volume_m3).toFixed(1)} m³!</span>}
                  </div>
                </div>
              )}
              {formData.delivery_type === 'item_handover' && (
                <p className="text-xs text-slate-500 flex items-center gap-1.5"><PoundSterling className="w-3.5 h-3.5" /> Internal handover — not chargeable to client</p>
              )}
            </div>
          )}

          {/* Billing section — restricted to admins and managers */}
          {canSeeCosts && formData.delivery_type !== 'item_handover' && (
            <div className="border-t border-slate-200 pt-3 space-y-3">
              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide flex items-center gap-1.5"><PoundSterling className="w-3.5 h-3.5" /> Client Billing</p>
              <button type="button" onClick={() => setFormData(p => ({ ...p, chargeable: !p.chargeable }))}
                className="flex items-center gap-2 text-sm w-full">
                {formData.chargeable ? <ToggleRight className="w-7 h-7 text-emerald-600 flex-shrink-0" /> : <ToggleLeft className="w-7 h-7 text-slate-300 flex-shrink-0" />}
                <span className={formData.chargeable ? 'text-slate-700 font-medium' : 'text-slate-400'}>
                  {formData.chargeable ? 'Charge client for this visit' : 'No charge (goodwill / free visit)'}
                </span>
              </button>
              {formData.chargeable && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1"><Route className="w-3 h-3" /> Miles (round-trip)</label>
                    <input type="number" min="0" step="0.1" value={formData.miles} onChange={e => setFormData(p => ({ ...p, miles: e.target.value }))}
                      placeholder="e.g. 25" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Billing Rule</label>
                    <select value={formData.billing_rule_id} onChange={e => setFormData(p => ({ ...p, billing_rule_id: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600">
                      <option value="">Auto (no specific rule)</option>
                      {billingRules.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}
          <button type="submit" disabled={saving}
            className="w-full py-2.5 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700 transition active:scale-95 disabled:opacity-50">
            {saving ? 'Saving…' : editingDeliveryId ? 'Update Delivery Task' : 'Create Delivery Task'}
          </button>
        </form>
      )}

      {/* Delivery list */}
      {isLoading ? (
        <Skeleton className="h-24 w-full rounded-xl" />
      ) : deliveries.length === 0 ? (
        <div className="bg-slate-50 rounded-xl border border-slate-200">
          <EmptyState icon={Truck} title="No deliveries yet" message="Create a delivery task to assign it to a driver." />
        </div>
      ) : (
        <div className="space-y-2">
          {deliveries.map(d => (
            <div key={d.id} className="bg-white rounded-xl border border-slate-200 p-3.5 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${typeBadge[d.delivery_type] || typeBadge.site_delivery}`}>
                    {typeOptions.find(t => t.value === d.delivery_type)?.label || d.delivery_type}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${statusBadge[d.status] || statusBadge.pending}`}>
                    {d.status}
                  </span>
                  {d.synced_from_offline && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-amber-50 text-amber-600">offline</span>
                  )}
                </div>
                <p className="text-sm font-semibold text-slate-900 truncate">{d.items || 'No items listed'}</p>
                <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-400">
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{format(new Date(d.scheduled_date + 'T00:00:00'), 'dd MMM')}</span>
                  <span>·</span>
                  <span>{d.driver_staff_name || 'Unassigned'}</span>
                  {d.delivery_address && <><span>·</span><span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{d.delivery_address.substring(0, 30)}{d.delivery_address.length > 30 ? '…' : ''}</span></>}
                </div>
                {d.signed_by_name && d.status === 'completed' && (
                  <p className="text-xs text-emerald-600 mt-1">Signed by {d.signed_by_name} · {d.completed_at ? format(new Date(d.completed_at), 'dd MMM HH:mm') : ''}</p>
                )}
                {canSeeCosts && d.chargeable && Number(d.charge_amount) > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 mt-1">
                    <PoundSterling className="w-2.5 h-2.5" /> {fmt(Number(d.charge_amount))}
                  </span>
                )}
                {canSeeCosts && d.chargeable === false && (
                  <span className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-400 mt-1">No charge</span>
                )}
                {canSeeCosts && Number(d.weight_kg) > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold bg-blue-50 text-blue-700 border border-blue-200 mt-1">
                    <Weight className="w-2.5 h-2.5" /> {Math.round(Number(d.weight_kg))} kg
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1.5 items-end flex-shrink-0">
                <button onClick={() => handleEditDelivery(d)} className="text-xs text-blue-500 hover:text-blue-700 font-medium">
                  Edit
                </button>
                {d.status === 'pending' && (
                  <button onClick={() => handleDelete(d.id)} className="text-xs text-red-400 hover:text-red-600 font-medium">
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}