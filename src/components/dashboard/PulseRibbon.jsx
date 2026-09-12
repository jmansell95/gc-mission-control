import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ClipboardCheck, RotateCcw, CalendarX, PauseCircle, CalendarClock,
  ArrowRight, CheckCircle2, ShieldAlert, FileClock, Truck, Wrench, AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';

const toneStyles = {
  emerald: { gradient: 'from-emerald-500 to-teal-600', soft: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200' },
  slate: { gradient: 'from-slate-400 to-slate-600', soft: 'bg-slate-50', text: 'text-slate-600', ring: 'ring-slate-200' },
  amber: { gradient: 'from-amber-500 to-orange-600', soft: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200' },
  rose: { gradient: 'from-rose-500 to-red-600', soft: 'bg-rose-50', text: 'text-rose-600', ring: 'ring-rose-200' },
  blue: { gradient: 'from-blue-500 to-indigo-600', soft: 'bg-blue-50', text: 'text-blue-700', ring: 'ring-blue-200' },
  violet: { gradient: 'from-violet-500 to-purple-600', soft: 'bg-violet-50', text: 'text-violet-700', ring: 'ring-violet-200' },
  cyan: { gradient: 'from-cyan-500 to-sky-600', soft: 'bg-cyan-50', text: 'text-cyan-700', ring: 'ring-cyan-200' },
};

/**
 * PulseRibbon — the flagship "at-a-glance" intelligence layer for the admin dashboard.
 *
 * A horizontal scrollable ribbon of polished tiles, each surfacing a critical item
 * that needs the manager's attention right now. Each tile has a gradient icon tile
 * with glow, a live pulse dot for urgent items, and a count badge.
 *
 * This replaces the old NeedsAttentionPanel with a more polished, information-dense layout.
 */
export default function PulseRibbon({ onNavigate }) {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  const weekStartStr = format(monday, 'yyyy-MM-dd');

  const refreshOpts = { staleTime: 0, refetchOnMount: true, refetchOnWindowFocus: true, refetchInterval: 60000 };
  const { data: timesheets = [] } = useQuery({ queryKey: ['timesheets', 'pulse'], queryFn: () => base44.entities.Timesheet.list('-created_date', 200), ...refreshOpts });
  const { data: absences = [] } = useQuery({ queryKey: ['absences', 'pulse'], queryFn: () => base44.entities.Absence.list('-created_date', 100), ...refreshOpts });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs', 'pulse'], queryFn: () => base44.entities.Job.list(), ...refreshOpts });
  const { data: rotaWeeks = [] } = useQuery({ queryKey: ['rota-week', 'pulse'], queryFn: () => base44.entities.RotaWeek.list(), ...refreshOpts });
  const { data: complianceItems = [] } = useQuery({ queryKey: ['compliance', 'pulse'], queryFn: () => base44.entities.ComplianceItem.list('-created_date', 200), ...refreshOpts });
  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles', 'pulse'], queryFn: () => base44.entities.Vehicle.list(), ...refreshOpts });

  const pendingTs = timesheets.filter(t => t.status === 'submitted').length;
  const withdrawnTs = timesheets.filter(t => t.status === 'deleted' && !t.withdrawal_acknowledged).length;
  const draftTs = timesheets.filter(t => {
    if (t.status !== 'draft') return false;
    const created = new Date(t.created_date);
    return (now.getTime() - created.getTime()) > 48 * 60 * 60 * 1000;
  }).length;
  const pendingAbs = absences.filter(a => a.status === 'pending').length;
  const onHoldJobs = jobs.filter(j => j.status === 'on_hold').length;
  const thisWeekRota = rotaWeeks.find(w => w.week_start === weekStartStr);
  const rotaUnpublished = !thisWeekRota || thisWeekRota.status !== 'published';

  const todayISO = format(now, 'yyyy-MM-dd');
  const expiryWarnDate = format(new Date(now.getTime() + 30 * 86400000), 'yyyy-MM-dd');
  const expiredCompliance = complianceItems.filter(c => {
    if (c.status_override === 'not_required') return false;
    if (!c.expiry_date) return false;
    return c.expiry_date < todayISO;
  }).length;
  const expiringCompliance = complianceItems.filter(c => {
    if (c.status_override === 'not_required') return false;
    if (!c.expiry_date) return false;
    return c.expiry_date >= todayISO && c.expiry_date <= expiryWarnDate;
  }).length;

  // Vehicle maintenance due
  const maintenanceDue = vehicles.filter(v => {
    if (!v.mot_expiry_date && !v.next_service_date) return false;
    const mot = v.mot_expiry_date ? v.mot_expiry_date <= expiryWarnDate : false;
    const svc = v.next_service_date ? v.next_service_date <= expiryWarnDate : false;
    return mot || svc;
  }).length;

  const items = [
    pendingTs > 0 && { key: 'ts', icon: ClipboardCheck, label: 'Timesheets to approve', value: pendingTs, tone: 'emerald', nav: 'staff', urgent: false },
    withdrawnTs > 0 && { key: 'wd', icon: RotateCcw, label: 'Withdrawn timesheets', value: withdrawnTs, tone: 'slate', nav: 'staff', urgent: false },
    draftTs > 0 && { key: 'draft', icon: FileClock, label: 'Stale draft timesheets', value: draftTs, tone: 'amber', nav: 'staff', urgent: false },
    pendingAbs > 0 && { key: 'abs', icon: CalendarX, label: 'Absence requests', value: pendingAbs, tone: 'amber', nav: 'staff', urgent: false },
    onHoldJobs > 0 && { key: 'hold', icon: PauseCircle, label: 'Jobs on hold', value: onHoldJobs, tone: 'rose', nav: 'jobs', urgent: true },
    rotaUnpublished && { key: 'rota', icon: CalendarClock, label: "This week's rota unpublished", value: null, tone: 'blue', nav: 'rota', urgent: false },
    expiredCompliance > 0 && { key: 'exp', icon: ShieldAlert, label: 'Expired compliance', value: expiredCompliance, tone: 'rose', nav: 'compliance', urgent: true },
    expiringCompliance > 0 && { key: 'soon', icon: AlertTriangle, label: 'Compliance expiring soon', value: expiringCompliance, tone: 'amber', nav: 'compliance', urgent: false },
    maintenanceDue > 0 && { key: 'maint', icon: Wrench, label: 'Vehicle maintenance due', value: maintenanceDue, tone: 'violet', nav: 'assets', urgent: false },
  ].filter(Boolean);

  const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
  const itemAnim = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } } };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="mb-6">
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
          <AlertTriangle className="w-4 h-4 text-white" />
        </div>
        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Needs Your Attention</h2>
        {items.length > 0 && (
          <span className="text-xs bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-semibold ring-1 ring-rose-200">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <motion.div variants={itemAnim} className="hub-glass rounded-2xl p-5 flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center flex-shrink-0 shadow-md icon-tile-glow">
            <CheckCircle2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">All clear — nothing pending</p>
            <p className="text-xs text-slate-400 mt-0.5">Timesheets approved, no absences awaiting, rota published, compliance current.</p>
          </div>
        </motion.div>
      ) : (
        <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 overflow-x-auto sm:overflow-visible snap-x snap-mandatory pb-2 sm:pb-0 -mx-4 px-4 sm:mx-0 sm:px-0 no-scrollbar">
          {items.map(it => {
            const Icon = it.icon;
            const t = toneStyles[it.tone];
            return (
              <motion.button key={it.key} variants={itemAnim}
                onClick={() => onNavigate(it.nav)}
                className="hub-glass rounded-2xl p-4 flex items-center gap-3.5 text-left min-w-[80%] sm:min-w-0 snap-start flex-shrink-0 sm:flex-shrink group">
                <div className={`relative w-11 h-11 rounded-xl bg-gradient-to-br ${t.gradient} flex items-center justify-center flex-shrink-0 shadow-md icon-tile-glow`}>
                  <Icon className="w-5 h-5 text-white" />
                  {it.urgent && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-rose-500 ring-2 ring-white">
                      <span className="absolute inset-0 rounded-full bg-rose-500 animate-ping opacity-75" />
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 truncate leading-tight">{it.label}</p>
                  {it.value != null ? (
                    <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
                      <span className={`font-bold ${t.text}`}>{it.value}</span> {it.value === 1 ? 'item' : 'items'}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400 mt-0.5">Action required</p>
                  )}
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition flex-shrink-0" />
              </motion.button>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}