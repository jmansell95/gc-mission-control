import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, startOfWeek, endOfWeek } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar, Loader2, Users } from 'lucide-react';

const REASON_STYLES = {
  holiday: { bg: 'bg-rose-100', text: 'text-rose-700', label: 'AL' },
  sick: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'S' },
  personal: { bg: 'bg-violet-100', text: 'text-violet-700', label: 'P' },
  training: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'T' },
  other: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'O' },
};

export default function AvailabilityCalendar() {
  const [month, setMonth] = useState(new Date());

  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const { data: staff = [], isLoading: staffLoading } = useQuery({
    queryKey: ['staff-availability'],
    queryFn: () => base44.entities.Staff.filter({ is_active: true }),
  });

  const { data: absences = [], isLoading: absLoading } = useQuery({
    queryKey: ['absences', format(monthStart, 'yyyy-MM-dd'), format(monthEnd, 'yyyy-MM-dd')],
    queryFn: () => base44.entities.Absence.filter({ status: 'approved' }),
  });

  // Filter absences to current month
  const monthAbsences = useMemo(() => absences.filter(a => {
    const start = new Date(a.start_date + 'T00:00:00');
    const end = new Date(a.end_date + 'T00:00:00');
    return end >= monthStart && start <= monthEnd;
  }), [absences, monthStart, monthEnd]);

  // Build per-staff, per-day absence lookup
  const absenceMap = useMemo(() => {
    const map = {};
    for (const a of monthAbsences) {
      const start = new Date(a.start_date + 'T00:00:00');
      const end = new Date(a.end_date + 'T00:00:00');
      for (const day of eachDayOfInterval({ start, end })) {
        const key = `${a.staff_id}|${format(day, 'yyyy-MM-dd')}`;
        map[key] = a;
      }
    }
    return map;
  }, [monthAbsences]);

  const isLoading = staffLoading || absLoading;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button onClick={() => setMonth(addMonths(month, -1))} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h3 className="text-base font-bold text-slate-900 min-w-[140px] text-center">{format(month, 'MMMM yyyy')}</h3>
          <button onClick={() => setMonth(addMonths(month, 1))} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition">
            <ChevronRight className="w-5 h-5" />
          </button>
          <button onClick={() => setMonth(new Date())} className="text-xs font-medium text-primary hover:underline px-2 py-1">
            Today
          </button>
        </div>
        {/* Legend */}
        <div className="flex flex-wrap gap-2">
          {Object.entries(REASON_STYLES).map(([key, style]) => (
            <div key={key} className="flex items-center gap-1 text-xs">
              <span className={`w-4 h-4 rounded ${style.bg} ${style.text} flex items-center justify-center text-[9px] font-bold`}>{style.label}</span>
              <span className="text-slate-500 capitalize">{key}</span>
            </div>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-xs">
            {/* Day headers */}
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="sticky left-0 bg-slate-50 z-10 px-3 py-2 text-left font-semibold text-slate-700 min-w-[140px]">
                  <div className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-slate-400" /> Staff Member</div>
                </th>
                {days.map(d => {
                  const isToday = isSameDay(d, new Date());
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                  const inMonth = d >= monthStart && d <= monthEnd;
                  return (
                    <th key={d.toISOString()} className={`px-1 py-2 text-center font-medium min-w-[32px] ${isToday ? 'bg-primary/10' : ''} ${!inMonth ? 'text-slate-300' : isWeekend ? 'text-slate-400' : 'text-slate-600'}`}>
                      <div className="text-[9px] uppercase">{format(d, 'EEE').slice(0, 1)}</div>
                      <div className={`text-[11px] font-bold ${isToday ? 'text-primary' : ''}`}>{format(d, 'd')}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {staff.map((s, si) => (
                <tr key={s.id} className={si % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}>
                  <td className={`sticky left-0 z-10 px-3 py-1.5 border-r border-slate-100 bg-inherit`}>
                    <p className="font-medium text-slate-800 text-xs truncate max-w-[130px]">{s.name}</p>
                    {s.job_title && <p className="text-[10px] text-slate-400 truncate max-w-[130px]">{s.job_title}</p>}
                  </td>
                  {days.map(d => {
                    const key = `${s.id}|${format(d, 'yyyy-MM-dd')}`;
                    const absence = absenceMap[key];
                    const isToday = isSameDay(d, new Date());
                    const inMonth = d >= monthStart && d <= monthEnd;
                    if (!inMonth) return <td key={d.toISOString()} className="bg-slate-50/50" />;
                    return (
                      <td key={d.toISOString()} className={`px-0.5 py-0.5 text-center ${isToday ? 'bg-primary/5' : ''}`}>
                        {absence && (() => {
                          const style = REASON_STYLES[absence.reason] || REASON_STYLES.other;
                          return (
                            <div
                              className={`w-6 h-6 rounded ${style.bg} ${style.text} flex items-center justify-center text-[9px] font-bold mx-auto`}
                              title={`${absence.reason}: ${absence.notes || format(new Date(absence.start_date), 'dd MMM')} → ${format(new Date(absence.end_date), 'dd MMM')}`}
                            >
                              {style.label}
                            </div>
                          );
                        })()}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}