import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Clock, MapPin, Check } from 'lucide-react';
import RigLinkPill from '@/components/rota/RigLinkPill';

// WeeklyRotaView — responsive weekly schedule for field staff.
// Mobile: a horizontal day picker + the selected day's shift cards.
// Tablet (md+): a full 7-column week grid showing every day at a glance.
// Each shift card has one-tap confirm/decline. Replaces the old day-grouped
// list with a touch-first rota that scales to tablet.
export default function WeeklyRotaView({ assignments = [], jobs = [], vehicles = [], staff }) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedDay, setSelectedDay] = useState(() => new Date());

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');

  // Fetch all rigs + all assignments for the week so the rig pill can resolve
  // the crew partner (the other crew member on the same rig that day).
  const { data: rigs = [] } = useQuery({ queryKey: ['rigs-field-rota'], queryFn: () => base44.entities.SiteAsset.filter({ is_rig: true }) });
  const { data: allWeekAssignments = [] } = useQuery({
    queryKey: ['week-assignments-field', weekStartStr],
    queryFn: () => base44.entities.RotaAssignment.filter({ week_start: weekStartStr }),
  });

  const assignmentsByDate = useMemo(() => {
    const map = {};
    for (const a of assignments) {
      if (!map[a.assigned_date]) map[a.assigned_date] = [];
      map[a.assigned_date].push(a);
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => (a.start_time || '23:59').localeCompare(b.start_time || '23:59'));
    }
    return map;
  }, [assignments]);

  const jobFor = (id) => jobs.find((j) => j.id === id);
  const today = new Date();
  const shiftWeek = (delta) => setWeekStart(addDays(weekStart, delta * 7));

  return (
    <div className="space-y-3">
      {/* Week header */}
      <div className="flex items-center justify-between px-1">
        <button onClick={() => shiftWeek(-1)} type="button" className="p-2 rounded-xl hover:bg-slate-100 active:scale-95 transition">
          <ChevronLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div className="text-center">
          <p className="text-sm font-extrabold text-slate-900">
            {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}
          </p>
          <p className="text-[11px] text-slate-400">Week {format(weekStart, 'I')}</p>
        </div>
        <button onClick={() => shiftWeek(1)} type="button" className="p-2 rounded-xl hover:bg-slate-100 active:scale-95 transition">
          <ChevronRight className="w-5 h-5 text-slate-600" />
        </button>
      </div>

      {/* Mobile: horizontal day picker */}
      <div className="md:hidden flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {days.map((d) => {
          const dateStr = format(d, 'yyyy-MM-dd');
          const count = (assignmentsByDate[dateStr] || []).length;
          const isToday = isSameDay(d, today);
          const isSelected = isSameDay(d, selectedDay);
          return (
            <button
              key={dateStr}
              onClick={() => setSelectedDay(d)}
              type="button"
              className={`flex-shrink-0 flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition active:scale-95 ${
                isSelected
                  ? 'bg-primary text-white shadow-md'
                  : isToday
                  ? 'bg-emerald-50 text-primary border border-emerald-200'
                  : 'bg-white border border-slate-200 text-slate-600'
              }`}
            >
              <span className="text-[10px] font-bold uppercase">{format(d, 'EEE')}</span>
              <span className="text-base font-extrabold leading-none">{format(d, 'd')}</span>
              <span className={`w-1.5 h-1.5 rounded-full ${count > 0 ? (isSelected ? 'bg-white' : 'bg-primary') : 'bg-transparent'}`} />
            </button>
          );
        })}
      </div>

      {/* Mobile: selected day shifts */}
      <div className="md:hidden space-y-2.5">
        <DayColumn
          date={selectedDay}
          assignments={assignmentsByDate[format(selectedDay, 'yyyy-MM-dd')] || []}
          jobFor={jobFor}
          isToday={isSameDay(selectedDay, today)}
          rigs={rigs}
          allAssignments={allWeekAssignments}
          staff={staff}
        />
      </div>

      {/* Tablet: full week grid */}
      <div className="hidden md:grid grid-cols-7 gap-2">
        {days.map((d) => (
          <DayColumn
            key={format(d, 'yyyy-MM-dd')}
            date={d}
            assignments={assignmentsByDate[format(d, 'yyyy-MM-dd')] || []}
            jobFor={jobFor}
            isToday={isSameDay(d, today)}
            grid
            rigs={rigs}
            allAssignments={allWeekAssignments}
            staff={staff}
          />
        ))}
      </div>
    </div>
  );
}

function DayColumn({ date, assignments, jobFor, isToday, grid, rigs, allAssignments, staff }) {
  return (
    <div
      className={`rounded-2xl ${grid ? 'min-h-[220px]' : ''} ${
        isToday ? 'bg-emerald-50/50 border border-emerald-200' : 'bg-white border border-slate-200'
      }`}
    >
      {grid && (
        <div className={`px-2.5 py-2 border-b ${isToday ? 'border-emerald-200' : 'border-slate-100'}`}>
          <p className={`text-[11px] font-bold uppercase ${isToday ? 'text-primary' : 'text-slate-500'}`}>
            {format(date, 'EEE')}
          </p>
          <p className="text-sm font-extrabold text-slate-900">{format(date, 'd MMM')}</p>
        </div>
      )}
      <div className="p-2 space-y-2">
        {assignments.length === 0 ? (
          grid && <p className="text-[11px] text-slate-300 text-center py-4">No shifts</p>
        ) : (
          assignments.map((a) => (
            <RotaShiftCard key={a.id} assignment={a} job={jobFor(a.job_id)} rigs={rigs} allAssignments={allAssignments} staff={staff} />
          ))
        )}
      </div>
    </div>
  );
}

function RotaShiftCard({ assignment, job, rigs, allAssignments, staff }) {
  return (
    <div className="rounded-xl p-2.5 bg-slate-50 border border-slate-200">
      <p className="text-xs font-bold text-slate-900 truncate">{assignment.assignment_type === 'yard_depot' ? 'Depot Duty' : (job?.name || 'Shift')}</p>
      <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-500">
        {assignment.start_time && (
          <span className="flex items-center gap-0.5">
            <Clock className="w-3 h-3" /> {assignment.start_time}
          </span>
        )}
        {job?.location && (
          <span className="flex items-center gap-0.5 truncate">
            <MapPin className="w-3 h-3" /> <span className="truncate">{job.location.split(',')[0]}</span>
          </span>
        )}
      </div>
      {assignment.rig_asset_id && (
        <div className="mt-1.5">
          <RigLinkPill assignment={assignment} rigs={rigs} allAssignments={allAssignments} staff={staff} size="sm" />
        </div>
      )}
      <p className="text-[10px] font-bold text-primary mt-1.5 flex items-center gap-1">
        <Check className="w-3 h-3" /> Scheduled
      </p>
    </div>
  );
}