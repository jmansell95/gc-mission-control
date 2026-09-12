import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X, Wrench, CheckCircle2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

// Minimal staff-side form — pre-fills the crew member's default vehicle,
// records who reported it and that it was a phone call to Holman.
// The booking appears instantly on the admin Vehicles maintenance view.

const BOOKING_TYPES = [
  { value: 'breakdown', label: 'Breakdown' },
  { value: 'mot', label: 'MOT' },
  { value: 'service', label: 'Service' },
  { value: 'windscreen', label: 'Windscreen Repair' },
  { value: 'repair', label: 'Repair' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'other', label: 'Other' },
];

export default function StaffMaintenanceReportModal({ open, onClose, staff }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({
    vehicle_id: '',
    booking_type: 'breakdown',
    booking_date: format(new Date(), 'yyyy-MM-dd'),
    booking_time: '08:00',
    notes: '',
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['staff-my-vehicles'],
    queryFn: () => base44.entities.Vehicle.list('-created_date', 200),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    setDone(false);
    setForm({
      vehicle_id: staff?.default_vehicle_id || '',
      booking_type: 'breakdown',
      booking_date: format(new Date(), 'yyyy-MM-dd'),
      booking_time: '08:00',
      notes: '',
    });
  }, [open, staff]);

  if (!open) return null;

  const myVehicle = vehicles.find(v => v.id === form.vehicle_id);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.vehicle_id) {
      toast({ title: 'Select a vehicle', description: 'Pick the vehicle this booking is for.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await base44.entities.VehicleMaintenanceBooking.create({
        vehicle_id: form.vehicle_id,
        vehicle_name: myVehicle ? `${myVehicle.name} (${myVehicle.registration_number})` : '',
        booking_type: form.booking_type,
        status: 'requested',
        booking_date: form.booking_date,
        booking_time: form.booking_time,
        supplier_name: 'Holman',
        supplier_phone: '0344 800 5626',
        notes: form.notes,
        reported_by_staff_id: staff?.id || null,
        reported_by_staff_name: staff?.name || '',
        reported_at: new Date().toISOString(),
        report_source: 'staff_portal',
      });
      queryClient.invalidateQueries({ queryKey: ['maintenance-bookings'] });
      setDone(true);
    } catch (err) {
      toast({ title: 'Could not save booking', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom max-h-[92vh] flex flex-col">
        <div className="hero-gradient text-white px-5 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Log Holman Booking</h3>
              <p className="text-white/70 text-xs">You called Holman — record it here</p>
            </div>
          </div>
          <button onClick={onClose} type="button" aria-label="Close"
            className="w-9 h-9 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {done ? (
          <div className="p-8 text-center flex-1 flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <h4 className="font-bold text-slate-900 text-lg">Booking logged</h4>
            <p className="text-sm text-slate-500 mt-1 max-w-xs">
              {myVehicle ? `${myVehicle.registration_number} — ` : ''}The office can see this on the Vehicles page now.
            </p>
            <button onClick={onClose} type="button"
              className="mt-6 px-5 py-2.5 bg-primary text-white rounded-lg font-semibold text-sm hover:brightness-110 transition">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Vehicle *</label>
              <select value={form.vehicle_id} onChange={e => setForm({ ...form, vehicle_id: e.target.value })} required
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:border-primary text-sm bg-white">
                <option value="">Select vehicle</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.registration_number})</option>)}
              </select>
              {staff?.default_vehicle_id && form.vehicle_id === staff.default_vehicle_id && (
                <p className="text-[11px] text-slate-400 mt-1">Your usual vehicle</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">What did you book? *</label>
              <div className="grid grid-cols-2 gap-2">
                {BOOKING_TYPES.map(t => (
                  <button key={t.value} type="button" onClick={() => setForm({ ...form, booking_type: t.value })}
                    className={`px-3 py-2.5 rounded-lg text-sm font-medium border transition ${
                      form.booking_type === t.value
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-primary/40'
                    }`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Date *</label>
                <input type="date" value={form.booking_date} onChange={e => setForm({ ...form, booking_date: e.target.value })} required
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:border-primary text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Time</label>
                <input type="time" value={form.booking_time} onChange={e => setForm({ ...form, booking_time: e.target.value })}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:border-primary text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Notes (optional)</label>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="e.g. booked in for MOT at Dartford depot"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:border-primary text-sm resize-none" />
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-[11px] text-amber-700 flex items-start gap-2">
              <Wrench className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>This will show on the admin Vehicles page under <strong>{myVehicle?.registration_number || 'this reg'}</strong>, marked as reported by you.</span>
            </div>
            <button type="submit" disabled={saving}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white rounded-xl font-semibold text-sm hover:brightness-110 transition disabled:opacity-50 shadow-sm">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {saving ? 'Saving…' : 'Log Booking'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}