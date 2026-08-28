import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Drill, Ruler, Loader2, Wrench, ChevronRight,
  PoundSterling, HardHat, Briefcase, Clock,
} from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { findRigRateCardItem } from '@/components/logistics/rigRateMatcher';

const fmtGBP = (v) => {
  if (v == null || isNaN(v)) return '£0';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(v);
};

const fmtGBPm = (v) => {
  if (v == null || isNaN(v)) return '£0';
  return '£' + Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 }) + '/m';
};

/**
 * RigPerformanceWidget — today's rigs as box cards in a 2-column grid.
 * Each card shows the crew (Lead Driller + Second Man), a full earnings
 * breakdown (meterage × rate, day rate, hours), and a "Job Breakdown"
 * button that navigates to the job's financials tab.
 */
export default function RigPerformanceWidget({ divisionId, onJobBreakdown }) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['rig-perf-assignments', todayStr],
    queryFn: () => base44.entities.RotaAssignment.filter({ assigned_date: todayStr }),
  });
  const { data: rigs = [] } = useQuery({ queryKey: ['rigs-all'], queryFn: () => base44.entities.SiteAsset.filter({ is_rig: true }) });
  const { data: jobAssetAssignments = [] } = useQuery({ queryKey: ['job-asset-assignments-rig-perf'], queryFn: () => base44.entities.JobAssetAssignment.list('-created_date', 500) });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list() });
  const { data: allStaff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: teams = [] } = useQuery({ queryKey: ['teams-rig-perf'], queryFn: () => base44.entities.Team.list() });
  const { data: rateCards = [] } = useQuery({
    queryKey: ['rate-card-items-rig-perf'],
    queryFn: () => base44.entities.RateCardItem.list(),
    staleTime: 60000,
  });

  const drillingTeamIds = useMemo(() => {
    const ids = new Set();
    teams.forEach(t => {
      if (t.job_type === 'cp_drilling' || t.job_type === 'rotary_drilling') ids.add(t.id);
    });
    return ids;
  }, [teams]);

  const rigDayRate = useMemo(() => {
    const map = {};
    rigs.forEach(rig => {
      const match = findRigRateCardItem(rig, rateCards);
      if (match) map[rig.id] = Number(match.price || match.unit_price || match.rate || 0) || 0;
    });
    return map;
  }, [rigs, rateCards]);

  const rigStats = useMemo(() => {
    const byRig = {};

    jobAssetAssignments.forEach(jaa => {
      const rig = rigs.find(r => r.id === jaa.asset_id || r.id === jaa.site_asset_id);
      if (!rig) return;
      if (jaa.status === 'returned') return;
      const job = jobs.find(j => j.id === jaa.job_id);
      if (job && (job.status === 'completed' || job.status === 'cancelled')) return;
      if (!byRig[rig.id]) byRig[rig.id] = { assignments: [], job, totalMeterage: 0, totalRevenue: 0 };
    });

    assignments.forEach(a => {
      if (!a.rig_asset_id) return;
      const job = jobs.find(j => j.id === a.job_id);
      if (job && (job.status === 'completed' || job.status === 'cancelled')) return;
      if (!byRig[a.rig_asset_id]) byRig[a.rig_asset_id] = { assignments: [], job, totalMeterage: 0, totalRevenue: 0 };
      byRig[a.rig_asset_id].assignments.push(a);
      if (!byRig[a.rig_asset_id].job) byRig[a.rig_asset_id].job = job;
    });

    Object.entries(byRig).forEach(([rigId, data]) => {
      const job = data.job;
      const disciplines = Array.isArray(job?.disciplines) ? job.disciplines : [];
      const drillDisc = disciplines.find(d => d.type === 'drilling') || {};
      const rigMeterage = data.assignments.reduce((s, a) => s + (Number(a.meterage) || 0), 0);
      let rev = 0;
      let revMethod = 'day_rate';
      let meterageRate = 0;
      let dayRate = 0;
      if (job) {
        meterageRate = drillDisc.meterage_rate || job.meterage_rate || 0;
        dayRate = drillDisc.unit_price || job.unit_price || rigDayRate[rigId] || 0;
        revMethod = drillDisc.revenue_method || job.revenue_method || 'day_rate';
        if (revMethod === 'meterage_rate' && meterageRate && rigMeterage) {
          rev = rigMeterage * meterageRate;
        } else if (revMethod === 'day_rate') {
          rev = dayRate || rigDayRate[rigId] || 0;
        } else if (revMethod === 'flat_fee' && job.client_charge) {
          rev = job.client_charge;
        } else if (meterageRate && rigMeterage) {
          rev = rigMeterage * meterageRate;
          revMethod = 'meterage_rate';
        } else {
          rev = rigDayRate[rigId] || 0;
          revMethod = 'day_rate';
        }
      }
      data.totalRevenue = rev;
      data.totalMeterage = rigMeterage;
      data.revMethod = revMethod;
      data.meterageRate = meterageRate;
      data.dayRate = dayRate;
    });

    return Object.entries(byRig).map(([rigId, data]) => {
      const rig = rigs.find(r => r.id === rigId);
      const rigAssignments = assignments.filter(a => a.rig_asset_id === rigId);
      const jobAssignments = data.job
        ? assignments.filter(a => a.job_id === data.job.id)
        : data.assignments;
      const crewSource = rigAssignments.length > 0 ? rigAssignments : jobAssignments;
      const crew = crewSource.map(a => allStaff.find(s => s.id === a.staff_id)).filter(Boolean);
      const lead = crewSource.find(a => a.crew_role === 'lead_driller');
      const second = crewSource.find(a => a.crew_role === 'second_man');
      const leadDriller = lead ? allStaff.find(s => s.id === lead.staff_id) : null;
      const secondMan = second ? allStaff.find(s => s.id === second.staff_id) : null;

      // Hours worked from the first assignment's start/end time
      let hoursWorked = 0;
      const firstA = crewSource[0];
      if (firstA?.start_time && firstA?.end_time) {
        const [sh, sm] = firstA.start_time.split(':').map(Number);
        const [eh, em] = firstA.end_time.split(':').map(Number);
        hoursWorked = (eh + em / 60) - (sh + sm / 60);
        if (hoursWorked < 0) hoursWorked += 24;
      }

      return {
        rigId,
        rig,
        crew,
        leadDriller,
        secondMan,
        job: data.job,
        meterage: data.totalMeterage,
        revenue: data.totalRevenue,
        revMethod: data.revMethod,
        meterageRate: data.meterageRate,
        dayRate: data.dayRate,
        hoursWorked,
        assignmentCount: data.assignments.length,
      };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [assignments, jobAssetAssignments, jobs, rigs, allStaff, rigDayRate]);

  const drillingCrewsOut = useMemo(() => {
    const jobsWithRigs = new Set(
      jobAssetAssignments.filter(jaa => jaa.status !== 'returned').map(jaa => jaa.job_id)
    );
    const crewOut = new Set();
    assignments.forEach(a => {
      const staffMember = allStaff.find(s => s.id === a.staff_id);
      if (!staffMember) return;
      if (drillingTeamIds.has(staffMember.team_id) || jobsWithRigs.has(a.job_id)) {
        crewOut.add(a.staff_id);
      }
    });
    return crewOut.size;
  }, [assignments, allStaff, drillingTeamIds, jobAssetAssignments]);

  const totalRevenue = rigStats.reduce((sum, r) => sum + r.revenue, 0);
  const totalMeterage = rigStats.reduce((sum, r) => sum + r.meterage, 0);
  const activeRigCount = rigStats.length;

  if (isLoading) {
    return (
      <div className="insight-card rounded-2xl p-5 flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
      </div>
    );
  }

  if (activeRigCount === 0) {
    return (
      <div className="insight-card rounded-2xl overflow-hidden">
        <div className="bg-gradient-to-br from-[#2E5A1A] to-[#1c4a12] px-4 py-3 text-white">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center">
              <Drill className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Rigs on Site Today</h3>
              <p className="text-[11px] text-white/70">{format(new Date(), 'EEE dd MMM')}</p>
            </div>
          </div>
        </div>
        <div className="p-5 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-2">
            <Wrench className="w-6 h-6 text-slate-300" />
          </div>
          <p className="text-sm font-semibold text-slate-700">No rigs deployed today</p>
          {drillingCrewsOut > 0 ? (
            <p className="text-xs text-slate-500 mt-1">
              {drillingCrewsOut} drilling crew{drillingCrewsOut !== 1 ? 's' : ''} out — assign a rig via the Rota Builder to track earnings.
            </p>
          ) : (
            <p className="text-xs text-slate-400 mt-1">No drilling crews are out today.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="insight-card rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#2E5A1A] to-[#1c4a12] px-4 py-3 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center">
              <Drill className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Rigs on Site Today</h3>
              <p className="text-[11px] text-white/70">{format(new Date(), 'EEE dd MMM')} · {activeRigCount} rig{activeRigCount !== 1 ? 's' : ''} deployed</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-white/60 uppercase font-semibold tracking-wide">Earned today</p>
            <p className="text-lg font-bold tabular-nums leading-none">{fmtGBP(totalRevenue)}</p>
            {totalMeterage > 0 && <p className="text-[10px] text-white/70 mt-0.5">{totalMeterage.toFixed(1)}m drilled</p>}
          </div>
        </div>
      </div>

      {/* Rig cards — 2-column grid */}
      <div className="p-2.5 grid grid-cols-2 gap-2.5">
        {rigStats.map((stat, i) => (
          <motion.div
            key={stat.rigId}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="rounded-xl border border-slate-200/80 bg-white overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-shadow"
          >
            {/* Card header — rig name */}
            <div className="px-3 py-2 bg-gradient-to-br from-[#2E5A1A]/5 to-[#8DC63F]/5 border-b border-slate-100">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-lg bg-[#2E5A1A]/10 flex items-center justify-center flex-shrink-0">
                  <Drill className="w-3.5 h-3.5 text-[#2E5A1A]" />
                </div>
                <p className="text-xs font-bold text-slate-900 truncate flex-1">{stat.rig?.name || 'Unknown Rig'}</p>
                {stat.rig?.rig_type && stat.rig.rig_type !== 'n/a' && (
                  <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-slate-200 text-slate-600 uppercase flex-shrink-0">{stat.rig.rig_type}</span>
                )}
              </div>
            </div>

            {/* Crew */}
            <div className="px-3 py-2 space-y-1 border-b border-slate-50">
              <div className="flex items-center gap-1.5">
                <HardHat className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                <p className="text-[10px] text-slate-500 truncate">
                  <span className="font-bold text-slate-700">Lead:</span> {stat.leadDriller?.name || <span className="text-slate-400">—</span>}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <HardHat className="w-3 h-3 text-slate-400 flex-shrink-0" />
                <p className="text-[10px] text-slate-500 truncate">
                  <span className="font-bold text-slate-700">Second:</span> {stat.secondMan?.name || (stat.crew.length > 0 ? <span className="text-slate-400">—</span> : <span className="text-slate-400">—</span>)}
                </p>
              </div>
              {!stat.leadDriller && !stat.secondMan && stat.crew.length === 0 && (
                <p className="text-[9px] text-amber-600 font-medium pl-4">No crew assigned</p>
              )}
            </div>

            {/* Earnings breakdown */}
            <div className="px-3 py-2 bg-slate-50/40 flex-1">
              <p className="text-[8px] text-slate-400 uppercase font-bold tracking-wide mb-0.5">Earned today</p>
              <div className="flex items-center gap-1">
                <PoundSterling className="w-3.5 h-3.5 text-emerald-600" />
                <p className="text-base font-bold text-emerald-700 tabular-nums leading-tight">{fmtGBP(stat.revenue)}</p>
              </div>
              {/* Breakdown details */}
              <div className="mt-1.5 space-y-0.5">
                {stat.revMethod === 'meterage_rate' && stat.meterage > 0 && (
                  <div className="flex items-center gap-1 text-[9px] text-slate-500">
                    <Ruler className="w-2.5 h-2.5 text-amber-500" />
                    <span className="tabular-nums">{stat.meterage.toFixed(1)}m × {fmtGBPm(stat.meterageRate)}</span>
                  </div>
                )}
                {stat.revMethod === 'day_rate' && (
                  <div className="flex items-center gap-1 text-[9px] text-slate-500">
                    <PoundSterling className="w-2.5 h-2.5 text-slate-400" />
                    <span>Day rate: {fmtGBP(stat.dayRate)}</span>
                  </div>
                )}
                {stat.revMethod === 'flat_fee' && (
                  <div className="flex items-center gap-1 text-[9px] text-slate-500">
                    <PoundSterling className="w-2.5 h-2.5 text-slate-400" />
                    <span>Flat fee</span>
                  </div>
                )}
                {stat.meterage > 0 && stat.revMethod !== 'meterage_rate' && (
                  <div className="flex items-center gap-1 text-[9px] text-slate-500">
                    <Ruler className="w-2.5 h-2.5 text-amber-500" />
                    <span className="tabular-nums">{stat.meterage.toFixed(1)}m drilled</span>
                  </div>
                )}
                {stat.hoursWorked > 0 && (
                  <div className="flex items-center gap-1 text-[9px] text-slate-500">
                    <Clock className="w-2.5 h-2.5 text-blue-500" />
                    <span className="tabular-nums">{stat.hoursWorked.toFixed(1)}h shift</span>
                  </div>
                )}
              </div>
            </div>

            {/* Job Breakdown button */}
            <div className="p-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => onJobBreakdown?.(stat.job)}
                disabled={!stat.job}
                className="w-full flex items-center justify-center gap-1 px-2 py-1.5 bg-[#2E5A1A] text-white rounded-lg text-[10px] font-bold hover:bg-[#1c4a12] transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Briefcase className="w-3 h-3" />
                Job Breakdown
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}