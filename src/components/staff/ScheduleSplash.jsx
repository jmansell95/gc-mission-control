import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, MapPin, Truck, Clock, Briefcase, CheckCircle2, Sunrise, Navigation, HardHat, Loader2, X, Phone } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { formatJobType } from '@/utils/format';
import { getJobPrimaryType } from '@/utils/jobTeams';
import GeotabTimesheetSync from '@/components/staff/GeotabTimesheetSync';

const jobTypeDot = {
  groundworks: 'bg-green-500',
  cp_drilling: 'bg-amber-500',
  rotary_drilling: 'bg-blue-500',
  enabling_works: 'bg-purple-500',
  depot: 'bg-slate-400'
};
const jobTypeBadge = {
  groundworks: 'bg-green-100 text-green-700 ring-1 ring-green-200',
  cp_drilling: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200',
  rotary_drilling: 'bg-blue-100 text-blue-700 ring-1 ring-blue-200',
  enabling_works: 'bg-purple-100 text-purple-700 ring-1 ring-purple-200',
  depot: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200'
};

export default function ScheduleSplash({ assignments, jobs, vehicles, clients, teams, staff, weekStart, loading, onAcknowledge, reviewMode = false, onClose, acknowledgedAt }) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const weekStartDate = new Date(weekStart + 'T00:00:00');
  const weekEndDate = addDays(weekStartDate, 6);

  const sorted = [...assignments].sort((a, b) => new Date(a.assigned_date) - new Date(b.assigned_date));
  const byDate = {};
  sorted.forEach(a => {
    if (!byDate[a.assigned_date]) byDate[a.assigned_date] = [];
    byDate[a.assigned_date].push(a);
  });
  const dates = Object.keys(byDate).sort();
  const firstTodayAssignment = sorted.find(a => a.assigned_date === todayStr);

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 overflow-y-auto">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm relative overflow-hidden">
        <div className="relative max-w-2xl mx-auto px-4 md:px-6 py-6 md:py-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center flex-shrink-0 shadow-sm">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Your Schedule</h1>
              <p className="text-slate-500 text-ui-body mt-0.5">
                {format(weekStartDate, 'dd MMM')} – {format(weekEndDate, 'dd MMM yyyy')}
              </p>
            </div>
          </div>
          <p className="text-slate-600 text-ui-body">
            {reviewMode
              ? `Hi ${staff.name.split(' ')[0]}, here's a reminder of your assignments for this week.`
              : `Hi ${staff.name.split(' ')[0]}, please review your assignments for this week before starting.`}
          </p>
          {reviewMode && (
            <button onClick={onClose} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Schedule list */}
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-5 pb-28">
        {/* Geotab auto-detected timesheets */}
        <GeotabTimesheetSync staff={staff} jobs={jobs} date={todayStr} />

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mb-3" />
            <p className="text-sm text-slate-400">Loading your schedule…</p>
          </div>
        ) : dates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center hub-glass rounded-2xl">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
              <Calendar className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-slate-700 font-bold">No assignments this week</p>
            <p className="text-slate-400 text-sm mt-1">Check with your supervisor if you expected to be working.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {dates.map(dateStr => {
              const isToday = dateStr === todayStr;
              const isFuture = dateStr > todayStr;
              const dayAssignments = byDate[dateStr];

              return (
                <div key={dateStr} className={`rounded-2xl border overflow-hidden ${isToday ? 'border-[#2E5A1A] shadow-md shadow-[#2E5A1A]/10' : 'border-slate-200 shadow-sm'}`}>
                  {/* Day header */}
                  <div className={`flex items-center justify-between px-4 py-3 ${isToday ? 'bg-[#2E5A1A] text-white' : isFuture ? 'bg-slate-50 text-slate-700' : 'bg-slate-100 text-slate-500'}`}>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">{format(new Date(dateStr + 'T00:00:00'), 'EEEE')}</span>
                      <span className="text-xs opacity-80">{format(new Date(dateStr + 'T00:00:00'), 'dd MMM')}</span>
                    </div>
                    {isToday && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide bg-white/20 px-2.5 py-1 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> Today
                      </span>
                    )}
                  </div>

                  {/* Assignments */}
                  <div className="divide-y divide-slate-100 bg-white">
                    {dayAssignments.map(a => {
                      const job = jobs.find(j => j.id === a.job_id);
                      const vehicle = vehicles.find(v => v.id === a.vehicle_id);
                      const client = clients.find(c => c.id === job?.client_id);
                      const jobType = getJobPrimaryType(job, teams);

                      return (
                        <div key={a.id} className="px-4 py-3.5">
                          <div className="flex items-start gap-3">
                            <span className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${jobTypeDot[jobType] || 'bg-slate-400'}`} />
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-slate-900 text-sm leading-tight">{job?.name || 'Unknown job'}</p>
                              {job?.location && (
                                <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                                  <MapPin className="w-3 h-3 flex-shrink-0" />
                                  <span className="truncate">{job.location}</span>
                                </div>
                              )}
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                                {job && (
                                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${jobTypeBadge[jobType] || jobTypeBadge.depot}`}>
                                    {formatJobType(jobType)}
                                  </span>
                                )}
                                {(a.start_time || a.end_time) && (
                                  <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                                    <Clock className="w-3 h-3" /> {a.start_time || '—'}{a.end_time ? `–${a.end_time}` : ''}
                                  </span>
                                )}
                                {vehicle && (
                                  <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                                    <Truck className="w-3 h-3" /> <span className="font-mono font-semibold">{vehicle.registration_number}</span>
                                  </span>
                                )}
                                {job.site_contact_phone && (
                                  <a href={`tel:${job.site_contact_phone}`} className="inline-flex items-center gap-1 text-xs text-emerald-700 font-semibold hover:underline">
                                    <Phone className="w-3 h-3" /> {job.site_contact_name ? `${job.site_contact_name}` : 'Site Contact'}: {job.site_contact_phone}
                                  </a>
                                )}
                                {client && (
                                  <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                                    <Briefcase className="w-3 h-3" /> {client.name}
                                  </span>
                                )}
                                {a.is_overtime && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold">
                                    OT{a.rate_multiplier ? ` ${Number(a.rate_multiplier)}x` : ''}
                                  </span>
                                )}
                              </div>
                              {a.notes && (
                                <p className="text-xs text-slate-400 italic mt-1.5">{a.notes}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Reminder card */}
            <div className="rounded-2xl bg-blue-50 border border-blue-200 px-4 py-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Sunrise className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-blue-900">Daily workflow</p>
                <p className="text-xs text-blue-700 mt-1 leading-relaxed">
                  Each day: log your travel to site → complete the site briefing → add your daily tasks → submit your timesheet → log your travel from site to home.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sticky bottom button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-4 z-10">
        <div className="max-w-2xl mx-auto">
          {acknowledgedAt && (
            <p className="text-center text-xs text-slate-500 mb-2 flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Acknowledged {format(new Date(acknowledgedAt), "dd MMM yyyy 'at' HH:mm")}
            </p>
          )}
          {reviewMode ? (
            <button
              onClick={onClose}
              className="flex items-center justify-center gap-2 w-full px-5 py-4 bg-slate-800 text-white rounded-2xl hover:bg-slate-900 active:scale-[0.98] transition text-sm font-bold touch-manipulation shadow-lg"
            >
              <X className="w-5 h-5" />
              Close
            </button>
          ) : (
            <button
              onClick={onAcknowledge}
              disabled={loading}
              className="flex items-center justify-center gap-2 w-full px-5 py-4 command-gradient text-white rounded-2xl hover:opacity-90 active:scale-[0.98] transition text-sm font-bold disabled:opacity-50 touch-manipulation shadow-lg shadow-[#2E5A1A]/20"
            >
              <CheckCircle2 className="w-5 h-5" />
              I've read my schedule — ready to start
            </button>
          )}
        </div>
      </div>
    </div>
  );
}