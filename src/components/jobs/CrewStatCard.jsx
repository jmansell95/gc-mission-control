import React from 'react';
import { motion } from 'framer-motion';
import { Cog, Clock, Ruler, Route, CalendarDays, PlayCircle, CheckCircle2, HardHat, Briefcase, Users, ChevronRight } from 'lucide-react';
import { computeCrewStats, fmtHours } from '@/components/jobs/crewStats';
import AnimatedNumber from '@/components/hubs/AnimatedNumber';

const workerTypeMeta = {
  direct_employee: { label: 'Direct', icon: Users, cls: 'bg-emerald-100 text-emerald-700' },
  subcontractor: { label: 'Sub-con', icon: HardHat, cls: 'bg-orange-100 text-orange-700' },
  agency: { label: 'Agency', icon: Briefcase, cls: 'bg-blue-100 text-blue-700' },
};

const roleLabels = {
  lead_driller: 'Lead Driller', second_man: 'Second Man',
  groundworker: 'Groundworker', cp_driller: 'CP Driller', rotary_driller: 'Rotary Driller',
  enabling_crew: 'Enabling Crew', depot: 'Depot', supervisor: 'Supervisor',
};

const statusMeta = {
  assigned: { label: 'Assigned', icon: Clock, cls: 'text-slate-600 bg-slate-100' },
  started: { label: 'On Shift', icon: PlayCircle, cls: 'text-blue-700 bg-blue-100' },
  completed: { label: 'Done', icon: CheckCircle2, cls: 'text-[#2E5A1A] bg-emerald-100' },
};

// Stat-focused crew card for the redesigned Daily Schedule tab.
// Shows three stat categories at a glance: Rig+Role+Status, Days+Meterage, Travel+Hours.
// Click opens the full CrewDetailModal.
export default function CrewStatCard({ member, rotas, rigs, allStaff, primaryType, onClick }) {
  const stats = computeCrewStats(member, rotas, rigs);
  const wt = workerTypeMeta[member.worker_type] || workerTypeMeta.direct_employee;
  const WtIcon = wt.icon;
  const status = statusMeta[stats.rigRota?.status || 'assigned'] || statusMeta.assigned;
  const StatusIcon = status.icon;
  const roleLabel = roleLabels[stats.crewRole] || roleLabels[member.job_role] || 'Crew';

  return (
    <motion.button
      variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } } }}
      onClick={onClick}
      type="button"
      className="hub-glass rounded-2xl p-4 text-left w-full hover:shadow-lg active:scale-[0.98] transition group"
    >
      {/* Header — avatar, name, role, worker-type badge */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#2E5A1A]/10 to-[#8DC63F]/10 flex items-center justify-center flex-shrink-0 ring-1 ring-[#2E5A1A]/10">
          {member.avatar_url ? (
            <img src={member.avatar_url} alt={member.name} className="w-full h-full rounded-xl object-cover" />
          ) : (
            <span className="text-[#2E5A1A] font-bold text-base">{member.name.charAt(0)}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-slate-900 truncate leading-tight">{member.name}</p>
          <p className="text-xs text-slate-500 mt-0.5">{roleLabel}</p>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold inline-flex items-center gap-1 flex-shrink-0 ${wt.cls}`}>
          <WtIcon className="w-2.5 h-2.5" /> {wt.label}
        </span>
      </div>

      {/* Stat pill row 1 — Rig + Role + Status */}
      <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
        {stats.rig ? (
          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg font-semibold bg-[#2E5A1A] text-white shadow-sm">
            <Cog className="w-3 h-3" /> {stats.rig.name || 'Rig'}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg font-medium bg-slate-100 text-slate-500">
            <Cog className="w-3 h-3" /> No rig
          </span>
        )}
        {stats.crewRole && (
          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg font-medium bg-violet-50 text-violet-700">
            {stats.crewRole === 'lead_driller' ? 'Lead' : 'Second'}
          </span>
        )}
        <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg font-semibold ml-auto ${status.cls}`}>
          <StatusIcon className="w-3 h-3" /> {status.label}
        </span>
      </div>

      {/* Stat pills row 2 — Days worked + Meterage */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className="rounded-xl bg-blue-50/60 px-3 py-2 border border-blue-100/60">
          <div className="flex items-center gap-1.5 text-blue-600 mb-0.5">
            <CalendarDays className="w-3 h-3" />
            <span className="text-[10px] font-semibold uppercase tracking-wide">Days</span>
          </div>
          <p className="text-lg font-bold text-slate-900 tabular-nums leading-tight">
            <AnimatedNumber value={stats.daysWorked} />
          </p>
        </div>
        <div className="rounded-xl bg-amber-50/60 px-3 py-2 border border-amber-100/60">
          <div className="flex items-center gap-1.5 text-amber-600 mb-0.5">
            <Ruler className="w-3 h-3" />
            <span className="text-[10px] font-semibold uppercase tracking-wide">Meterage</span>
          </div>
          <p className="text-lg font-bold text-slate-900 tabular-nums leading-tight">
            <AnimatedNumber value={stats.totalMeterage} format={(v) => `${Math.round(v)}m`} />
          </p>
        </div>
      </div>

      {/* Stat pills row 3 — Travel + Hours */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-violet-50/60 px-3 py-2 border border-violet-100/60">
          <div className="flex items-center gap-1.5 text-violet-600 mb-0.5">
            <Route className="w-3 h-3" />
            <span className="text-[10px] font-semibold uppercase tracking-wide">Travel</span>
          </div>
          <p className="text-sm font-bold text-slate-900 tabular-nums leading-tight">{fmtHours(stats.travelMinutes)}</p>
        </div>
        <div className="rounded-xl bg-emerald-50/60 px-3 py-2 border border-emerald-100/60">
          <div className="flex items-center gap-1.5 text-emerald-600 mb-0.5">
            <Clock className="w-3 h-3" />
            <span className="text-[10px] font-semibold uppercase tracking-wide">Hours</span>
          </div>
          <p className="text-sm font-bold text-slate-900 tabular-nums leading-tight">{fmtHours(stats.hoursMinutes)}</p>
        </div>
      </div>

      {/* Click-to-view hint */}
      <div className="mt-3 flex items-center justify-center gap-1 text-[11px] font-semibold text-[#2E5A1A] group-hover:gap-1.5 transition-all">
        View crew details <ChevronRight className="w-3.5 h-3.5" />
      </div>
    </motion.button>
  );
}