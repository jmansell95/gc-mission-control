import React, { useState } from 'react';
import { Users, ChevronRight, Clock, MapPin, ClipboardCheck } from 'lucide-react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getJobPrimaryType } from '@/utils/jobTeams';

const jobTypeColors = {
  drilling: { bg: 'bg-amber-50', border: 'border-amber-400', text: 'text-amber-800', dot: 'bg-amber-500', badge: 'bg-amber-100 text-amber-700' },
  groundworks: { bg: 'bg-emerald-50', border: 'border-emerald-400', text: 'text-emerald-800', dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700' },
  cp_drilling: { bg: 'bg-amber-50', border: 'border-amber-400', text: 'text-amber-800', dot: 'bg-amber-500', badge: 'bg-amber-100 text-amber-700' },
  rotary_drilling: { bg: 'bg-blue-50', border: 'border-blue-400', text: 'text-blue-800', dot: 'bg-blue-500', badge: 'bg-blue-100 text-blue-700' },
  enabling_works: { bg: 'bg-purple-50', border: 'border-purple-400', text: 'text-purple-800', dot: 'bg-purple-500', badge: 'bg-purple-100 text-purple-700' },
  depot: { bg: 'bg-slate-50', border: 'border-slate-400', text: 'text-slate-700', dot: 'bg-slate-400', badge: 'bg-slate-100 text-slate-700' }
};

const statusConfig = {
  assigned: { label: 'Assigned', icon: Clock, dot: 'bg-slate-400', text: 'text-slate-500' },
  started: { label: 'Started', icon: Clock, dot: 'bg-blue-500', text: 'text-blue-600' },
  completed: { label: 'Done', icon: Clock, dot: 'bg-emerald-500', text: 'text-emerald-600' }
};

/**
 * TodayCrewPopup — button + popup showing today's crew grouped by job.
 * Replaces the inline collapsible panel that used to sit under the filters.
 */
export default function TodayCrewPopup({ rotas, staff, jobs, teams, todayStr, onEditAssignment }) {
  const [open, setOpen] = useState(false);

  const todayRotas = rotas.filter(r => r.assigned_date === todayStr && (!r.assignment_type || r.assignment_type === 'job' || r.assignment_type === 'yard_depot'));
  const todayCrew = [...new Set(todayRotas.map(r => r.staff_id))];
  const todayLeave = rotas.filter(r => r.assigned_date === todayStr && r.assignment_type && r.assignment_type !== 'job');

  const byJob = {};
  todayRotas.forEach(r => {
    if (r.assignment_type === 'yard_depot') {
      if (!byJob['depot']) byJob['depot'] = [];
      byJob['depot'].push(r);
    } else {
      const jid = r.job_id || 'unassigned';
      if (!byJob[jid]) byJob[jid] = [];
      byJob[jid].push(r);
    }
  });
  const jobGroups = Object.entries(byJob);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#2E5A1A] text-white rounded-lg hover:bg-[#1c4a12] transition text-sm font-semibold shadow-sm"
      >
        <Users className="w-4 h-4" />
        <span className="hidden sm:inline">Today's Crew</span>
        <span className="sm:hidden">Crew</span>
        <span className="ml-0.5 text-[10px] font-bold bg-white/20 px-1.5 py-0.5 rounded-full">{todayCrew.length}</span>
      </button>

      <Dialog open={open} onOpenChange={(o) => setOpen(o)}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 pr-8">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center flex-shrink-0">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <p>Today's Crew</p>
                <p className="text-xs font-normal text-slate-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {format(new Date(), 'EEEE dd MMM')}
                </p>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="flex items-center gap-3 text-xs pb-2 border-b border-slate-100">
            <span className="text-slate-500"><strong className="text-slate-900">{todayCrew.length}</strong> on site</span>
            <span className="text-slate-500"><strong className="text-slate-900">{jobGroups.length}</strong> jobs</span>
            {todayLeave.length > 0 && <span className="text-amber-600"><strong className="text-amber-700">{todayLeave.length}</strong> off</span>}
          </div>

          {todayRotas.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-400 flex items-center justify-center gap-2">
              <Clock className="w-4 h-4 text-slate-300" />
              No crew assigned for today — add shifts in the grid below.
            </div>
          ) : (
            <div className="space-y-2">
              {jobGroups.map(([jid, group]) => {
                const job = jobs.find(j => j.id === jid);
                const colors = jobTypeColors[getJobPrimaryType(job, teams)] || jobTypeColors.depot;
                return (
                  <div key={jid} className={`rounded-lg border ${colors.border} ${colors.bg} px-3 py-2`}>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                      <p className="text-sm font-bold text-slate-800 truncate flex-1">{jid === 'depot' ? 'Depot Duty' : (job?.name || 'Unassigned')}</p>
                      {job?.location && <span className="hidden sm:flex items-center gap-0.5 text-xs text-slate-400 truncate max-w-[140px]"><MapPin className="w-3 h-3" />{job.location}</span>}
                      <span className="text-[10px] font-bold text-slate-500 bg-white/70 rounded-full px-1.5 py-0.5 flex-shrink-0">{group.length}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {group.map(a => {
                        const member = staff.find(s => s.id === a.staff_id);
                        const status = statusConfig[a.status || 'assigned'] || statusConfig.assigned;
                        const StatusIcon = status.icon;
                        return (
                          <button key={a.id} onClick={() => { onEditAssignment(a); setOpen(false); }}
                            className="inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-full pl-1 pr-2.5 py-1 hover:shadow-sm hover:border-emerald-300 transition group">
                            <span className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                              <span className="text-emerald-700 font-bold text-[10px]">{member?.name?.charAt(0) || '?'}</span>
                            </span>
                            <span className="text-xs font-medium text-slate-700 leading-none">{member?.name || 'Unknown'}</span>
                            <StatusIcon className={`w-3 h-3 ${status.text}`} />
                            {a.briefing_signed && <ClipboardCheck className="w-3 h-3 text-emerald-500" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}