import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Calendar, GraduationCap, Users, X,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, parseISO } from 'date-fns';

/**
 * TrainingCalendar — month calendar showing booked training courses on
 * their scheduled dates. Click a day to see the courses and booked
 * staff for that day, each linking to the staff profile.
 */
export default function TrainingCalendar({ courses, bookings, staff, teams }) {
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);

  const staffName = (id) => staff.find(s => s.id === id)?.name || 'Unknown';
  const teamName = (id) => {
    const t = teams.find(t => t.id === id);
    return t ? t.name : '';
  };

  // Map course start_date → bookings
  const bookingsByDate = useMemo(() => {
    const map = {};
    bookings.forEach(b => {
      if (b.status !== 'booked') return;
      const course = courses.find(c => c.id === b.course_id);
      if (!course?.start_date) return;
      const dateKey = course.start_date;
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push({ booking: b, course });
    });
    return map;
  }, [bookings, courses]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = [];
  let d = calendarStart;
  while (d <= calendarEnd) {
    days.push(d);
    d = addDays(d, 1);
  }

  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const selectedDateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;
  const selectedDayBookings = selectedDateStr ? (bookingsByDate[selectedDateStr] || []) : [];

  return (
    <div className="space-y-3">
      {/* Month navigation */}
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => setCurrentMonth(new Date())}
          className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition">
          Today
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
            className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h3 className="text-base font-bold text-slate-900 min-w-[140px] text-center">
            {format(currentMonth, 'MMMM yyyy')}
          </h3>
          <button onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
            className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Calendar grid */}
        <div className="lg:col-span-2 hub-glass rounded-2xl p-3">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
              <div key={day} className="text-center text-[10px] font-bold text-slate-400 uppercase py-1">{day}</div>
            ))}
          </div>
          {/* Day cells */}
          <div className="grid grid-cols-7 gap-1">
            {days.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const dayBookings = bookingsByDate[dateStr] || [];
              const inMonth = isSameMonth(day, currentMonth);
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedDateStr;
              return (
                <button key={dateStr}
                  onClick={() => setSelectedDate(day)}
                  className={`relative min-h-[64px] p-1.5 rounded-lg border text-left transition ${
                    isSelected ? 'border-[#2E5A1A] bg-[#2E5A1A]/5 ring-1 ring-[#2E5A1A]/20'
                    : isToday ? 'border-[#8DC63F] bg-[#8DC63F]/5'
                    : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                  } ${!inMonth ? 'opacity-40' : ''}`}
                >
                  <span className={`text-[11px] font-bold ${isToday ? 'text-[#2E5A1A]' : 'text-slate-600'}`}>
                    {format(day, 'd')}
                  </span>
                  {dayBookings.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {dayBookings.slice(0, 2).map(({ course }, i) => (
                        <div key={i} className="text-[9px] font-medium px-1 py-0.5 rounded bg-blue-100 text-blue-700 truncate">
                          {course.title}
                        </div>
                      ))}
                      {dayBookings.length > 2 && (
                        <div className="text-[9px] text-slate-400 px-1">+{dayBookings.length - 2} more</div>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected day details */}
        <div className="hub-glass rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-[#2E5A1A]" />
            <h4 className="text-sm font-bold text-slate-900">
              {selectedDate ? format(selectedDate, 'EEEE, dd MMM') : 'Select a day'}
            </h4>
          </div>
          {selectedDate ? (
            selectedDayBookings.length === 0 ? (
              <div className="text-center py-6">
                <GraduationCap className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-xs text-slate-400">No courses booked on this day</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {selectedDayBookings.map(({ booking, course }) => {
                  const courseBookings = bookings.filter(b => b.course_id === course.id && b.status === 'booked');
                  return (
                    <div key={booking.id || course.id} className="rounded-xl border border-blue-100 bg-blue-50/50 p-3">
                      <div className="flex items-start gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <GraduationCap className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-900 truncate">{course.title}</p>
                          <p className="text-[10px] text-slate-400">
                            {course.start_date ? format(parseISO(course.start_date), 'dd MMM') : 'TBC'}
                            {course.venue ? ` · ${course.venue}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-1">
                        {courseBookings.map(b => {
                          const s = staff.find(st => st.id === b.staff_id);
                          return (
                            <button key={b.id}
                              onClick={() => navigate('/staff-profile', { state: { staffId: b.staff_id } })}
                              className="w-full flex items-center gap-2 p-1.5 rounded-lg bg-white hover:bg-blue-50 transition text-left">
                              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#2E5A1A] to-[#8DC63F] flex items-center justify-center flex-shrink-0">
                                <span className="text-white font-bold text-[9px]">{(s?.name || '?').charAt(0)}</span>
                              </div>
                              <span className="text-[11px] font-medium text-slate-700 truncate flex-1">{s?.name || 'Unknown'}</span>
                              <span className="text-[10px] text-slate-400 truncate">{teamName(s?.team_id)}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <div className="text-center py-6">
              <Users className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-xs text-slate-400">Click a day to see who's booked</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}