import React, { useState, useMemo } from 'react';
import { format, parseISO, addMonths, startOfMonth, isSameMonth } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Calendar, MapPin, Clock, User, Truck } from 'lucide-react';

const BOOKING_TYPE_COLORS = {
  mot: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  service: 'bg-blue-50 text-blue-700 border-blue-200',
  breakdown: 'bg-rose-50 text-rose-700 border-rose-200',
  windscreen: 'bg-amber-50 text-amber-700 border-amber-200',
  tyre_repair: 'bg-orange-50 text-orange-700 border-orange-200',
  repair: 'bg-violet-50 text-violet-700 border-violet-200',
  fuel_card: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  inspection: 'bg-teal-50 text-teal-700 border-teal-200',
  risk_master: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  other: 'bg-slate-50 text-slate-700 border-slate-200',
};

const STATUS_DOT = {
  requested: 'bg-amber-500',
  booked: 'bg-blue-500',
  in_progress: 'bg-violet-500',
  completed: 'bg-emerald-500',
  cancelled: 'bg-slate-300',
};

/**
 * MaintenanceMatrixPlanner — month-columns × driver-rows matrix.
 *
 * Months across the top (scrollable), drivers down the side. Each cell
 * shows the bookings for that driver in that month — vehicle reg, garage,
 * date & time, colour-coded by booking type. Click a booking to edit it.
 */
export default function MaintenanceMatrixPlanner({ bookings, vehicles, staff, onEditBooking, onAddBooking }) {
  const [startMonth, setStartMonth] = useState(() => startOfMonth(new Date()));
  const months = useMemo(
    () => Array.from({ length: 6 }, (_, i) => addMonths(startMonth, i)),
    [startMonth],
  );

  // Drivers = staff who have bookings OR are assigned staff on any booking
  const drivers = useMemo(() => {
    const driverIds = new Set();
    bookings.forEach(b => {
      if (b.assigned_staff_id) driverIds.add(b.assigned_staff_id);
    });
    return staff.filter(s => driverIds.has(s.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [bookings, staff]);

  // Group bookings by driver + month
  const bookingsByDriverMonth = useMemo(() => {
    const map = {};
    bookings.forEach(b => {
      if (!b.assigned_staff_id || !b.booking_date) return;
      const monthKey = b.booking_date.slice(0, 7); // YYYY-MM
      const key = `${b.assigned_staff_id}|${monthKey}`;
      if (!map[key]) map[key] = [];
      map[key].push(b);
    });
    // Sort each cell's bookings by date
    Object.keys(map).forEach(k => map[k].sort((a, b) => (a.booking_date || '').localeCompare(b.booking_date || '')));
    return map;
  }, [bookings]);

  const vehicleName = (b) => {
    const v = vehicles.find(vh => vh.id === b.vehicle_id);
    if (v) return `${v.registration_number || v.name || 'Vehicle'}`;
    return b.vehicle_name || 'Vehicle';
  };

  return (
    <div className="insight-card rounded-2xl overflow-hidden">
      {/* Month navigation */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50/80">
        <Calendar className="w-4 h-4 text-[#2E5A1A]" />
        <h3 className="text-sm font-bold text-slate-800">Maintenance Planner</h3>
        <span className="text-[11px] text-slate-400">Months × drivers</span>
        <div className="flex items-center gap-1.5 ml-auto">
          <button onClick={() => setStartMonth(d => addMonths(d, -6))}
            className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition">
            <ChevronLeft className="w-4 h-4 text-slate-500" />
          </button>
          <span className="text-xs font-semibold text-slate-600 px-2">
            {format(months[0], 'MMM yyyy')} – {format(months[months.length - 1], 'MMM yyyy')}
          </span>
          <button onClick={() => setStartMonth(d => addMonths(d, 6))}
            className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition">
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>

      {/* Matrix */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-white border-b border-r border-slate-100 px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500 min-w-[160px]">
                <div className="flex items-center gap-1.5"><User className="w-3 h-3" /> Driver</div>
              </th>
              {months.map(m => (
                <th key={m.toISOString()} className="border-b border-r border-slate-100 px-2 py-2.5 text-center text-xs font-bold text-slate-700 min-w-[180px]">
                  {format(m, 'MMM yyyy')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {drivers.length === 0 ? (
              <tr>
                <td colSpan={months.length + 1} className="px-4 py-8 text-center text-sm text-slate-400">
                  No bookings with an assigned driver yet. Assign a driver when booking maintenance to see the planner.
                </td>
              </tr>
            ) : drivers.map(driver => (
              <tr key={driver.id} className="hover:bg-slate-50/50">
                <td className="sticky left-0 z-10 bg-white border-b border-r border-slate-100 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                    <p className="text-xs font-bold text-slate-800 truncate">{driver.name}</p>
                  </div>
                </td>
                {months.map(m => {
                  const monthKey = format(m, 'yyyy-MM');
                  const cellBookings = bookingsByDriverMonth[`${driver.id}|${monthKey}`] || [];
                  return (
                    <td key={monthKey} className="border-b border-r border-slate-100 px-2 py-2 align-top">
                      <div className="space-y-1.5">
                        {cellBookings.map(b => {
                          const typeColor = BOOKING_TYPE_COLORS[b.booking_type] || BOOKING_TYPE_COLORS.other;
                          const statusDot = STATUS_DOT[b.status] || 'bg-slate-300';
                          return (
                            <button
                              key={b.id}
                              onClick={() => onEditBooking(b)}
                              className={`w-full text-left rounded-lg border px-2 py-1.5 text-[10px] transition hover:shadow-sm ${typeColor}`}
                            >
                              <div className="flex items-center gap-1 mb-0.5">
                                <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
                                <span className="font-bold flex items-center gap-0.5 truncate">
                                  <Truck className="w-2.5 h-2.5 flex-shrink-0" />
                                  {vehicleName(b)}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 text-[9px] opacity-80">
                                <Clock className="w-2.5 h-2.5" />
                                {format(parseISO(b.booking_date + 'T00:00:00'), 'dd MMM')}
                                {b.booking_time && ` · ${b.booking_time}`}
                              </div>
                              {b.supplier_name && (
                                <div className="flex items-center gap-1 text-[9px] opacity-70 truncate">
                                  <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                                  {b.location || b.supplier_name}
                                </div>
                              )}
                            </button>
                          );
                        })}
                        {cellBookings.length === 0 && (
                          <button
                            onClick={() => onAddBooking({ assigned_staff_id: driver.id })}
                            className="w-full text-[9px] text-slate-300 hover:text-slate-500 hover:bg-slate-50 rounded-lg py-1 transition"
                          >
                            + Add
                          </button>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}