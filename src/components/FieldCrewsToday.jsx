import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Users, MapPin, Truck, Clock, ClipboardCheck, ChevronRight, PlayCircle, CheckCircle2, Calendar } from 'lucide-react';
import { formatJobType } from '@/utils/format';
import { getJobPrimaryType } from '@/utils/jobTeams';
import { getCrewLabel } from '@/utils/terminology';

const jobTypeBadge = {
  groundworks: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200',
  cp_drilling: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200',
  rotary_drilling: 'bg-blue-100 text-blue-700 ring-1 ring-blue-200',
  enabling_works: 'bg-purple-100 text-purple-700 ring-1 ring-purple-200',
  depot: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
};

const jobTypeDot = {
  groundworks: 'bg-emerald-500',
  cp_drilling: 'bg-amber-500',
  rotary_drilling: 'bg-blue-500',
  enabling_works: 'bg-purple-500',
  depot: 'bg-slate-400',
};

const statusConfig = {
  assigned: { label: 'Assigned', icon: Clock, cls: 'bg-slate-100 text-slate-600' },
  started: { label: 'Started', icon: PlayCircle, cls: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Done', icon: CheckCircle2, cls: 'bg-emerald-100 text-emerald-700' },
};

export default function FieldCrewsToday({ todaysRotas: rawTodaysRotas, staff, jobs, vehicles, onSelectJob, onNavigate }) {
  // Deduplicate: one entry per staff per job
  const _seen = {};
  const todaysRotas = rawTodaysRotas.filter(r => {
    const k = `${r.staff_id}|${r.job_id}`;
    if (_seen[k]) return false;
    _seen[k] = true;
    return true;
  });
  const { data: teams = [] } = useQuery({ queryKey: ['teams'], queryFn: () => base44.entities.Team.list() });
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.35 }}
      className="hub-glass rounded-2xl overflow-hidden">
      <div className="px-5 py-4 bg-gradient-to-r from-slate-50/90 via-white to-white border-b border-slate-100/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center flex-shrink-0 shadow-md icon-tile-glow">
            <Clock className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-base font-bold text-slate-900 truncate tracking-tight">Crews On Site Today</h2>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="inline-flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full font-semibold ring-1 ring-emerald-200 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {todaysRotas.length} {todaysRotas.length === 1 ? 'Shift' : 'Shifts'}
          </span>
          <button onClick={() => onNavigate('calendar')} className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-900 font-medium px-2 py-1.5 rounded-lg hover:bg-emerald-50 transition">
            Calendar <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {todaysRotas.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2">
            <Users className="w-5 h-5 text-slate-300" />
          </div>
          <p className="text-slate-400 text-sm">No Crews On Site Today</p>
          <button onClick={() => onNavigate('rota')} className="mt-2 text-xs text-emerald-700 hover:text-emerald-900 font-medium">Build this week's rota →</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 p-4 max-h-[420px] overflow-y-auto">
          {todaysRotas.map(r => {
            const member = staff.find(s => s.id === r.staff_id);
            const job = jobs.find(j => j.id === r.job_id);
            const vehicle = vehicles.find(v => v.id === r.vehicle_id);
            const status = statusConfig[r.status || 'assigned'] || statusConfig.assigned;
            const StatusIcon = status.icon;
            const primaryType = getJobPrimaryType(job, teams);
            const typeBadge = jobTypeBadge[primaryType] || 'bg-slate-100 text-slate-600 ring-1 ring-slate-200';

            return (
              <button key={r.id} onClick={() => job && onSelectJob(job)}
                className="w-full px-4 py-3.5 rounded-xl border border-slate-100 hover:border-emerald-300 hover:bg-emerald-50/30 hover:shadow-sm transition text-left group">
                {/* Top row: avatar + name + status */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                    <span className="text-white font-bold text-sm">{member?.name?.charAt(0) || '?'}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 truncate">{member?.name || 'Unknown'}</p>
                    {primaryType && (
                      <span className={`inline-flex items-center gap-1 mt-0.5 text-[11px] font-medium px-2 py-0.5 rounded-full ${typeBadge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${jobTypeDot[primaryType]}`} />
                        {getCrewLabel(primaryType, 1)}
                      </span>
                    )}
                  </div>
                  <span className={`hidden sm:inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${status.cls} flex-shrink-0`}>
                    <StatusIcon className="w-3 h-3" /> {status.label}
                  </span>
                </div>

                {/* Details grid — always visible, wraps nicely on mobile */}
                <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs sm:text-sm">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <ClipboardCheck className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="text-slate-500 flex-shrink-0">Job</span>
                    <span className="text-slate-800 font-medium truncate">{job?.name || '—'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="text-slate-500 flex-shrink-0">Site</span>
                    <span className="text-slate-700 truncate">{job?.location || '—'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Truck className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="text-slate-500 flex-shrink-0">Vehicle</span>
                    <span className="text-slate-700 font-mono truncate">{vehicle ? vehicle.registration_number : '—'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="text-slate-500 flex-shrink-0">Shift</span>
                    <span className="text-slate-700 truncate">{r.start_time || r.end_time ? `${r.start_time || '—'} – ${r.end_time || '—'}` : '—'}</span>
                  </div>
                </div>

                {/* Mobile-only status + briefing row */}
                <div className="sm:hidden mt-2 flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${status.cls}`}>
                    <StatusIcon className="w-3 h-3" /> {status.label}
                  </span>
                  {r.briefing_signed && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                      <ClipboardCheck className="w-3 h-3" /> Briefed
                    </span>
                  )}
                  {r.meterage > 0 && (
                    <span className="text-[11px] text-amber-600 font-medium">{r.meterage}m</span>
                  )}
                </div>

                {/* Desktop-only briefing/meterage extras */}
                <div className="hidden sm:flex items-center gap-3 mt-1.5 text-[11px]">
                  {r.briefing_signed && (
                    <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                      <ClipboardCheck className="w-3 h-3" /> Briefing signed
                    </span>
                  )}
                  {r.meterage > 0 && (
                    <span className="text-amber-600 font-medium">{r.meterage}m Drilled</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}