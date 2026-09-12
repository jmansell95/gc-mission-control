import React from 'react';
import { Hotel, Home, Users, MapPin, Edit2, Trash2, Calendar, PoundSterling } from 'lucide-react';
import { format } from 'date-fns';
import {
  nightsBetween, bookingType, bookingTotal, perPersonTotal, fmtGBP,
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

export default function BookingSummaryCard({ booking, onEdit, onDelete }) {
  const type = bookingType(booking);
  const isAirbnb = type === 'airbnb';
  const Icon = isAirbnb ? Home : Hotel;
  const crew = booking.assigned_staff_names || [];
  const nights = nightsBetween(booking.check_in_date, booking.check_out_date);
  const total = bookingTotal(booking);
  const perPerson = perPersonTotal(booking);

  return (
    <div className={`hub-glass rounded-2xl p-4 relative overflow-hidden ${isAirbnb ? 'border-amber-200/60' : 'border-blue-200/60'}`}>
      <div className={`absolute top-0 left-0 right-0 h-1 ${isAirbnb ? 'bg-amber-400' : 'bg-blue-400'}`} />
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isAirbnb ? 'bg-amber-100' : 'bg-blue-100'}`}>
          <Icon className={`w-5 h-5 ${isAirbnb ? 'text-amber-600' : 'text-blue-600'}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-slate-900 text-sm truncate">{booking.hotel_name}</h4>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0 ${isAirbnb ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
              {isAirbnb ? 'Air B&B' : 'Hotel'}
            </span>
          </div>
          {booking.address && (
            <p className="text-xs text-slate-400 truncate flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3 flex-shrink-0" /> {booking.address}
            </p>
          )}
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-1.5 flex-wrap">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {booking.check_in_date ? format(new Date(booking.check_in_date + 'T00:00:00'), 'dd MMM') : '—'}
              {booking.check_out_date && ` – ${format(new Date(booking.check_out_date + 'T00:00:00'), 'dd MMM')}`}
            </span>
            <span>·</span>
            <span>{nights} night{nights === 1 ? '' : 's'}</span>
            {!isAirbnb && (
              <>
                <span>·</span>
                <span>{booking.room_count || 1} room{(booking.room_count || 1) > 1 ? 's' : ''}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => onEdit(booking)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(booking)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Cost summary */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className={`rounded-lg px-3 py-2 ${isAirbnb ? 'bg-amber-50' : 'bg-blue-50'}`}>
          <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1">
            <PoundSterling className="w-3 h-3" /> Booking Total
          </p>
          <p className={`text-base font-bold ${isAirbnb ? 'text-amber-800' : 'text-blue-800'}`}>{fmtGBP(total, { decimals: 0 })}</p>
        </div>
        <div className="rounded-lg px-3 py-2 bg-slate-50">
          <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1">
            <Users className="w-3 h-3" /> Per Person
          </p>
          <p className="text-base font-bold text-slate-700">{fmtGBP(perPerson, { decimals: 0 })}</p>
          {isAirbnb && crew.length > 0 && (
            <p className="text-[10px] text-slate-400">{fmtGBP(perPerson / Math.max(1, nights), { decimals: 2 })}/night</p>
          )}
        </div>
      </div>

      {/* Crew avatars */}
      {crew.length > 0 && (
        <div className="mt-3 flex items-center gap-1.5 flex-wrap">
          {crew.slice(0, 6).map((name, i) => (
            <div key={i} className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${STAFF_COLORS[i % STAFF_COLORS.length]}`} title={name}>
              {initials(name)}
            </div>
          ))}
          {crew.length > 6 && (
            <span className="text-xs text-slate-400 font-medium">+{crew.length - 6}</span>
          )}
          <span className="text-xs text-slate-400 ml-1">{crew.length} {crew.length === 1 ? 'guest' : 'guests'}</span>
        </div>
      )}
    </div>
  );
}