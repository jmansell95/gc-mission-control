import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Wrench, PhoneCall, Calendar, Clock, PoundSterling, MapPin, User, Save, Phone, Mail, ExternalLink, Send } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';

const BOOKING_TYPES = [
  { value: 'mot', label: 'MOT' },
  { value: 'service', label: 'Service' },
  { value: 'breakdown', label: 'Breakdown' },
  { value: 'windscreen', label: 'Windscreen' },
  { value: 'tyre_repair', label: 'Tyre Repair' },
  { value: 'repair', label: 'General Repair' },
  { value: 'fuel_card', label: 'Fuel Card' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'risk_master', label: 'Risk Master' },
  { value: 'other', label: 'Other' },
];

const STATUS_OPTIONS = [
  { value: 'requested', label: 'Requested' },
  { value: 'booked', label: 'Booked' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const emptyForm = {
  vehicle_id: '', booking_type: 'mot', status: 'requested',
  booking_date: format(new Date(), 'yyyy-MM-dd'), booking_time: '08:00',
  supplier_id: '', supplier_name: '', supplier_phone: '', location: '',
  assigned_staff_id: '', cost: '', notes: '',
  reported_by_staff_id: '', phone_booking: false,
};

export default function MaintenanceBookingModal({ open, onClose, preselectVehicleId, editingBooking, preselectProvider }) {
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [adminName, setAdminName] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles'], queryFn: () => base44.entities.Vehicle.list(), enabled: open });
  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list(), enabled: open });
  const { data: providers = [] } = useQuery({ queryKey: ['maintenance-providers'], queryFn: () => base44.entities.Supplier.filter({ is_maintenance_provider: true }), enabled: open });

  const handleProviderSelect = (supplierId) => {
    const p = providers.find(s => s.id === supplierId);
    if (!p) { setFormData(prev => ({ ...prev, supplier_id: '', supplier_name: '', supplier_phone: '' })); return; }
    setFormData(prev => ({
      ...prev,
      supplier_id: supplierId,
      supplier_name: p.name,
      supplier_phone: p.emergency_mobile || p.contact_phone || '',
    }));
  };

  const handleSendAlertEmail = () => {
    const provider = providers.find(p => p.id === formData.supplier_id);
    if (!provider?.technical_email) {
      toast({ title: 'No alert email', description: 'This provider has no technical/alert email set.', variant: 'destructive' });
      return;
    }
    const vehicle = vehicles.find(v => v.id === formData.vehicle_id);
    const typeLabel = BOOKING_TYPES.find(t => t.value === formData.booking_type)?.label || formData.booking_type;
    const subject = `Maintenance Request — ${typeLabel.toUpperCase()} — ${vehicle?.registration_number || vehicle?.name || ''}`;
    const body = [
      `Vehicle: ${vehicle?.name || ''} (${vehicle?.registration_number || ''})`,
      `VIN: ${vehicle?.vin || ''}`,
      `Current Mileage: ${vehicle?.current_mileage ? vehicle.current_mileage.toLocaleString() + ' miles' : ''}`,
      `Booking Type: ${typeLabel}`,
      `Preferred Date: ${formData.booking_date} ${formData.booking_time || ''}`,
      `Location: ${formData.location || ''}`,
      `Notes: ${formData.notes || ''}`,
      ``,
      `Please confirm availability.`,
    ].join('\n');
    window.location.href = `mailto:${provider.technical_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    toast({ title: 'Email drafted', description: `Opening your email client for ${provider.technical_email}.` });
  };

  useEffect(() => {
    (async () => {
      try { const res = await base44.functions.invoke('getMyStaffProfile'); setAdminName(res.data?.name || ''); } catch (_) {}
    })();
  }, []);

  useEffect(() => {
    if (open) {
      if (editingBooking) {
        setFormData({ ...emptyForm, ...editingBooking, cost: editingBooking.cost || '', phone_booking: editingBooking.report_source === 'phone_call' });
      } else {
        const preselectVehicle = vehicles.find(v => v.id === preselectVehicleId);
        setFormData({
          ...emptyForm,
          vehicle_id: preselectVehicleId || '',
          phone_booking: true,
          reported_by_staff_id: preselectVehicle?.assigned_staff_id || '',
          supplier_id: preselectProvider?.id || '',
          supplier_name: preselectProvider?.name || '',
          supplier_phone: preselectProvider?.emergency_mobile || preselectProvider?.contact_phone || '',
        });
      }
    }
  }, [open, editingBooking, preselectVehicleId, preselectProvider, vehicles]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.vehicle_id) {
      toast({ title: 'Vehicle required', description: 'Please select a vehicle.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const vehicle = vehicles.find(v => v.id === formData.vehicle_id);
      const assignedStaff = staff.find(s => s.id === formData.assigned_staff_id);
      const reportedByStaff = staff.find(s => s.id === formData.reported_by_staff_id);
      const payload = {
        ...formData,
        cost: formData.cost ? parseFloat(formData.cost) : null,
        vehicle_name: vehicle ? `${vehicle.name} (${vehicle.registration_number})` : '',
        assigned_staff_name: assignedStaff?.name || '',
        reported_by_staff_id: formData.reported_by_staff_id || null,
        reported_by_staff_name: reportedByStaff?.name || '',
        reported_at: formData.phone_booking && !editingBooking ? new Date().toISOString() : (formData.reported_at || undefined),
        report_source: formData.phone_booking ? 'phone_call' : 'admin',
        logged_by_name: adminName || undefined,
      };
      delete payload.phone_booking;

      let result;
      if (editingBooking) {
        await base44.entities.VehicleMaintenanceBooking.update(editingBooking.id, payload);
        result = { id: editingBooking.id };
      } else {
        result = await base44.entities.VehicleMaintenanceBooking.create(payload);
      }
      if (formData.assigned_staff_id) {
        try { await base44.functions.invoke('notifyMaintenanceBooking', { booking_id: result.id }); } catch (_) {}
      }
      queryClient.invalidateQueries({ queryKey: ['maintenance-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['vehicles-maintenance-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['vehicle-maintenance-bookings'] });
      toast({ title: editingBooking ? 'Booking updated' : 'Booking created', description: formData.assigned_staff_id ? 'Assigned staff notified by email.' : 'No staff assigned.' });
      setFormData(emptyForm);
      onClose();
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Wrench className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">{editingBooking ? 'Edit Booking' : 'New Maintenance Booking'}</h2>
              <p className="text-xs text-slate-500">Book MOT, service or repair</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {/* Vehicle */}
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Vehicle *</label>
              <select value={formData.vehicle_id} onChange={e => setFormData({ ...formData, vehicle_id: e.target.value })} required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm bg-white">
                <option value="">Select Vehicle</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.registration_number})</option>)}
              </select>
            </div>

            {/* Booking Type */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Type *</label>
              <select value={formData.booking_type} onChange={e => setFormData({ ...formData, booking_type: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm bg-white">
                {BOOKING_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
              <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm bg-white">
                {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Date *</label>
              <input type="date" value={formData.booking_date} onChange={e => setFormData({ ...formData, booking_date: e.target.value })} required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
            </div>

            {/* Time */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Time</label>
              <input type="time" value={formData.booking_time} onChange={e => setFormData({ ...formData, booking_time: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
            </div>

            {/* Provider picker */}
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Maintenance Provider</label>
              <select value={formData.supplier_id} onChange={e => handleProviderSelect(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm bg-white">
                <option value="">— Select provider —</option>
                {providers.map(p => <option key={p.id} value={p.id}>{p.name}{p.maintenance_services?.length ? ` (${p.maintenance_services.length} services)` : ''}</option>)}
              </select>
              {providers.length === 0 && (
                <p className="text-[11px] text-amber-600 mt-1">No maintenance providers yet — add one in Settings → Suppliers (tick "Maintenance Provider").</p>
              )}
            </div>

            {/* Supplier name (free text fallback) */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Supplier / Garage</label>
              <input type="text" value={formData.supplier_name} onChange={e => setFormData({ ...formData, supplier_name: e.target.value, supplier_id: '' })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
            </div>

            {/* Supplier Phone with click-to-call */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Supplier Phone</label>
              <div className="flex gap-1.5">
                <input type="text" value={formData.supplier_phone} onChange={e => setFormData({ ...formData, supplier_phone: e.target.value })}
                  className="flex-1 min-w-0 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
                {formData.supplier_phone && (
                  <a href={`tel:${formData.supplier_phone.replace(/\s/g, '')}`} title="Call now"
                    className="flex items-center justify-center px-3 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition flex-shrink-0">
                    <Phone className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>

            {/* Quick actions: send alert email + portal link */}
            {formData.supplier_id && (
              <div className="col-span-2 flex flex-wrap gap-2">
                <button type="button" onClick={handleSendAlertEmail}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-semibold hover:bg-blue-100 transition border border-blue-200">
                  <Send className="w-3.5 h-3.5" /> Send Service Alert Email
                </button>
                {(() => {
                  const p = providers.find(pr => pr.id === formData.supplier_id);
                  return p?.portal_login_url ? (
                    <a href={p.portal_login_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 text-violet-700 rounded-lg text-xs font-semibold hover:bg-violet-100 transition border border-violet-200">
                      <ExternalLink className="w-3.5 h-3.5" /> Provider Portal
                    </a>
                  ) : null;
                })()}
              </div>
            )}

            {/* Cost */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Cost (£)</label>
              <input type="number" step="0.01" value={formData.cost} onChange={e => setFormData({ ...formData, cost: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
            </div>

            {/* Assign Driver */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Assign Driver</label>
              <select value={formData.assigned_staff_id} onChange={e => setFormData({ ...formData, assigned_staff_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm bg-white">
                <option value="">Unassigned</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {/* Location */}
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Location / Address</label>
              <input type="text" value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
            </div>

            {/* Phone booking checkbox */}
            <div className="col-span-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer">
                <input type="checkbox" checked={formData.phone_booking} onChange={e => setFormData({ ...formData, phone_booking: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                Logged over the phone (Holman call)
              </label>
            </div>

            {/* Reported by */}
            {formData.phone_booking && (
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Reported by</label>
                <select value={formData.reported_by_staff_id} onChange={e => setFormData({ ...formData, reported_by_staff_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm bg-white">
                  <option value="">Select staff member</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}

            {/* Notes */}
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Notes</label>
              <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm resize-none" />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <button type="submit" disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition font-semibold text-sm disabled:opacity-50">
              {saving ? 'Saving…' : <><Save className="w-4 h-4" /> {editingBooking ? 'Update' : 'Create'} Booking</>}
            </button>
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition font-semibold text-sm">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}