import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import {
  Hotel, Plus, Users, BedDouble, PoundSterling, UserCheck,
  AlertCircle, Wand2, Loader2, Home,
} from 'lucide-react';
import HotelEditor from '@/components/jobs/HotelEditor';
import StaffHotelRow from '@/components/jobs/StaffHotelRow';
import HotelCalendarView from '@/components/jobs/HotelCalendarView';
import MonthlyBookingsAccordion from '@/components/jobs/MonthlyBookingsAccordion';
import HotelConflictAlerts from '@/components/jobs/HotelConflictAlerts';
import {
  nightsBetween, bookingType, bookingTotal, perPersonDayRate, fmtGBP,
} from '@/components/jobs/hotelCost';

const STAFF_COLORS = [
  'bg-emerald-100 text-emerald-700',
  'bg-blue-100 text-blue-700',
  'bg-amber-100 text-amber-700',
  'bg-purple-100 text-purple-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
];

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

  // Multi-booking map: each staff member can appear in multiple bookings.
  const staffBookingsMap = {};
  bookings.forEach(b => {
    (b.assigned_staff_ids || []).forEach(sid => {
      if (!staffBookingsMap[sid]) staffBookingsMap[sid] = [];
      staffBookingsMap[sid].push(b);
    });
  });

  const assignedToAnyBooking = new Set(bookings.flatMap(b => b.assigned_staff_ids || []));
  const unassignedStaff = assignedStaff.filter(s => !assignedToAnyBooking.has(s.id));
  const totalNights = bookings.reduce((sum, b) => sum + nightsBetween(b.check_in_date, b.check_out_date), 0);
  const totalCost = bookings.reduce((sum, b) => sum + bookingTotal(b), 0);
  const hotelCount = bookings.filter(b => bookingType(b) === 'hotel').length;
  const airbnbCount = bookings.filter(b => bookingType(b) === 'airbnb').length;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['job-hotel-bookings', job.id] });
    queryClient.invalidateQueries({ queryKey: ['all-hotel-bookings'] });
  };

  const handleAdd = () => { setEditingBooking(null); setAssignTargetStaff(null); setEditorOpen(true); };
  const handleEdit = (booking) => { setEditingBooking(booking); setAssignTargetStaff(null); setEditorOpen(true); };
  const handleAssignStaff = (staff) => { setEditingBooking(null); setAssignTargetStaff(staff); setEditorOpen(true); };

  const handleDelete = async (booking) => {
    if (!confirm(`Delete the ${booking.hotel_name} booking?`)) return;
    try {
      await base44.entities.HotelBooking.delete(booking.id);
      invalidate();
      toast({ title: 'Booking deleted' });
    } catch (err) { console.error('Delete error:', err); }
  };

  const handleUnassign = async (booking, staffId) => {
    const newIds = (booking.assigned_staff_ids || []).filter(id => id !== staffId);
    const newNames = (booking.assigned_staff_names || []).filter((_, i) => (booking.assigned_staff_ids || [])[i] !== staffId);
    try {
      await base44.entities.HotelBooking.update(booking.id, { assigned_staff_ids: newIds, assigned_staff_names: newNames });
      invalidate();
      toast({ title: 'Crew member unassigned' });
    } catch (err) { console.error('Unassign error:', err); }
  };

  const handleFillRemaining = async () => {
    if (unassignedStaff.length === 0 || bookings.length === 0) return;
    const booking = bookings[0];
    const newIds = [...(booking.assigned_staff_ids || []), ...unassignedStaff.map(s => s.id)];
    const newNames = [...(booking.assigned_staff_names || []), ...unassignedStaff.map(s => s.name)];
    try {
      await base44.entities.HotelBooking.update(booking.id, { assigned_staff_ids: newIds, assigned_staff_names: newNames });
      invalidate();
      toast({ title: `${unassignedStaff.length} crew added`, description: `All remaining crew assigned to ${booking.hotel_name}.` });
    } catch (err) { console.error('Fill error:', err); }
  };

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatTile icon={Hotel} label="Hotels" value={hotelCount} gradient="stat-gradient-brand" />
        <StatTile icon={Home} label="Air B&B" value={airbnbCount} gradient="stat-gradient-blue" />
        <StatTile icon={UserCheck} label="Crew Covered" value={`${assignedToAnyBooking.size}/${assignedStaff.length}`} sub={`${unassignedStaff.length} unassigned`} gradient="stat-gradient-emerald" />
        <StatTile icon={BedDouble} label="Total Nights" value={totalNights} gradient="stat-gradient-violet" />
        <StatTile icon={PoundSterling} label="Total Cost" value={fmtGBP(totalCost, { decimals: 0 })} gradient="stat-gradient-amber" />
      </div>

      {/* Conflict detection */}
      <HotelConflictAlerts bookings={bookings} />

      {/* Calendar week view */}
      {bookings.length > 0 && <HotelCalendarView bookings={bookings} />}

      {/* Booking summary cards (top of hybrid layout) */}
      {bookings.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2 px-1">
            <Home className="w-4 h-4 text-[#2E5A1A]" />
            <h3 className="font-semibold text-slate-900 text-sm">Bookings</h3>
            <span className="text-xs text-slate-400">({bookings.length})</span>
            <button onClick={handleAdd} className="ml-auto flex items-center gap-1 px-3 py-1.5 bg-[#2E5A1A] text-white rounded-lg hover:bg-[#1c4a12] transition text-xs font-semibold">
              <Plus className="w-3.5 h-3.5" /> Add Booking
            </button>
          </div>
          <MonthlyBookingsAccordion bookings={bookings} onEdit={handleEdit} onDelete={handleDelete} />
        </div>
      )}

      {/* Person-centric list (bottom of hybrid layout) — multi-booking rows */}
      <div className="insight-card rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#2E5A1A]/10 flex items-center justify-center">
            <Users className="w-4 h-4 text-[#2E5A1A]" />
          </div>
          <h3 className="font-semibold text-slate-900 text-sm">Crew Accommodation</h3>
          <span className="ml-auto text-xs text-slate-400 hidden sm:block">Tap a row to expand</span>
          {bookings.length === 0 && (
            <button onClick={handleAdd} className="flex items-center gap-1 px-3 py-1.5 bg-[#2E5A1A] text-white rounded-lg hover:bg-[#1c4a12] transition text-xs font-semibold ml-2">
              <Plus className="w-3.5 h-3.5" /> Add Booking
            </button>
          )}
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
                bookings={staffBookingsMap[staff.id] || []}
                colorIdx={i}
                onEdit={handleEdit}
                onUnassign={handleUnassign}
                onAssign={handleAssignStaff}
              />
            ))}
          </div>
        )}
      </div>

      {/* Quick fill */}
      {unassignedStaff.length > 0 && bookings.length > 0 && (
        <button onClick={handleFillRemaining} className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-sm font-semibold transition border border-blue-200">
          <Wand2 className="w-4 h-4" /> Fill {unassignedStaff.length} unassigned crew into first booking
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