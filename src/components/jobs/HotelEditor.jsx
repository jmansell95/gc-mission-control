import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import {
  Hotel, Home, Plus, MapPin, Phone, Check, Loader2, Users,
  BedDouble, PoundSterling, Calendar, X,
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  nightsBetween, bookingType, perPersonTotal, perPersonDayRate, fmtGBP,
} from '@/components/jobs/hotelCost';

const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#2E5A1A] text-sm';

function TypeToggle({ value, onChange }) {
  const opts = [
    { key: 'hotel', label: 'Hotel', icon: Hotel, color: 'blue' },
    { key: 'airbnb', label: 'Air B&B', icon: Home, color: 'amber' },
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {opts.map(({ key, label, icon: Icon }) => {
        const active = value === key;
        const ring = active
          ? key === 'hotel'
            ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-200'
            : 'border-amber-500 bg-amber-50 text-amber-700 ring-1 ring-amber-200'
          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50';
        return (
          <button key={key} type="button" onClick={() => onChange(key)}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 text-sm font-semibold transition ${ring}`}>
            <Icon className="w-4 h-4" />
            {label}
            {active && <Check className="w-3.5 h-3.5 ml-auto" />}
          </button>
        );
      })}
    </div>
  );
}

export default function HotelEditor({ open, onClose, booking, job, assignedStaff, onSave, allStaff, preselectStaffId }) {
  const { toast } = useToast();
  const [form, setForm] = useState(booking || {});
  const [selectedStaffIds, setSelectedStaffIds] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(booking || {
      booking_type: 'hotel',
      hotel_name: '', address: '',
      check_in_date: job?.start_date || '', check_out_date: job?.end_date || '',
      booking_reference: '', contact_phone: '', notes: '',
      cost_per_night: '', room_count: 1, total_cost: '',
    });
    setSelectedStaffIds(booking?.assigned_staff_ids || (preselectStaffId ? [preselectStaffId] : []));
  }, [booking, job, open, preselectStaffId]);

  const type = bookingType(form);
  const toggleStaff = (id) => setSelectedStaffIds(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (!form.hotel_name?.trim()) return;
    if (type === 'airbnb' && !form.total_cost) {
      toast({ title: 'Total cost required', description: 'Enter the total cost for the Air B&B stay.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const staffNames = selectedStaffIds.map(id => allStaff.find(s => s.id === id)?.name).filter(Boolean);
    // Stop writing room_type and po_number on new bookings.
    const payload = {
      ...form,
      job_id: job.id, job_name: job.name,
      assigned_staff_ids: selectedStaffIds,
      assigned_staff_names: staffNames,
      room_type: booking?.room_type || '',
      po_number: booking?.po_number || '',
      // Air B&B doesn't use rooms/per-night — clear them so stale values don't linger.
      ...(type === 'airbnb' ? { cost_per_night: null, room_count: null } : { total_cost: null }),
    };
    try {
      if (booking?.id) {
        await base44.entities.HotelBooking.update(booking.id, payload);
      } else {
        await base44.entities.HotelBooking.create(payload);
      }
      onSave();
      onClose();
    } catch (err) {
      console.error('Save error:', err);
      toast({ title: 'Could not save booking', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const nights = nightsBetween(form.check_in_date, form.check_out_date);
  const crewCount = selectedStaffIds.length || 1;
  const previewTotal = type === 'airbnb'
    ? (Number(form.total_cost) || 0)
    : (Number(form.cost_per_night) || 0) * (Number(form.room_count) || 1) * nights;
  const previewPerPerson = type === 'airbnb'
    ? (Number(form.total_cost) || 0) / crewCount
    : previewTotal / crewCount;
  const previewDayRate = nights > 0 ? previewPerPerson / nights : 0;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2">
            {type === 'airbnb' ? <Home className="w-5 h-5 text-amber-600" /> : <Hotel className="w-5 h-5 text-blue-600" />}
            {booking?.id ? 'Edit Booking' : 'New Booking'}
          </SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Booking Type</label>
            <TypeToggle value={type} onChange={(v) => setForm({ ...form, booking_type: v })} />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {type === 'airbnb' ? 'Property Name *' : 'Hotel Name *'}
            </label>
            <input type="text" required value={form.hotel_name || ''}
              onChange={e => setForm({ ...form, hotel_name: e.target.value })}
              className={inputCls} placeholder={type === 'airbnb' ? 'e.g. 2-bed flat near site' : 'e.g. Premier Inn'} />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Address</label>
            <input type="text" value={form.address || ''}
              onChange={e => setForm({ ...form, address: e.target.value })}
              className={inputCls} placeholder="Street, City, Postcode" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Check-in</label>
              <input type="date" value={form.check_in_date || ''}
                onChange={e => setForm({ ...form, check_in_date: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Check-out</label>
              <input type="date" value={form.check_out_date || ''}
                onChange={e => setForm({ ...form, check_out_date: e.target.value })} className={inputCls} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Booking Ref</label>
            <input type="text" value={form.booking_reference || ''}
              onChange={e => setForm({ ...form, booking_reference: e.target.value })} className={inputCls} />
          </div>

          {type === 'hotel' ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Cost per Night (£)</label>
                <input type="number" min="0" step="0.01" value={form.cost_per_night ?? ''}
                  onChange={e => setForm({ ...form, cost_per_night: e.target.value === '' ? '' : Number(e.target.value) })}
                  className={inputCls} placeholder="0.00" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Rooms</label>
                <input type="number" min="1" step="1" value={form.room_count ?? 1}
                  onChange={e => setForm({ ...form, room_count: e.target.value === '' ? '' : Number(e.target.value) })}
                  className={inputCls} placeholder="1" />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Total Cost for Stay (£)</label>
              <input type="number" min="0" step="0.01" value={form.total_cost ?? ''}
                onChange={e => setForm({ ...form, total_cost: e.target.value === '' ? '' : Number(e.target.value) })}
                className={inputCls} placeholder="e.g. 600 for the whole stay" />
            </div>
          )}

          {/* Live cost preview */}
          <div className={`rounded-lg border px-3 py-2.5 space-y-1 ${type === 'airbnb' ? 'bg-amber-50 border-amber-100' : 'bg-blue-50 border-blue-100'}`}>
            <div className="flex items-center justify-between text-xs">
              <span className={`font-medium ${type === 'airbnb' ? 'text-amber-700' : 'text-blue-700'}`}>
                {nights} night{nights === 1 ? '' : 's'}
                {type === 'hotel' && ` × ${Number(form.room_count) || 1} room${Number(form.room_count) === 1 ? '' : 's'}`}
              </span>
              <span className={`text-sm font-bold ${type === 'airbnb' ? 'text-amber-800' : 'text-blue-800'}`}>
                Total: {fmtGBP(previewTotal)}
              </span>
            </div>
            {crewCount > 0 && (
              <div className="flex items-center justify-between text-xs pt-1 border-t border-amber-100/60">
                <span className={`font-medium ${type === 'airbnb' ? 'text-amber-600' : 'text-blue-600'}`}>
                  {crewCount} {crewCount === 1 ? 'person' : 'people'} → {fmtGBP(previewPerPerson)} each
                </span>
                {nights > 0 && (
                  <span className={`flex items-center gap-1 font-semibold ${type === 'airbnb' ? 'text-amber-700' : 'text-blue-700'}`}>
                    <Calendar className="w-3 h-3" /> {fmtGBP(previewDayRate)}/night per person
                  </span>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Contact Phone</label>
            <input type="tel" value={form.contact_phone || ''}
              onChange={e => setForm({ ...form, contact_phone: e.target.value })} className={inputCls} />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea value={form.notes || ''}
              onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
              className={inputCls + ' resize-none'} placeholder="Parking, breakfast, etc." />
          </div>

          {/* Crew assignment */}
          <div className="pt-2 border-t border-slate-100">
            <label className="block text-xs font-medium text-slate-600 mb-2 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Assigned Crew ({selectedStaffIds.length})
            </label>
            {allStaff.length === 0 ? (
              <p className="text-xs text-slate-400">No crew members available.</p>
            ) : (
              <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto">
                {allStaff.map((member) => {
                  const selected = selectedStaffIds.includes(member.id);
                  const onJob = assignedStaff.some(s => s.id === member.id);
                  return (
                    <button key={member.id} type="button" onClick={() => toggleStaff(member.id)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition text-left ${selected ? 'bg-[#2E5A1A]/5 text-[#2E5A1A] ring-1 ring-[#2E5A1A]/20' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
                      <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${selected ? 'bg-[#2E5A1A]' : 'bg-white border border-slate-300'}`}>
                        {selected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <span className="flex-1">{member.name}</span>
                      {onJob && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">On job</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#2E5A1A] text-white rounded-lg hover:bg-[#1c4a12] disabled:opacity-50 transition text-sm font-semibold">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {booking?.id ? 'Update' : 'Create'}
            </button>
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition text-sm font-medium">Cancel</button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}