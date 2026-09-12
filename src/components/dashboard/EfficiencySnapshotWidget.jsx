import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { TrendingUp, Users, CalendarDays, HardHat, ArrowUpRight, PoundSterling } from 'lucide-react';
import { format, startOfWeek } from 'date-fns';
import { Skeleton } from '@/components/StateViews';
import { useJobFilter } from '@/components/dashboard/JobFilterContext';

const gbp = (n) => {
  if (n == null || isNaN(n)) return '—';
  return '£' + Number(n).toLocaleString('en-GB', { maximumFractionDigits: 0 });
};

// Efficiency Snapshot — one compact card that folds the old per-crew and per-rig
// profitability widgets into a single at-a-glance read: booked revenue for active
// jobs, crew-days on the clock this week, revenue per crew-day, and the top
// earners. Replaces the need to scroll through separate financial reports.
export default function EfficiencySnapshotWidget({ onSelectJob }) {
  const { selectedJobId } = useJobFilter();
  const isAll = selectedJobId === 'all';

  const weekStartStr = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

  const { data: jobs = [], isLoading } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list() });
  const { data: thisWeekRotas = [] } = useQuery({
    queryKey: ['rotas-efficiency', weekStartStr],
    queryFn: () => base44.entities.RotaAssignment.filter({ week_start: weekStartStr }),
  });

  const scopedJobs = isAll ? jobs : jobs.filter(j => j.id === selectedJobId);
  const activeJobs = scopedJobs.filter(j => j.status === 'in_progress' || j.status === 'decommissioning');
  const scopedRotas = isAll ? thisWeekRotas : thisWeekRotas.filter(r => r.job_id === selectedJobId);

  // Booked revenue: prefer client_charge where set; for meterage jobs use meterage × rate.
  const jobRevenue = (j) => {
    if (j.revenue_method === 'meterage_rate' && j.meterage != null && j.meterage_rate) return Number(j.meterage) * Number(j.meterage_rate);
    if (j.client_charge != null) return Number(j.client_charge);
    return 0;
  };
  const totalRevenue = activeJobs.reduce((s, j) => s + jobRevenue(j), 0);
  const crewDays = scopedRotas.length;
  const revPerCrewDay = crewDays > 0 ? totalRevenue / crewDays : 0;

  const topJobs = [...activeJobs]
    .map(j => ({ job: j, rev: jobRevenue(j) }))
    .sort((a, b) => b.rev - a.rev)
    .slice(0, 3);

  const tileAnim = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } } };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center shadow-sm">
          <TrendingUp className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-800">Efficiency Snapshot</h3>
          <p className="text-[11px] text-slate-400">Revenue vs crew effort · this week</p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : (
        <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.06 } } }} className="grid grid-cols-3 gap-3">
          <motion.div variants={tileAnim} className="hub-glass rounded-xl p-3.5">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="w-7 h-7 rounded-lg stat-gradient-brand flex items-center justify-center"><PoundSterling className="w-3.5 h-3.5 text-white" /></div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Booked</span>
            </div>
            <p className="text-lg font-bold text-slate-900 tabular-nums">{gbp(totalRevenue)}</p>
            <p className="text-[10px] text-slate-400">{activeJobs.length} active {activeJobs.length === 1 ? 'job' : 'jobs'}</p>
          </motion.div>

          <motion.div variants={tileAnim} className="hub-glass rounded-xl p-3.5">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="w-7 h-7 rounded-lg stat-gradient-blue flex items-center justify-center"><CalendarDays className="w-3.5 h-3.5 text-white" /></div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Crew-Days</span>
            </div>
            <p className="text-lg font-bold text-slate-900 tabular-nums">{crewDays}</p>
            <p className="text-[10px] text-slate-400">on the clock this week</p>
          </motion.div>

          <motion.div variants={tileAnim} className="hub-glass rounded-xl p-3.5">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="w-7 h-7 rounded-lg stat-gradient-emerald flex items-center justify-center"><Users className="w-3.5 h-3.5 text-white" /></div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">£ / Day</span>
            </div>
            <p className="text-lg font-bold text-slate-900 tabular-nums">{gbp(revPerCrewDay)}</p>
            <p className="text-[10px] text-slate-400">revenue per crew-day</p>
          </motion.div>
        </motion.div>
      )}

      {/* Top earners — compact list */}
      {topJobs.length > 0 && (
        <div className="hub-glass rounded-xl divide-y divide-slate-100">
          {topJobs.map(({ job, rev }) => (
            <button key={job.id} type="button" onClick={() => onSelectJob?.(job)}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-slate-50/60 transition first:rounded-t-xl last:rounded-b-xl">
              <div className="w-7 h-7 rounded-lg bg-[#2E5A1A]/10 flex items-center justify-center flex-shrink-0">
                <HardHat className="w-3.5 h-3.5 text-[#2E5A1A]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-800 truncate">{job.name}</p>
                <p className="text-[10px] text-slate-400 truncate">{job.location || 'No location'}</p>
              </div>
              <span className="text-sm font-bold text-[#2E5A1A] tabular-nums flex-shrink-0">{gbp(rev)}</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}