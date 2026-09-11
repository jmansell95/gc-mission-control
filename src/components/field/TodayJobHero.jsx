import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Clock, ChevronRight, Play, CalendarClock, Users } from 'lucide-react';
import { format } from 'date-fns';

/**
 * TodayJobHero — the prominent today's-job card on the field dashboard.
 * Shows the next assignment with a gradient Start Shift button that
 * navigates to the today schedule page where the ShiftWizard lives.
 */
export default function TodayJobHero({ assignment, job, client, staffName }) {
  const navigate = useNavigate();

  if (!assignment) {
    return (
      <div className="field-card p-5 text-center">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200/50 flex items-center justify-center mx-auto mb-3">
          <CalendarClock className="w-7 h-7 text-slate-400" strokeWidth={2.5} />
        </div>
        <p className="text-sm font-bold text-slate-900 mb-1">No jobs today</p>
        <p className="text-xs text-slate-500 mb-3">Check upcoming shifts or contact your manager.</p>
        <button onClick={() => navigate('/upcoming')} type="button"
          className="text-xs font-semibold text-[#2E5A1A] hover:underline">
          View upcoming →
        </button>
      </div>
    );
  }

  const isDepot = assignment.assignment_type === 'yard_depot';
  const isCompleted = (assignment.status || 'assigned') === 'completed';
  const isStarted = assignment.status === 'started';

  return (
    <div className="field-card overflow-hidden">
      {/* Gradient header strip */}
      <div className="hero-gradient px-4 py-3 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/80">
              {isCompleted ? 'Completed' : isStarted ? 'In Progress' : isDepot ? 'Depot Duty' : "Today's Job"}
            </span>
          </div>
          <span className="text-[10px] font-medium text-white/70">
            {format(new Date(), 'EEE dd MMM')}
          </span>
        </div>
        <h3 className="text-base font-bold mt-1 leading-tight truncate">{job?.name || 'Shift'}</h3>
        {job?.location && (
          <div className="flex items-center gap-1 mt-0.5">
            <MapPin className="w-3 h-3 text-white/60 flex-shrink-0" />
            <p className="text-xs text-white/80 truncate">{job.location}</p>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-3 text-xs text-slate-500">
          {assignment.start_time && (
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-[#2E5A1A]/60" />
              <span className="font-medium">{assignment.start_time}</span>
            </div>
          )}
          {client?.name && (
            <div className="flex items-center gap-1 min-w-0">
              <Users className="w-3.5 h-3.5 text-[#2E5A1A]/60 flex-shrink-0" />
              <span className="truncate">{client.name}</span>
            </div>
          )}
        </div>

        {!isCompleted && (
          <button
            onClick={() => navigate('/today-schedule')}
            type="button"
            className="w-full flex items-center justify-center gap-2 px-4 py-3.5 command-gradient text-white rounded-2xl text-sm font-bold active:scale-95 transition touch-manipulation shadow-lg shadow-[#2E5A1A]/25 glow-brand"
          >
            <Play className="w-4 h-4" fill="currentColor" />
            {isStarted ? 'Continue Shift' : 'Start Shift'}
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
        {isCompleted && (
          <div className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-50 text-emerald-700 rounded-2xl text-sm font-bold">
            <CalendarClock className="w-4 h-4" />
            Shift completed
          </div>
        )}
      </div>
    </div>
  );
}