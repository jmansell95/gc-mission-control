import React, { useState, useMemo } from 'react';
import { ChevronDown, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import BookingSummaryCard from '@/components/jobs/BookingSummaryCard';
import { bookingTotal, fmtGBP } from '@/components/jobs/hotelCost';

/**
 * MonthlyBookingsAccordion — groups bookings by month in collapsible
 * sections (closed by default). Each month header shows the booking count
 * and total cost; expanding reveals the booking cards (with their assigned
 * staff) for that month.
 */
export default function MonthlyBookingsAccordion({ bookings, onEdit, onDelete }) {
  const [openMonths, setOpenMonths] = useState({});

  const months = useMemo(() => {
    const map = {};
    bookings.forEach(b => {
      const key = (b.check_in_date || '').slice(0, 7); // YYYY-MM
      if (!key) return;
      if (!map[key]) map[key] = [];
      map[key].push(b);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [bookings]);

  const toggle = (key) => setOpenMonths(prev => ({ ...prev, [key]: !prev[key] }));

  if (months.length === 0) return null;

  return (
    <div className="space-y-2">
      {months.map(([key, monthBookings]) => {
        const total = monthBookings.reduce((s, b) => s + bookingTotal(b), 0);
        const isOpen = !!openMonths[key];
        const [y, m] = key.split('-');
        const monthLabel = format(new Date(parseInt(y), parseInt(m) - 1, 1), 'MMMM yyyy');
        return (
          <div key={key} className="insight-card rounded-2xl overflow-hidden">
            <button onClick={() => toggle(key)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition">
              <div className="w-9 h-9 rounded-xl bg-[#2E5A1A]/10 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-4 h-4 text-[#2E5A1A]" />
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="text-sm font-bold text-slate-900">{monthLabel}</p>
                <p className="text-xs text-slate-400">
                  {monthBookings.length} booking{monthBookings.length !== 1 ? 's' : ''} · {fmtGBP(total, { decimals: 0 })}
                </p>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
              <div className="px-4 pb-4 pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-slate-100">
                {monthBookings.map(b => (
                  <BookingSummaryCard key={b.id} booking={b} onEdit={onEdit} onDelete={onDelete} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}