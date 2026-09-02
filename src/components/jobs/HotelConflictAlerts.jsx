import React from 'react';
import { AlertTriangle, Copy, CalendarX } from 'lucide-react';
import { format, parseISO } from 'date-fns';

// Detects two accommodation issues:
// 1. Duplicate bookings — same hotel booked twice for overlapping dates
// 2. Date conflicts — same crew member assigned to two different hotels on
//    the same night (double-booked)
// Returns an array of alert objects, rendered by the parent component.
//
// Each alert carries an `overlap` string — the exact nights where the two
// bookings clash — so the warning banner can tell the manager where to look.
const overlapNights = (aCi, aCo, bCi, bCo) => {
  // Overlap window: latest check-in → earliest check-out. Check-out is the
  // morning the guest leaves, so the last overlapping *night* is the day
  // before the earliest check-out.
  const start = aCi > bCi ? aCi : bCi;
  const endCo = aCo < bCo ? aCo : bCo;
  const lastNight = new Date(endCo);
  lastNight.setDate(lastNight.getDate() - 1);
  if (format(start, 'yyyy-MM') === format(lastNight, 'yyyy-MM')) {
    return `${format(start, 'dd')}–${format(lastNight, 'dd MMM')}`;
  }
  return `${format(start, 'dd MMM')}–${format(lastNight, 'dd MMM')}`;
};

export function detectHotelConflicts(bookings) {
  const alerts = [];

  // 1. Duplicate bookings: same hotel_name + overlapping date ranges
  for (let i = 0; i < bookings.length; i++) {
    for (let j = i + 1; j < bookings.length; j++) {
      const a = bookings[i];
      const b = bookings[j];
      if (!a.hotel_name || !b.hotel_name) continue;
      if (a.hotel_name.toLowerCase() !== b.hotel_name.toLowerCase()) continue;
      if (!a.check_in_date || !a.check_out_date || !b.check_in_date || !b.check_out_date) continue;
      const aCi = parseISO(a.check_in_date + 'T00:00:00');
      const aCo = parseISO(a.check_out_date + 'T00:00:00');
      const bCi = parseISO(b.check_in_date + 'T00:00:00');
      const bCo = parseISO(b.check_out_date + 'T00:00:00');
      if (aCi < bCo && bCi < aCo) {
        alerts.push({
          type: 'duplicate',
          hotel: a.hotel_name,
          dates: `${format(aCi, 'dd MMM')}–${format(aCo, 'dd MMM')} & ${format(bCi, 'dd MMM')}–${format(bCo, 'dd MMM')}`,
          overlap: overlapNights(aCi, aCo, bCi, bCo),
          refA: a.booking_reference,
          refB: b.booking_reference,
        });
      }
    }
  }

  // 2. Date conflicts: same staff_id in two bookings that overlap
  const staffBookings = {};
  bookings.forEach(b => {
    (b.assigned_staff_ids || []).forEach(sid => {
      if (!staffBookings[sid]) staffBookings[sid] = [];
      staffBookings[sid].push(b);
    });
  });
  for (const [sid, staffBookingsList] of Object.entries(staffBookings)) {
    for (let i = 0; i < staffBookingsList.length; i++) {
      for (let j = i + 1; j < staffBookingsList.length; j++) {
        const a = staffBookingsList[i];
        const b = staffBookingsList[j];
        if (!a.check_in_date || !a.check_out_date || !b.check_in_date || !b.check_out_date) continue;
        const aCi = parseISO(a.check_in_date + 'T00:00:00');
        const aCo = parseISO(a.check_out_date + 'T00:00:00');
        const bCi = parseISO(b.check_in_date + 'T00:00:00');
        const bCo = parseISO(b.check_out_date + 'T00:00:00');
        if (aCi < bCo && bCi < aCo) {
          const staffName = a.assigned_staff_names?.[a.assigned_staff_ids?.indexOf(sid)] || '';
          alerts.push({
            type: 'conflict',
            staff: staffName || sid,
            hotels: `${a.hotel_name} & ${b.hotel_name}`,
            dates: `${format(aCi, 'dd MMM')}–${format(aCo, 'dd MMM')}`,
            overlap: overlapNights(aCi, aCo, bCi, bCo),
            bookingA: a.hotel_name,
            bookingB: b.hotel_name,
            spanA: `${format(aCi, 'dd MMM')}–${format(aCo, 'dd MMM')}`,
            spanB: `${format(bCi, 'dd MMM')}–${format(bCo, 'dd MMM')}`,
          });
        }
      }
    }
  }

  return alerts;
}

// Renders the conflict alerts as warning banners. Returns null when there
// are no issues so the UI stays clean.
export default function HotelConflictAlerts({ bookings }) {
  const alerts = detectHotelConflicts(bookings);
  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((alert, i) => (
        <div
          key={i}
          className={`rounded-xl px-4 py-3 flex items-center gap-3 border ${
            alert.type === 'duplicate'
              ? 'bg-violet-50 border-violet-200'
              : 'bg-rose-50 border-rose-200'
          }`}
        >
          {alert.type === 'duplicate' ? (
            <Copy className="w-5 h-5 text-violet-600 flex-shrink-0" />
          ) : (
            <CalendarX className="w-5 h-5 text-rose-600 flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold ${alert.type === 'duplicate' ? 'text-violet-800' : 'text-rose-800'}`}>
              {alert.type === 'duplicate'
                ? `Duplicate booking: ${alert.hotel}`
                : `Double-booked crew: ${alert.staff}`}
            </p>
            <div className={`text-xs ${alert.type === 'duplicate' ? 'text-violet-600' : 'text-rose-600'}`}>
              <p>
                {alert.type === 'duplicate'
                  ? `Overlapping dates — ${alert.dates}`
                  : `Assigned to ${alert.hotels} on ${alert.dates}`}
              </p>
              <p className="mt-0.5 font-medium">
                {alert.type === 'duplicate'
                  ? `↳ Clashing nights: ${alert.overlap}${alert.refA || alert.refB ? ` · refs ${alert.refA || '—'} & ${alert.refB || '—'}` : ''}`
                  : `↳ Clashing nights: ${alert.overlap} · ${alert.bookingA} (${alert.spanA}) vs ${alert.bookingB} (${alert.spanB})`}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}