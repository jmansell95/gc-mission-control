import React, { useState } from 'react';
import { format, addDays, startOfWeek, isSameDay, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, Hotel, MapPin } from 'lucide-react';

// Calendar week view showing hotel bookings across a 7-day grid. Each row is
// a hotel; coloured bars span the check-in → check-out dates. Managers can
// navigate weeks with the arrow buttons. Gives a visual overview of when
// each hotel is booked and for how long.
export default function HotelCalendarView({ bookings }) {
  const [weekStart, setWeekStart] = useState(() => {
    // Default to the earliest booking's check-in week, or this week
    const earliest = bookings
      .filter(b => b.check_in_date)
      .map(b => parseISO(b.check_in_date + 'T00:00:00'))
      .sort((a, b) => a - b)[0];
    return startOfWeek(earliest || new Date(), { weekStartsOn: 1 });
  });

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd = days[6];

  const goPrev = () => setWeekStart(d => addDays(d, -7));
  const goNext = () => setWeekStart(d => addDays(d, 7));

  // Filter bookings that overlap with this week
  const weekBookings = bookings.filter(b => {
    if (!b.check_in_date || !b.check_out_date) return false;
    const ci = parseISO(b.check_in_date + 'T00:00:00');
    const co = parseISO(b.check_out_date + 'T00:00:00');
    return ci <= weekEnd && co >= weekStart;
  });

  if (bookings.length === 0) return null;

  return (
    <div className="insight-card rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <Hotel className="w-4 h-4 text-[#2E5A1A]" />
        <h3 className="text-sm font-semibold text-slate-900">Booking Calendar</h3>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={goPrev} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-semibold text-slate-600 min-w-[140px] text-center">
            {format(weekStart, 'dd MMM')} – {format(weekEnd, 'dd MMM')}
          </span>
          <button onClick={goNext} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-[140px_repeat(7,1fr)] gap-0 border-b border-slate-100 bg-slate-50/50">
        <div className="px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Hotel</div>
        {days.map(d => {
          const isToday = isSameDay(d, new Date());
          return (
            <div key={d.toISOString()} className={`px-2 py-2 text-center border-l border-slate-100 ${isToday ? 'bg-[#8DC63F]/10' : ''}`}>
              <p className={`text-[10px] font-medium ${isToday ? 'text-[#2E5A1A]' : 'text-slate-400'}`}>{format(d, 'EEE')}</p>
              <p className={`text-xs font-bold ${isToday ? 'text-[#2E5A1A]' : 'text-slate-600'}`}>{format(d, 'dd')}</p>
            </div>
          );
        })}
      </div>

      {/* Hotel rows */}
      <div className="max-h-64 overflow-y-auto">
        {weekBookings.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-slate-400">No bookings in this week</div>
        ) : (
          weekBookings.map((b, idx) => {
            const ci = parseISO(b.check_in_date + 'T00:00:00');
            const co = parseISO(b.check_out_date + 'T00:00:00');
            const colors = ['bg-[#2E5A1A]', 'bg-blue-600', 'bg-violet-600', 'bg-amber-600', 'bg-rose-600', 'bg-cyan-600'];
            const color = colors[idx % colors.length];
            return (
              <div key={b.id} className="grid grid-cols-[140px_repeat(7,1fr)] gap-0 border-b border-slate-50 hover:bg-slate-50/30 transition">
                <div className="px-3 py-2.5 flex items-center gap-1.5 min-w-0">
                  <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                  <span className="text-xs font-medium text-slate-700 truncate">{b.hotel_name}</span>
                </div>
                {days.map(d => {
                  const isWithin = d >= ci && d < co;
                  const isCheckIn = isSameDay(d, ci);
                  const isCheckOut = isSameDay(d, co);
                  return (
                    <div key={d.toISOString()} className="relative h-10 border-l border-slate-50 flex items-center justify-center">
                      {isWithin && (
                        <div className={`absolute inset-y-1 ${isCheckIn ? 'left-1' : 'left-0'} ${isCheckOut ? 'right-1' : 'right-0'} ${color} rounded-md flex items-center justify-center`}>
                          {isCheckIn && <span className="text-[9px] text-white font-bold px-1 truncate">IN</span>}
                          {isCheckOut && <span className="text-[9px] text-white font-bold px-1 truncate">OUT</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}