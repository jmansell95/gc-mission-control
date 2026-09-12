import React from 'react';
import { format, addDays, parseISO } from 'date-fns';
import { CalendarClock, ArrowRight, AlertTriangle } from 'lucide-react';

// Shows how approved delays have shifted the project end date. Compares the
// original end date (job.end_date) with the extended end date (job.end_date +
// sum of approved impacted_days). Only renders when there are approved delays
// with a day impact.
export default function DelayScheduleImpact({ job, totalApprovedDays }) {
  if (totalApprovedDays <= 0 || !job?.end_date) return null;

  const originalEnd = parseISO(job.end_date + 'T00:00:00');
  const extendedEnd = addDays(originalEnd, totalApprovedDays);

  return (
    <div className="hub-glass rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
          <CalendarClock className="w-4 h-4 text-amber-600" />
        </div>
        <h3 className="text-sm font-semibold text-slate-900">Schedule Impact</h3>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[120px]">
          <p className="text-[10px] uppercase font-medium text-slate-400 tracking-wide mb-0.5">Original End Date</p>
          <p className="text-sm font-bold text-slate-700">{format(originalEnd, 'dd MMM yyyy')}</p>
        </div>
        <div className="flex flex-col items-center px-2">
          <ArrowRight className="w-4 h-4 text-amber-500" />
          <span className="text-[10px] font-bold text-amber-600 mt-0.5">+{totalApprovedDays}d</span>
        </div>
        <div className="flex-1 min-w-[120px]">
          <p className="text-[10px] uppercase font-medium text-slate-400 tracking-wide mb-0.5">Shifted End Date</p>
          <p className="text-sm font-bold text-amber-700">{format(extendedEnd, 'dd MMM yyyy')}</p>
        </div>
      </div>
      <div className="flex items-start gap-1.5 mt-3 pt-3 border-t border-slate-100">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-slate-500">
          {totalApprovedDays} working day{totalApprovedDays !== 1 ? 's' : ''} added by approved delays. Future rota assignments have been automatically shifted.
        </p>
      </div>
    </div>
  );
}