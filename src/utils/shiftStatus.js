// Shared shift-pipeline status helper used by the Compliance Hub widget,
// the rota builder, and the staff AssignmentCard.
//
// The four pipeline stages, in order:
//   1. checks   — daily pre-work checks completed
//   2. arrive   — confirmed arrival on site
//   3. briefing — site briefing signed
//   4. working  — job started (status = 'started')

export const SHIFT_STAGES = [
  { id: 'checks', label: 'Checks', icon: 'ClipboardCheck', short: 'Checks' },
  { id: 'arrive', label: 'On Site', icon: 'MapPin', short: 'Arrived' },
  { id: 'briefing', label: 'Briefing', icon: 'ShieldCheck', short: 'Briefed' },
  { id: 'working', label: 'Working', icon: 'Briefcase', short: 'Started' },
];

/**
 * Computes the shift pipeline state for a single RotaAssignment.
 * Returns { stages, currentStage, completedCount, timestamps }.
 *
 * stages: array of { id, label, icon, done, timestamp }
 * currentStage: the first stage that is NOT done (or null if all done)
 * completedCount: how many of the 4 stages are done
 */
export function getShiftPipeline(assignment) {
  if (!assignment) return { stages: [], currentStage: null, completedCount: 0, timestamps: {} };

  const stages = [
    {
      id: 'checks',
      label: 'Checks',
      icon: 'ClipboardCheck',
      done: !!assignment.daily_checks_completed,
      timestamp: assignment.daily_checks_completed_at || null,
    },
    {
      id: 'arrive',
      label: 'On Site',
      icon: 'MapPin',
      done: !!assignment.arrived_on_site_at,
      timestamp: assignment.arrived_on_site_at || null,
    },
    {
      id: 'briefing',
      label: 'Briefing',
      icon: 'ShieldCheck',
      done: !!assignment.briefing_signed,
      timestamp: assignment.briefing_signed_at || null,
    },
    {
      id: 'working',
      label: 'Working',
      icon: 'Briefcase',
      done: (assignment.status || 'assigned') === 'started' || (assignment.status || 'assigned') === 'completed',
      timestamp: assignment.started_at || null,
    },
  ];

  const currentStage = stages.find(s => !s.done) || null;
  const completedCount = stages.filter(s => s.done).length;

  return { stages, currentStage, completedCount, timestamps: {} };
}

/**
 * Returns a tailwind colour class set for a stage based on its state.
 * done = green, current (first not-done) = amber, pending = slate.
 */
export function getStageColors(stage, isCurrent) {
  if (stage.done) {
    return {
      dot: 'bg-emerald-500',
      ring: 'ring-emerald-400/40',
      text: 'text-emerald-600',
      line: 'bg-emerald-400',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
    };
  }
  if (isCurrent) {
    return {
      dot: 'bg-amber-500',
      ring: 'ring-amber-400/40',
      text: 'text-amber-600',
      line: 'bg-amber-300',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
    };
  }
  return {
    dot: 'bg-slate-300',
    ring: 'ring-slate-300/30',
    text: 'text-slate-400',
    line: 'bg-slate-200',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
  };
}

/**
 * Returns a short status label for an assignment's shift pipeline.
 * e.g. "Checks done · On site" or "Not started" or "Fully signed on"
 */
export function getShiftStatusLabel(assignment) {
  const { stages, completedCount } = getShiftPipeline(assignment);
  if (completedCount === 0) return 'Not started';
  if (completedCount === 4) return 'Fully signed on';
  const doneStages = stages.filter(s => s.done);
  return doneStages.map(s => s.label).join(' · ');
}