import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Warehouse, Clock, Calendar, CheckCircle2, PlayCircle, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';

const statusConfig = {
  assigned: { label: 'Assigned', badge: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200' },
  started: { label: 'In Progress', badge: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' },
  completed: { label: 'Completed', badge: 'bg-[#2E5A1A]/10 text-[#2E5A1A] ring-1 ring-[#2E5A1A]/20' },
};

/**
 * DepotAssignmentCard — the staff-facing card for Yard/Depot duty shifts.
 *
 * Depot shifts have no job, so the job-centric AssignmentCard can't render them.
 * This card shows the shift details and a Start/Continue button that opens the
 * lighter DepotShiftWizard (checks + clock in/out).
 */
export default function DepotAssignmentCard({ assignment, staff, onOpenShiftWizard, canPerformActions = true, defaultExpanded = false }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const status = statusConfig[assignment.status || 'assigned'] || statusConfig.assigned;
  const scheduledStart = new Date(assignment.assigned_date + 'T' + (assignment.start_time || '00:00:00'));
  const canStart = new Date() >= scheduledStart;

  return (
    <motion.div variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } } }}
      className="insight-card rounded-3xl overflow-hidden">
      <div className="h-1.5 bg-amber-400" />

      {/* Compact header — always visible */}
      <button onClick={() => setExpanded(e => !e)} className="w-full text-left p-4 md:p-5 flex items-start gap-3 hover:bg-slate-50/40 transition">
        <div className={`w-3 h-3 rounded-full mt-1.5 flex-shrink-0 ring-2 ring-offset-2 ring-offset-white ${assignment.status === 'completed' ? 'bg-[#2E5A1A] ring-[#2E5A1A]/20' : assignment.status === 'started' ? 'bg-blue-500 ring-blue-500/20' : 'bg-amber-400 ring-amber-200'}`} />
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold text-slate-900 leading-tight truncate tracking-tight flex items-center gap-2">
            <Warehouse className="w-5 h-5 text-amber-500 flex-shrink-0" /> Yard / Depot Duty
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-700">Depot</span>
            {assignment.is_overtime && (
              <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-700">
                OT{assignment.rate_multiplier ? ` ${Number(assignment.rate_multiplier)}x` : ''}
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-sm text-slate-500">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="font-medium">{format(new Date(assignment.assigned_date), 'EEE dd MMM')}</span>
            </span>
            {assignment.start_time && (
              <span className="inline-flex items-center gap-1 text-sm text-slate-500">
                <Clock className="w-4 h-4 text-slate-400" />
                <span className="font-medium">{assignment.start_time}{assignment.end_time ? `–${assignment.end_time}` : ''}</span>
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${status.badge}`}>
            <span className="hidden sm:inline">{status.label}</span>
          </span>
          <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-100 pt-4">
          <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-3 mb-4">
            <Warehouse className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-900 leading-relaxed">
              This is a non-chargeable depot shift. Log your hours for payroll — no job revenue is generated.
            </p>
          </div>

          {assignment.notes && (
            <div className="mb-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <p className="font-semibold text-slate-900 text-xs mb-1">Notes</p>
              <p className="text-slate-600 text-sm whitespace-pre-wrap leading-relaxed">{assignment.notes}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {(assignment.status || 'assigned') === 'assigned' && canPerformActions && (
              canStart ? (
                <button onClick={() => onOpenShiftWizard(assignment.id)}
                  className="flex items-center justify-center gap-2 px-5 py-4 bg-gradient-to-br from-[#2E5A1A] to-[#1c4a12] text-white rounded-2xl hover:shadow-lg active:scale-95 transition text-base font-bold touch-manipulation shadow-md shadow-[#2E5A1A]/25 glow-brand">
                  <PlayCircle className="w-6 h-6" strokeWidth={2.5} /> Start Depot Shift
                </button>
              ) : (
                <span className="inline-flex items-center gap-2 px-4 py-3 bg-slate-100 text-slate-500 rounded-2xl text-sm font-semibold">
                  <Clock className="w-5 h-5" /> Starts {format(new Date(assignment.assigned_date + 'T00:00:00'), 'dd MMM')}{assignment.start_time ? ` · ${assignment.start_time}` : ''}
                </span>
              )
            )}
            {assignment.status === 'started' && canPerformActions && (
              <button onClick={() => onOpenShiftWizard(assignment.id)}
                className="flex items-center justify-center gap-2 px-5 py-4 bg-gradient-to-br from-[#2E5A1A] to-[#1c4a12] text-white rounded-2xl hover:shadow-lg active:scale-95 transition text-base font-bold touch-manipulation shadow-md shadow-[#2E5A1A]/25 glow-brand">
                <PlayCircle className="w-6 h-6" strokeWidth={2.5} /> Continue Shift
              </button>
            )}
            {assignment.status === 'completed' && (
              <div className="flex items-center gap-2 px-4 py-3 bg-[#2E5A1A]/5 text-[#2E5A1A] rounded-2xl text-sm font-semibold">
                <CheckCircle2 className="w-5 h-5" /> Shift submitted for approval
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}