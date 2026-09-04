import React from 'react';
import { format } from 'date-fns';
import { MapPin, ClipboardCheck, Clock, PlayCircle, CheckCircle2, MapPin as MapPinIcon, ShieldCheck, Briefcase } from 'lucide-react';
import { getJobPrimaryType } from '@/utils/jobTeams';
import { ErrorState, RotaSkeleton, Skeleton, SkeletonText } from '@/components/StateViews';
import RigLinkPill from '@/components/rota/RigLinkPill';
import { getShiftPipeline } from '@/utils/shiftStatus';

const STAGE_ICONS = { checks: ClipboardCheck, arrive: MapPinIcon, briefing: ShieldCheck, working: Briefcase };

// Local copies of the parent's colour maps (kept in sync with WeeklyRotaBuilder).
const jobTypeColors = {
  drilling: { bg: 'bg-amber-50', border: 'border-amber-400', text: 'text-amber-800', dot: 'bg-amber-500' },
  groundworks: { bg: 'bg-emerald-50', border: 'border-emerald-400', text: 'text-emerald-800', dot: 'bg-emerald-500' },
  cp_drilling: { bg: 'bg-amber-50', border: 'border-amber-400', text: 'text-amber-800', dot: 'bg-amber-500' },
  rotary_drilling: { bg: 'bg-blue-50', border: 'border-blue-400', text: 'text-blue-800', dot: 'bg-blue-500' },
  enabling_works: { bg: 'bg-purple-50', border: 'border-purple-400', text: 'text-purple-800', dot: 'bg-purple-500' },
  depot: { bg: 'bg-slate-50', border: 'border-slate-400', text: 'text-slate-700', dot: 'bg-slate-400' },
};

const statusConfig = {
  assigned: { label: 'Assigned', icon: Clock, text: 'text-slate-500' },
  started: { label: 'Started', icon: PlayCircle, text: 'text-blue-600' },
  completed: { label: 'Done', icon: CheckCircle2, text: 'text-emerald-600' },
};

/**
 * RotaDayCards — mobile/tablet day view of the WeeklyRotaBuilder.
 *
 * Each day is a card. Within each card, assignments are grouped by JOB (not
 * by staff), so a manager can instantly see who is on which job. Mirrors the
 * "Today's Crew" job-grouped visual: coloured job-type border + dot, job name
 * header with location + crew-count badge, then staff avatar chips.
 *
 * Depot duty and unassigned shifts get their own group. Non-job assignments
 * (leave, sick, training) are not shown here — they have no job to group under.
 */
