import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays, MapPin, Cog, Clock,
  Loader2, CalendarOff, ArrowRight, ShieldCheck, ShieldAlert, ShieldX,
  User, Phone,
} from 'lucide-react';

const STATUS_META = {
  assigned: { label: 'Assigned', tint: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500', stripe: 'bg-blue-500' },
  started: { label: 'Active', tint: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', stripe: 'bg-emerald-500' },
  completed: { label: 'Done', tint: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400', stripe: 'bg-slate-400' },
};

const RIG_STATUS_META = {
  compliant: { Icon: ShieldCheck, tint: 'text-emerald-600 bg-emerald-50', ring: 'ring-emerald-500' },
  expiring: { Icon: ShieldAlert, tint: 'text-amber-600 bg-amber-50', ring: 'ring-amber-500' },
  expired: { Icon: ShieldX, tint: 'text-red-600 bg-red-50', ring: 'ring-red-500' },
  unknown: { Icon: ShieldAlert, tint: 'text-slate-500 bg-slate-50', ring: 'ring-slate-300' },
};

/**
 * My Today — the field staff member's daily summary. Shows today's job
 * assignments with job name, location, rig, and shift status. Includes a
 * "View Full Schedule" button linking to the staff schedule page.
 */
export default function MyTodayTab({ staffProfile, allAssets = [] }) {
  const navigate = useNavigate();
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['my-today-rota', staffProfile?.id, today],
    queryFn: async () => {
      if (!staffProfile?.id) return [];
      const all = await base44.entities.RotaAssignment.filter({ staff_id: staffProfile.id, assigned_date: today });
      return all.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
    },
    enabled: !!staffProfile?.id,
  });

  const jobIds = [...new Set(assignments.map(a => a.job_id).filter(Boolean))];
  const { data: jobs = [] } = useQuery({
    queryKey: ['my-today-jobs', jobIds.join('|')],
    queryFn: async () => {
      if (jobIds.length === 0) return [];
      const all = await base44.entities.Job.list();
      return all.filter(j => jobIds.includes(j.id));
    },
    enabled: jobIds.length > 0,
  });

  const rigIds = [...new Set(assignments.map(a => a.rig_asset_id).filter(Boolean))];
  const rigs = allAssets.filter(a => rigIds.includes(a.id));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-50 to-emerald-100 flex items-center justify-center mx-auto mb-4 ring-4 ring-emerald-50">
          <CalendarOff className="w-10 h-10 text-emerald-300" />
        </div>
        <p className="text-slate-700 font-bold text-base">No assignments today</p>
        <p className="text-slate-400 text-sm mt-1 mb-5">Your schedule will appear here once assigned</p>
        <button
          onClick={() => navigate('/staff-schedule')}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-200 transition active:scale-95"
        >
          <CalendarDays className="w-4 h-4" /> View Full Schedule
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Date header */}
      <div className="flex items-center gap-2 text-sm">
        <CalendarDays className="w-4 h-4 text-primary" />
        <span className="font-bold text-slate-700">{format(new Date(), 'EEEE, dd MMM yyyy')}</span>
        <span className="text-slate-300">·</span>
        <span className="text-slate-400 font-medium">{assignments.length} {assignments.length === 1 ? 'job' : 'jobs'}</span>
      </div>

      {/* Assignment cards */}
      {assignments.map((a, idx) => {
        const job = jobs.find(j => j.id === a.job_id);
        const rig = rigs.find(r => r.id === a.rig_asset_id);
        const statusMeta = STATUS_META[a.status] || STATUS_META.assigned;
        const isNonJob = a.assignment_type !== 'job';
        const rigStatus = RIG_STATUS_META[rig?.compliance_status] || RIG_STATUS_META.unknown;
        const RigStatusIcon = rigStatus.Icon;

        return (
          <div key={a.id} className="relative bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            {/* Left status stripe */}
            <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${statusMeta.stripe}`} />

            {/* Status bar */}
            <div className="flex items-center justify-between pl-5 pr-4 py-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${statusMeta.dot}`} />
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${statusMeta.tint}`}>
                  {statusMeta.label}
                </span>
                {idx === 0 && a.status === 'assigned' && (
                  <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">UP NEXT</span>
                )}
              </div>
              {a.start_time && (
                <span className="text-xs text-slate-500 flex items-center gap-1 font-medium">
                  <Clock className="w-3 h-3" /> {a.start_time}{a.end_time ? ` – ${a.end_time}` : ''}
                </span>
              )}
            </div>

            {/* Job info */}
            {isNonJob ? (
              <div className="flex items-center gap-3 p-4 pl-5">
                <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center">
                  <CalendarOff className="w-5 h-5 text-slate-500" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{a.non_job_label || a.assignment_type}</p>
                  <p className="text-xs text-slate-400">Non-job day</p>
                </div>
              </div>
            ) : (
              <div className="p-4 pl-5">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#1c4a12] flex items-center justify-center flex-shrink-0 shadow-sm">
                    <MapPin className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-bold text-slate-900 leading-tight">{job?.name || 'Unknown Job'}</p>
                    {job?.location && (
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {job.location}
                      </p>
                    )}
                    {job?.site_contact_name && (
                      <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                        <User className="w-3 h-3" /> {job.site_contact_name}
                        {job.site_contact_phone && (
                          <span className="flex items-center gap-0.5 ml-1">
                            <Phone className="w-2.5 h-2.5" /> {job.site_contact_phone}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                </div>

                {/* Rig info with compliance ring */}
                {rig && (
                  <div className="mt-3 flex items-center gap-2.5 bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
                    <div className={`w-8 h-8 rounded-lg ring-2 ${rigStatus.ring} bg-white flex items-center justify-center flex-shrink-0`}>
                      <Cog className="w-4 h-4 text-slate-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-700 truncate">{rig.name}</p>
                      {rig.serial_number && (
                        <p className="text-[10px] text-slate-400 font-mono">{rig.serial_number}</p>
                      )}
                    </div>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${rigStatus.tint}`}>
                      <RigStatusIcon className="w-3 h-3" /> {(rig.compliance_status || 'unknown').toUpperCase()}
                    </span>
                  </div>
                )}

                {/* Progress notes */}
                {a.progress_notes && (
                  <div className="mt-3 bg-amber-50/60 border border-amber-100 rounded-xl px-3 py-2">
                    <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wide mb-0.5">Previous Shift Notes</p>
                    <p className="text-xs text-slate-600 italic">"{a.progress_notes}"</p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* View full schedule button */}
      <button
        onClick={() => navigate('/staff-schedule')}
        className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-gradient-to-r from-[#2E5A1A] to-[#1c4a12] text-white rounded-2xl text-sm font-bold hover:shadow-md transition active:scale-95"
      >
        <CalendarDays className="w-4 h-4" /> View Full Schedule
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}