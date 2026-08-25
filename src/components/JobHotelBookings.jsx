import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import {
  Hotel, Plus, MapPin, Phone, FileText, Trash2, Edit2,
  X, Users, Home, BedDouble, Wand2, Check, Loader2, Navigation, Hash,
  ChevronRight, Calendar, PoundSterling, Bed, UserCheck, AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import HotelCalendarView from '@/components/jobs/HotelCalendarView';
import HotelConflictAlerts from '@/components/jobs/HotelConflictAlerts';

const inputCls = "w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#2E5A1A] text-sm";

const STAFF_COLORS = [
  'bg-emerald-100 text-emerald-700',
  'bg-blue-100 text-blue-700',
  'bg-amber-100 text-amber-700',
  'bg-purple-100 text-purple-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
];

function initials(name) {
  return name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
}

function nightsBetween(ci, co) {
  if (!ci || !co) return 0;
  return Math.max(0, Math.round((new Date(co + 'T00:00:00') - new Date(ci + 'T00:00:00')) / 86400000));
}

function HotelEditor({ open, onClose, booking, job, assignedStaff, onSave, allStaff, preselectStaffId }) {
  const [form, setForm] = useState(booking || {});
  const [selectedStaffIds, setSelectedStaffIds] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(booking || { hotel_name: '', address: '', check_in_date: job?.start_date || '', check_out_date: job?.end_date || '', room_type: '', booking_reference: '', po_number: '', contact_phone: '', notes: '' });
    setSelectedStaffIds(booking?.assigned_staff_ids || (preselectStaffId ? [preselectStaffId] : []));
  }, [booking, job, open, preselectStaffId]);

  const toggleStaff = (id) => setSelectedStaffIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (!form.hotel_name?.trim()) return;
    setSaving(true);
    const staffNames = selectedStaffIds.map(id => allStaff.find(s => s.id === id)?.name).filter(Boolean);
    const payload = { ...form, job_id: job.id, job_name: job.name, assigned_staff_ids: selectedStaffIds, assigned_staff_names: staffNames };
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
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2">
            <Hotel className="w-5 h-5 text-blue-600" />
            {booking?.id ? 'Edit Hotel Booking' : 'New Hotel Booking'}
          </SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Hotel Name *</label>
            <input type="text" required value={form.hotel_name || ''} onChange={e => setForm({ ...form, hotel_name: e.target.value })} className={inputCls} placeholder="e.g. Premier Inn" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Address</label>
            <input type="text" value={form.address || ''} onChange={e => setForm({ ...form, address: e.target.value })} className={inputCls} placeholder="Street, City, Postcode" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Check-in</label>
              <input type="date" value={form.check_in_date || ''} onChange={e => setForm({ ...form, check_in_date: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Check-out</label>
              <input type="date" value={form.check_out_date || ''} onChange={e => setForm({ ...form, check_out_date: e.target.value })} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Room Type</label>
              <input type="text" value={form.room_type || ''} onChange={e => setForm({ ...form, room_type: e.target.value })} className={inputCls} placeholder="Single, Twin..." />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Booking Ref</label>
              <input type="text" value={form.booking_reference || ''} onChange={e => setForm({ ...form, booking_reference: e.target.value })} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">PO Number</label>
            <input type="text" value={form.po_number || ''} onChange={e => setForm({ ...form, po_number: e.target.value })} className={inputCls} placeholder="Purchase order number" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Cost per Night (£)</label>
              <input type="number" min="0" step="0.01" value={form.cost_per_night ?? ''} onChange={e => setForm({ ...form, cost_per_night: e.target.value === '' ? '' : Number(e.target.value) })} className={inputCls} placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Rooms</label>
              <input type="number" min="1" step="1" value={form.room_count ?? 1} onChange={e => setForm({ ...form, room_count: e.target.value === '' ? '' : Number(e.target.value) })} className={inputCls} placeholder="1" />
            </div>
          </div>
          {(() => {
            const nights = nightsBetween(form.check_in_date, form.check_out_date);
            const total = (Number(form.cost_per_night) || 0) * (Number(form.room_count) || 1) * nights;
            return (
              <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 flex items-center justify-between">
                <span className="text-xs text-blue-700 font-medium">
                  {nights} night{nights === 1 ? '' : 's'} × {(Number(form.room_count) || 1)} room{Number(form.room_count) === 1 ? '' : 's'} × £{(Number(form.cost_per_night) || 0).toFixed(2)}
                </span>
                <span className="text-sm font-bold text-blue-800">Total: £{total.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            );
          })()}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Contact Phone</label>
            <input type="tel" value={form.contact_phone || ''} onChange={e => setForm({ ...form, contact_phone: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className={inputCls + " resize-none"} placeholder="Parking, breakfast, etc." />
          </div>
          <div className="pt-2 border-t border-slate-100">
            <label className="block text-xs font-medium text-slate-600 mb-2">Assigned Crew ({selectedStaffIds.length})</label>
            {allStaff.length === 0 ? (
              <p className="text-xs text-slate-400">No crew members available.</p>
            ) : (
              <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto">
                {allStaff.map((member) => {
                  const selected = selectedStaffIds.includes(member.id);
                  const onJob = assignedStaff.some(s => s.id === member.id);
                  return (
                    <button key={member.id} type="button" onClick={() => toggleStaff(member.id)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition text-left ${selected ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
                      <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${selected ? 'bg-blue-600' : 'bg-white border border-slate-300'}`}>
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
            <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition text-sm font-semibold">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {booking?.id ? 'Update' : 'Create'}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition text-sm font-medium">Cancel</button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function StaffHotelRow({ staff, booking, colorIdx, onEdit, onUnassign, onAssign }) {
  const [expanded, setExpanded] = useState(false);
  const colorClass = STAFF_COLORS[colorIdx % STAFF_COLORS.length];

  if (!booking) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${colorClass}`}>
          {initials(staff.name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800 truncate">{staff.name}</p>
          <p className="text-xs text-slate-400">No hotel assigned</p>
        </div>
        <button onClick={() => onAssign(staff)} className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold transition">
          <Plus className="w-3.5 h-3.5" /> Assign
        </button>
      </div>
    );
  }

  const nights = nightsBetween(booking.check_in_date, booking.check_out_date);
  const cost = (Number(booking.cost_per_night) || 0) * (Number(booking.room_count) || 1) * nights;

  return (
    <div className="border-b border-slate-100 last:border-0">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition text-left">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${colorClass}`}>
          {initials(staff.name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800 truncate">{staff.name}</p>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Hotel className="w-3 h-3 text-blue-500" />
            <span className="truncate font-medium text-slate-600">{booking.hotel_name}</span>
            {booking.room_type && <span className="text-slate-400">· {booking.room_type}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {cost > 0 && <span className="text-xs font-bold text-slate-700 hidden sm:block">£{cost.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>}
          {booking.check_in_date && (
            <span className="text-[11px] text-slate-400 hidden md:block">
              {format(new Date(booking.check_in_date + 'T00:00:00'), 'dd MMM')}{booking.check_out_date ? `–${format(new Date(booking.check_out_date + 'T00:00:00'), 'dd MMM')}` : ''}
            </span>
          )}
          <ChevronRight className={`w-4 h-4 text-slate-300 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pl-16 space-y-3 bg-slate-50/50">
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-slate-500"><Calendar className="w-3 h-3" /> {nights} night{nights === 1 ? '' : 's'}</span>
            <span className="flex items-center gap-1 text-slate-500"><Bed className="w-3 h-3" /> {booking.room_type || 'Standard'} · {booking.room_count || 1} room{(booking.room_count || 1) > 1 ? 's' : ''}</span>
            {cost > 0 && <span className="flex items-center gap-1 text-slate-700 font-semibold"><PoundSterling className="w-3 h-3" /> {cost.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
          </div>

          {booking.address && (
            <a href={`https://maps.google.com/?q=${encodeURIComponent(booking.address + ' ' + booking.hotel_name)}`} target="_blank" rel="noopener noreferrer"
              className="flex items-start gap-1.5 text-xs text-slate-600 hover:text-blue-700 transition">
              <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" /> {booking.address} <Navigation className="w-3 h-3 text-blue-500 mt-0.5" />
            </a>
          )}

          <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
            {booking.booking_reference && <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> {booking.booking_reference}</span>}
            {booking.po_number && <span className="flex items-center gap-1 font-medium text-slate-700"><Hash className="w-3 h-3 text-blue-500" /> PO: {booking.po_number}</span>}
            {booking.contact_phone && (
              <a href={`tel:${booking.contact_phone}`} className="flex items-center gap-1 text-blue-700 font-medium hover:underline"><Phone className="w-3 h-3" /> {booking.contact_phone}</a>
            )}
          </div>

          {booking.notes && (
            <div className="text-xs text-slate-500 bg-white rounded-lg px-3 py-2 border border-slate-200">
              {booking.notes}
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button onClick={() => onEdit(booking)} className="flex items-center gap-1 px-3 py-1.5 bg-white text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-medium transition border border-slate-200">
              <Edit2 className="w-3 h-3" /> Edit
            </button>
            <button onClick={() => onUnassign(booking, staff.id)} className="flex items-center gap-1 px-3 py-1.5 bg-white text-amber-600 hover:bg-amber-50 rounded-lg text-xs font-medium transition border border-slate-200">
              <X className="w-3 h-3" /> Unassign
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatTile({ icon: Icon, label, value, sub, gradient }) {
  return (
    <div className={`rounded-xl p-3 text-white ${gradient}`}>
      <div className="flex items-center justify-between mb-1">
        <Icon className="w-4 h-4 opacity-80" />
      </div>
      <p className="text-xl font-bold leading-tight">{value}</p>
      <p className="text-[11px] opacity-80">{label}</p>
      {sub && <p className="text-[10px] opacity-60 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function JobHotelBookings({ job, assignedStaff, allStaff }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState(null);
  const [assignTargetStaff, setAssignTargetStaff] = useState(null);

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['job-hotel-bookings', job.id],
    queryFn: () => base44.entities.HotelBooking.filter({ job_id: job.id })
  });

  // Build a map of staff_id -> booking
  const staffBookingMap = {};
  bookings.forEach(b => {
    (b.assigned_staff_ids || []).forEach(sid => {
      staffBookingMap[sid] = b;
    });
  });

  const assignedToAnyBooking = new Set(bookings.flatMap(b => b.assigned_staff_ids || []));
  const unassignedStaff = assignedStaff.filter(s => !assignedToAnyBooking.has(s.id));
  const totalNights = bookings.reduce((sum, b) => sum + nightsBetween(b.check_in_date, b.check_out_date), 0);
  const totalCost = bookings.reduce((sum, b) => {
    const n = nightsBetween(b.check_in_date, b.check_out_date);
    return sum + (Number(b.cost_per_night) || 0) * (Number(b.room_count) || 1) * n;
  }, 0);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['job-hotel-bookings', job.id] });
    queryClient.invalidateQueries({ queryKey: ['all-hotel-bookings'] });
  };

  const handleAdd = () => {
    setEditingBooking(null);
    setAssignTargetStaff(null);
    setEditorOpen(true);
  };

  const handleEdit = (booking) => {
    setEditingBooking(booking);
    setAssignTargetStaff(null);
    setEditorOpen(true);
  };

  const handleAssignStaff = (staff) => {
    // Open the editor with this staff pre-selected (new booking)
    setEditingBooking(null);
    setAssignTargetStaff(staff);
    setEditorOpen(true);
  };

  const handleDelete = async (booking) => {
    if (!confirm(`Delete the ${booking.hotel_name} booking?`)) return;
    try {
      await base44.entities.HotelBooking.delete(booking.id);
      invalidate();
      toast({ title: 'Booking deleted' });
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const handleUnassign = async (booking, staffId) => {
    const newIds = (booking.assigned_staff_ids || []).filter(id => id !== staffId);
    const newNames = (booking.assigned_staff_names || []).filter((_, i) => (booking.assigned_staff_ids || [])[i] !== staffId);
    try {
      await base44.entities.HotelBooking.update(booking.id, { assigned_staff_ids: newIds, assigned_staff_names: newNames });
      invalidate();
      toast({ title: 'Crew member unassigned' });
    } catch (err) {
      console.error('Unassign error:', err);
    }
  };

  const handleFillRemaining = async () => {
    if (unassignedStaff.length === 0 || bookings.length === 0) return;
    // Add all unassigned to the first booking
    const booking = bookings[0];
    const newIds = [...(booking.assigned_staff_ids || []), ...unassignedStaff.map(s => s.id)];
    const newNames = [...(booking.assigned_staff_names || []), ...unassignedStaff.map(s => s.name)];
    try {
      await base44.entities.HotelBooking.update(booking.id, { assigned_staff_ids: newIds, assigned_staff_names: newNames });
      invalidate();
      toast({ title: `${unassignedStaff.length} crew added`, description: `All remaining crew assigned to ${booking.hotel_name}.` });
    } catch (err) {
      console.error('Fill error:', err);
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary stats — brand gradient tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile icon={Hotel} label="Hotels Booked" value={bookings.length} gradient="stat-gradient-brand" />
        <StatTile icon={UserCheck} label="Crew Covered" value={`${assignedToAnyBooking.size}/${assignedStaff.length}`} sub={`${unassignedStaff.length} unassigned`} gradient="stat-gradient-emerald" />
        <StatTile icon={BedDouble} label="Total Nights" value={totalNights} gradient="stat-gradient-violet" />
        <StatTile icon={PoundSterling} label="Total Cost" value={`£${totalCost.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`} gradient="stat-gradient-amber" />
      </div>

      {/* Conflict detection — duplicate bookings & double-booked crew */}
      <HotelConflictAlerts bookings={bookings} />

      {/* Calendar week view */}
      {bookings.length > 0 && <HotelCalendarView bookings={bookings} />}

      {/* Main person-centric list */}
      <div className="insight-card rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#2E5A1A]/10 flex items-center justify-center">
            <Hotel className="w-4 h-4 text-[#2E5A1A]" />
          </div>
          <h3 className="font-semibold text-slate-900 text-sm">Crew Accommodation</h3>
          <span className="ml-auto text-xs text-slate-400 hidden sm:block">Tap a row to expand details</span>
          <button onClick={handleAdd} className="flex items-center gap-1 px-3 py-1.5 bg-[#2E5A1A] text-white rounded-lg hover:bg-[#1c4a12] transition text-xs font-semibold ml-2">
            <Plus className="w-3.5 h-3.5" /> Add Hotel
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
        ) : assignedStaff.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <Users className="w-6 h-6 text-slate-300" />
            </div>
            <p className="text-sm font-semibold text-slate-600">No crew assigned to this job</p>
            <p className="text-xs text-slate-400 mt-1">Assign crew from the Schedule tab first.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {assignedStaff.map((staff, i) => (
              <StaffHotelRow
                key={staff.id}
                staff={staff}
                booking={staffBookingMap[staff.id]}
                colorIdx={i}
                onEdit={handleEdit}
                onUnassign={handleUnassign}
                onAssign={handleAssignStaff}
              />
            ))}
          </div>
        )}
      </div>

      {/* Quick fill + unassigned summary */}
      {unassignedStaff.length > 0 && bookings.length > 0 && (
        <button onClick={handleFillRemaining} className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-sm font-semibold transition border border-blue-200">
          <Wand2 className="w-4 h-4" /> Fill {unassignedStaff.length} unassigned crew into first hotel
        </button>
      )}

      {/* Unassigned alert */}
      {unassignedStaff.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">{unassignedStaff.length} crew member{unassignedStaff.length === 1 ? '' : 's'} without accommodation</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {unassignedStaff.map((s, i) => (
                <span key={s.id} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STAFF_COLORS[i % STAFF_COLORS.length]}`}>
                  {s.name.split(' ')[0]}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Hotel summary cards (compact) */}
      {bookings.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-400" />
            <h3 className="font-semibold text-slate-700 text-sm">All Bookings</h3>
            <span className="ml-auto text-xs text-slate-400">{bookings.length} hotel{bookings.length === 1 ? '' : 's'}</span>
          </div>
          <div className="divide-y divide-slate-100">
            {bookings.map(b => {
              const crewCount = (b.assigned_staff_ids || []).length;
              const nights = nightsBetween(b.check_in_date, b.check_out_date);
              const cost = (Number(b.cost_per_night) || 0) * (Number(b.room_count) || 1) * nights;
              return (
                <div key={b.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Hotel className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800 truncate">{b.hotel_name}</p>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="flex items-center gap-0.5"><Users className="w-3 h-3" /> {crewCount}</span>
                      <span>·</span>
                      <span>{nights} night{nights === 1 ? '' : 's'}</span>
                      {cost > 0 && <><span>·</span><span className="font-medium text-slate-600">£{cost.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span></>}
                    </div>
                  </div>
                  <button onClick={() => handleEdit(b)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(b)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <HotelEditor
        open={editorOpen}
        onClose={() => { setEditorOpen(false); setAssignTargetStaff(null); }}
        booking={editingBooking}
        job={job}
        assignedStaff={assignedStaff}
        allStaff={allStaff}
        onSave={invalidate}
        preselectStaffId={assignTargetStaff?.id}
      />
    </div>
  );
}