export default function RotaDayCards({
  days,
  todayStr,
  rotas,
  filteredStaff,
  staff,
  jobs,
  teams,
  rigs,
  onEditAssignment,
  onRemoveRigLink,
  staffLoading,
  staffError,
  refetchStaff,
}) {
  if (staffLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <Skeleton className="h-5 w-24 mb-3" />
            <SkeletonText lines={3} />
          </div>
        ))}
      </div>
    );
  }
  if (staffError) {
    return <ErrorState message="Couldn't load the rota" onRetry={refetchStaff} />;
  }

  return (
    <div className="space-y-3">
      {days.map((day) => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const isToday = dayStr === todayStr;
        const dayAssignments = rotas.filter(
          (r) =>
            r.assigned_date === dayStr &&
            (!r.assignment_type || r.assignment_type === 'job' || r.assignment_type === 'yard_depot') &&
            filteredStaff.some((s) => s.id === r.staff_id)
        );

        // Group by job so each job shows its crew together.
        const byJob = {};
        dayAssignments.forEach((r) => {
          const key = r.assignment_type === 'yard_depot' ? 'depot' : r.job_id || 'unassigned';
          if (!byJob[key]) byJob[key] = [];
          byJob[key].push(r);
        });
        Object.values(byJob).forEach((arr) =>
          arr.sort((a, b) => (a.start_time || '23:59').localeCompare(b.start_time || '23:59'))
        );
        const jobGroups = Object.entries(byJob);
        const crewCount = new Set(dayAssignments.map((r) => r.staff_id)).size;

        return (
          <div
            key={dayStr}
            className={`bg-white rounded-xl border shadow-sm overflow-hidden ${
              isToday ? 'border-emerald-400 ring-1 ring-emerald-200' : 'border-slate-200'
            }`}
          >
            <div
              className={`px-4 py-3 flex items-center justify-between ${
                isToday
                  ? 'bg-gradient-to-r from-emerald-700 to-emerald-600 text-white'
                  : 'bg-slate-50 border-b border-slate-100'
              }`}
            >
              <div className="flex items-center gap-2">
                {isToday && <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />}
                <span className={`font-bold text-sm ${isToday ? 'text-white' : 'text-slate-800'}`}>
                  {format(day, 'EEEE')}
                </span>
              </div>
              <span className={`text-xs font-medium ${isToday ? 'text-emerald-100' : 'text-slate-500'}`}>
                {format(day, 'dd MMM')} · {dayAssignments.length} shifts · {crewCount} crew
              </span>
            </div>

            {dayAssignments.length === 0 ? (
              <p className="px-4 py-3 text-xs text-slate-400">No assignments</p>
            ) : (
              <div className="p-3 space-y-2">
                {jobGroups.map(([jid, group]) => {
                  const job = jobs.find((j) => j.id === jid);
                  const colors =
                    jid === 'depot'
                      ? { bg: 'bg-amber-50', border: 'border-amber-400', dot: 'bg-amber-500' }
                      : jobTypeColors[getJobPrimaryType(job, teams)] || jobTypeColors.depot;
                  return (
                    <div key={jid} className={`rounded-lg border ${colors.border} ${colors.bg} px-3 py-2`}>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                        <p className="text-sm font-bold text-slate-800 truncate flex-1">
                          {jid === 'depot' ? 'Depot Duty' : job?.name || 'Unassigned'}
                        </p>
                        {job?.location && (
                          <span className="hidden sm:flex items-center gap-0.5 text-xs text-slate-400 truncate max-w-[140px]">
                            <MapPin className="w-3 h-3" />
                            {job.location}
                          </span>
                        )}
                        <span className="text-[10px] font-bold text-slate-500 bg-white/70 rounded-full px-1.5 py-0.5 flex-shrink-0">
                          {group.length}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {group.map((a) => {
                          const member = staff.find((s) => s.id === a.staff_id);
                          const status = statusConfig[a.status || 'assigned'] || statusConfig.assigned;
                          const StatusIcon = status.icon;
                          const { stages, completedCount } = getShiftPipeline(a);
                          return (
                            <div key={a.id} className="flex flex-col items-start gap-1">
                              <button
                                onClick={() => onEditAssignment(a)}
                                className="inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-full pl-1 pr-2.5 py-1 hover:shadow-sm hover:border-emerald-300 transition"
                              >
                                <span className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                                  <span className="text-emerald-700 font-bold text-[10px]">
                                    {member?.name?.charAt(0) || '?'}
                                  </span>
                                </span>
                                <span className="text-xs font-medium text-slate-700 leading-none">
                                  {member?.name || 'Unknown'}
                                </span>
                                <StatusIcon className={`w-3 h-3 ${status.text}`} />
                                {a.briefing_signed && <ClipboardCheck className="w-3 h-3 text-emerald-500" />}
                              </button>
                              {/* Mini shift pipeline — 4 dots showing checks → arrive → briefing → working */}
                              {completedCount > 0 && (
                                <div className="flex items-center gap-0.5 pl-1">
                                  {stages.map((stage, si) => {
                                    const StageIcon = STAGE_ICONS[stage.id];
                                    return (
                                      <React.Fragment key={stage.id}>
                                        <div
                                          className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${stage.done ? 'bg-emerald-500' : 'bg-slate-200'}`}
                                          title={stage.done && stage.timestamp ? `${stage.label}: ${format(new Date(stage.timestamp), 'HH:mm')}` : stage.label}
                                        >
                                          {stage.done ? (
                                            <CheckCircle2 className="w-2 h-2 text-white" />
                                          ) : (
                                            <StageIcon className="w-2 h-2 text-slate-400" />
                                          )}
                                        </div>
                                        {si < stages.length - 1 && (
                                          <div className={`w-2 h-px ${stages[si].done ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                                        )}
                                      </React.Fragment>
                                    );
                                  })}
                                </div>
                              )}
                              {a.rig_asset_id && (
                                <RigLinkPill assignment={a} rigs={rigs} allAssignments={rotas} staff={staff} onRemove={onRemoveRigLink} size="xs" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}