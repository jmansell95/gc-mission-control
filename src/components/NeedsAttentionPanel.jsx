import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ClipboardCheck, RotateCcw, CalendarX, PauseCircle, CalendarClock, ArrowRight, CheckCircle2, Sparkles, ShieldAlert, FileClock } from 'lucide-react';
import { format } from 'date-fns';

const toneStyles = {
  emerald: { iconBg: 'bg-emerald-100', iconText: 'text-emerald-700', ring: 'ring-emerald-200', chip: 'bg-emerald-50 text-emerald-700' },
  slate: { iconBg: 'bg-slate-100', iconText: 'text-slate-600', ring: 'ring-slate-200', chip: 'bg-slate-100 text-slate-600' },
  amber: { iconBg: 'bg-amber-100', iconText: 'text-amber-700', ring: 'ring-amber-200', chip: 'bg-amber-50 text-amber-700' },
  rose: { iconBg: 'bg-rose-100', iconText: 'text-rose-600', ring: 'ring-rose-200', chip: 'bg-rose-50 text-rose-600' },
  blue: { iconBg: 'bg-blue-100', iconText: 'text-blue-700', ring: 'ring-blue-200', chip: 'bg-blue-50 text-blue-700' },
};

export default function NeedsAttentionPanel({ onNavigate }) {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  const weekStartStr = format(monday, 'yyyy-MM-dd');

  const refreshOpts = { staleTime: 0, refetchOnMount: true, refetchOnWindowFocus: true, refetchInterval: 60000 };
  const { data: timesheets = [] } = useQuery({ queryKey: ['timesheets', 'attention'], queryFn: () => base44.entities.Timesheet.list('-created_date', 200), ...refreshOpts });
  const { data: absences = [] } = useQuery({ queryKey: ['absences', 'attention'], queryFn: () => base44.entities.Absence.list('-created_date', 100), ...refreshOpts });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs', 'attention'], queryFn: () => base44.entities.Job.list(), ...refreshOpts });
  const { data: rotaWeeks = [] } = useQuery({ queryKey: ['rota-week', 'attention'], queryFn: () => base44.entities.RotaWeek.list(), ...refreshOpts });
  const { data: complianceItems = [] } = useQuery({ queryKey: ['compliance', 'attention'], queryFn: () => base44.entities.ComplianceItem.list('-created_date', 200), ...refreshOpts });

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

  // Expired or expiring-soon compliance items (staff category only, auto status, not exempt)
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

  const items = [
    pendingTs > 0 && { key: 'ts', icon: ClipboardCheck, label: 'Timesheets to approve', value: pendingTs, tone: 'emerald', nav: 'staff' },
    withdrawnTs > 0 && { key: 'wd', icon: RotateCcw, label: 'Withdrawn timesheets to review', value: withdrawnTs, tone: 'slate', nav: 'staff' },
    draftTs > 0 && { key: 'draft', icon: FileClock, label: 'Draft timesheets unresolved', value: draftTs, tone: 'amber', nav: 'staff' },
    pendingAbs > 0 && { key: 'abs', icon: CalendarX, label: 'Absence requests pending', value: pendingAbs, tone: 'amber', nav: 'staff' },
    onHoldJobs > 0 && { key: 'hold', icon: PauseCircle, label: 'Jobs on hold', value: onHoldJobs, tone: 'rose', nav: 'jobs' },
    rotaUnpublished && { key: 'rota', icon: CalendarClock, label: "This week's rota not published", value: null, tone: 'blue', nav: 'rota' },
    expiredCompliance > 0 && { key: 'exp', icon: ShieldAlert, label: 'Expired compliance items', value: expiredCompliance, tone: 'rose', nav: 'compliance' },
    expiringCompliance > 0 && { key: 'soon', icon: ShieldAlert, label: 'Compliance expiring soon', value: expiringCompliance, tone: 'amber', nav: 'compliance' },
  ].filter(Boolean);

  const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
  const itemAnim = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } } };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-emerald-700" />
        <h2 className="text-sm font-semibold text-slate-700">Needs your attention</h2>
      </div>

      {items.length === 0 ? (
        <motion.div variants={itemAnim}
          className="hub-glass rounded-2xl p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">All clear — nothing pending</p>
            <p className="text-xs text-slate-400">Timesheets approved, no absences awaiting, rota published.</p>
          </div>
        </motion.div>
      ) : (
        <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-3 overflow-x-auto sm:overflow-visible snap-x snap-mandatory pb-2 sm:pb-0">
          {items.map(it => {
            const Icon = it.icon;
            const t = toneStyles[it.tone];
            return (
              <motion.button key={it.key} variants={itemAnim}
                onClick={() => onNavigate(it.nav)}
                className={`hub-glass rounded-2xl p-4 flex items-start gap-3 text-left hover:shadow-lg transition group min-w-[85%] sm:min-w-0 snap-start flex-shrink-0 sm:flex-shrink`}>
                <div className={`w-10 h-10 rounded-xl ${t.iconBg} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-5 h-5 ${t.iconText}`} />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-sm font-semibold text-slate-900 leading-snug">{it.label}</p>
                  {it.value != null && <p className="text-xs text-slate-400 mt-0.5">{it.value} {it.value === 1 ? 'item' : 'items'}</p>}
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition flex-shrink-0 mt-1" />
              </motion.button>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}