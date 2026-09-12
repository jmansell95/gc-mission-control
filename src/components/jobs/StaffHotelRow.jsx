import React, { useState } from 'react';
import {
  Hotel, Home, MapPin, Phone, FileText, Edit2, X, ChevronRight,
  Calendar, PoundSterling, Navigation, Plus, BedDouble,
} from 'lucide-react';
import { format } from 'date-fns';
import {
  nightsBetween, bookingType, perPersonDayRate, fmtGBP,
} from '@/components/jobs/hotelCost';

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

function MiniBookingCard({ booking, onEdit, onUnassign }) {
  const type = bookingType(booking);
  const isAirbnb = type === 'airbnb';
  const Icon = isAirbnb ? Home : Hotel;
  const nights = nightsBetween(booking.check_in_date, booking.check_out_date);
  const dayRate = perPersonDayRate(booking);

  return (
    <div className={`rounded-lg border ${isAirbnb ? 'border-amber-200 bg-amber-50/40' : 'border-blue-200 bg-blue-50/40'} p-2.5`}>
      <div className="flex items-center gap-2">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${isAirbnb ? 'bg-amber-100' : 'bg-blue-100'}`}>
          <Icon className={`w-3.5 h-3.5 ${isAirbnb ? 'text-amber-600' : 'text-blue-600'}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-slate-800 truncate">{booking.hotel_name}</p>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className={`px-1.5 py-0.5 rounded-full font-semibold ${isAirbnb ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
              {isAirbnb ? 'Air B&B' : 'Hotel'}
            </span>
            <span className="flex items-center gap-0.5">
              <Calendar className="w-2.5 h-2.5" />
              {booking.check_in_date ? format(new Date(booking.check_in_date + 'T00:00:00'), 'dd MMM') : '—'}
              {booking.check_out_date && `–${format(new Date(booking.check_out_date + 'T00:00:00'), 'dd MMM')}`}
            </span>
          </div>
        </div>
        {dayRate > 0 && (
          <span className="text-xs font-bold text-slate-700 flex items-center gap-0.5 flex-shrink-0">
            <PoundSterling className="w-3 h-3" />{fmtGBP(dayRate, { decimals: 0 })}<span className="text-[10px] font-normal text-slate-400">/night</span>
          </span>
        )}
      </div>

      {booking.address && (
        <a href={`https://maps.google.com/?q=${encodeURIComponent(booking.address + ' ' + booking.hotel_name)}`} target="_blank" rel="noopener noreferrer"
          className="flex items-start gap-1 text-[11px] text-slate-500 hover:text-blue-700 transition mt-1.5">
          <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0 mt-0.5" />
          <span className="truncate">{booking.address}</span>
          <Navigation className="w-2.5 h-2.5 text-blue-500 mt-0.5 flex-shrink-0" />
        </a>
      )}

      <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1.5 flex-wrap">
        {!isAirbnb && (booking.room_count || 1) > 1 && (
          <span className="flex items-center gap-0.5"><BedDouble className="w-3 h-3" /> {booking.room_count} rooms</span>
        )}
        {booking.booking_reference && <span className="flex items-center gap-0.5"><FileText className="w-3 h-3" /> {booking.booking_reference}</span>}
        {booking.contact_phone && (
          <a href={`tel:${booking.contact_phone}`} className="flex items-center gap-0.5 text-blue-700 font-medium hover:underline">
            <Phone className="w-3 h-3" /> {booking.contact_phone}
          </a>
        )}
      </div>

      {booking.notes && (
        <p className="text-[11px] text-slate-500 bg-white rounded-md px-2 py-1.5 border border-slate-200 mt-1.5">{booking.notes}</p>
      )}

      <div className="flex items-center gap-1.5 mt-2">
        <button onClick={() => onEdit(booking)} className="flex items-center gap-1 px-2 py-1 bg-white text-slate-600 hover:bg-slate-100 rounded-md text-[11px] font-medium transition border border-slate-200">
          <Edit2 className="w-3 h-3" /> Edit
        </button>
        <button onClick={() => onUnassign(booking)} className="flex items-center gap-1 px-2 py-1 bg-white text-amber-600 hover:bg-amber-50 rounded-md text-[11px] font-medium transition border border-slate-200">
          <X className="w-3 h-3" /> Unassign me
        </button>
      </div>
    </div>
  );
}

export default function StaffHotelRow({ staff, bookings, colorIdx, onEdit, onUnassign, onAssign }) {
  const [expanded, setExpanded] = useState(false);
  const colorClass = STAFF_COLORS[colorIdx % STAFF_COLORS.length];
  const hasBookings = bookings && bookings.length > 0;

  return (
    <div className="border-b border-slate-100 last:border-0">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition text-left">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${colorClass}`}>
          {initials(staff.name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800 truncate">{staff.name}</p>
          {hasBookings ? (
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
              {bookings.slice(0, 2).map((b, i) => {
                const Icon = bookingType(b) === 'airbnb' ? Home : Hotel;
                return (
                  <span key={b.id || i} className="flex items-center gap-0.5">
                    <Icon className={`w-3 h-3 ${bookingType(b) === 'airbnb' ? 'text-amber-500' : 'text-blue-500'}`} />
                    <span className="truncate max-w-[100px]">{b.hotel_name}</span>
                  </span>
                );
              })}
              {bookings.length > 2 && <span className="text-slate-400">+{bookings.length - 2}</span>}
            </div>
          ) : (
            <p className="text-xs text-slate-400 mt-0.5">No accommodation assigned</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {hasBookings && (
            <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full">
              {bookings.length} {bookings.length === 1 ? 'booking' : 'bookings'}
            </span>
          )}
          <ChevronRight className={`w-4 h-4 text-slate-300 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pl-16 space-y-2 bg-slate-50/50">
          {hasBookings ? (
            bookings.map(b => (
              <MiniBookingCard key={b.id} booking={b} onEdit={onEdit} onUnassign={(booking) => onUnassign(booking, staff.id)} />
            ))
          ) : (
            <div className="text-center py-2">
              <p className="text-xs text-slate-400 mb-2">No accommodation assigned to this crew member.</p>
            </div>
          )}
          <button onClick={() => onAssign(staff)} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-white text-primary hover:bg-primary/5 rounded-lg text-xs font-semibold transition border border-primary/20">
            <Plus className="w-3.5 h-3.5" /> Add booking for {staff.name.split(' ')[0]}
          </button>
        </div>
      )}
    </div>
  );
}