import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Drill, TrendingUp, Ruler, Users, Loader2, Wrench, ChevronRight,
  PoundSterling, HardHat,
} from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { findRigRateCardItem } from '@/components/logistics/rigRateMatcher';

const fmtGBP = (v) => {
  if (v == null || isNaN(v)) return '£0';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(v);
};

/**
 * Rig Performance Widget — shows today's meterage and revenue per rig,
 * with the crew working on each rig. "This rig earnt £X today."
 *
 * Revenue calculation (per assignment's job):
 *  1. meterage_rate: assignment.meterage × rate (from disciplines or job.meterage_rate)
 *  2. day_rate: rate from disciplines, job.unit_price, or rig day rate from RateCardItem
 *  3. flat_fee: job.client_charge
 *  4. Fallback: rig day rate from RateCardItem (so a rig always shows its day rate
 *     even before meterage is entered at end of shift)
 */
export default function RigPerformanceWidget({ divisionId, onRigClick }) {
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

  // Resolve the day rate for a rig via the shared rig-rate matcher (same logic
  // as RigProfitabilityWidget) — the old name-contains match returned £0 for
  // most rigs because rate card descriptions don't contain the rig's name.
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

    // Primary source: rigs assigned to jobs via JobAssetAssignment (the actual
    // rig tracking). RotaAssignment.rig_asset_id is rarely populated, so relying
    // on it alone makes the widget show "no rigs" even when rigs are on site.
    jobAssetAssignments.forEach(jaa => {
      const rig = rigs.find(r => r.id === jaa.asset_id || r.id === jaa.site_asset_id);
      if (!rig) return;
      if (jaa.status === 'returned') return;
      const job = jobs.find(j => j.id === jaa.job_id);
      if (job && (job.status === 'completed' || job.status === 'cancelled')) return;
      if (!byRig[rig.id]) byRig[rig.id] = { assignments: [], job, totalMeterage: 0, totalRevenue: 0 };
    });

    // Supplementary: rota assignments that carry a rig_asset_id (merge in)
    assignments.forEach(a => {
      if (!a.rig_asset_id) return;
      const job = jobs.find(j => j.id === a.job_id);
      if (job && (job.status === 'completed' || job.status === 'cancelled')) return;
      if (!byRig[a.rig_asset_id]) byRig[a.rig_asset_id] = { assignments: [], job, totalMeterage: 0, totalRevenue: 0 };
      byRig[a.rig_asset_id].assignments.push(a);
      if (!byRig[a.rig_asset_id].job) byRig[a.rig_asset_id].job = job;
    });

    // Revenue per rig (from the job's drilling discipline / meterage)
    Object.entries(byRig).forEach(([rigId, data]) => {
      const job = data.job;
      const disciplines = Array.isArray(job?.disciplines) ? job.disciplines : [];
      const drillDisc = disciplines.find(d => d.type === 'drilling') || {};
      const rigMeterage = data.assignments.reduce((s, a) => s + (Number(a.meterage) || 0), 0);
      let rev = 0;
      if (job) {
        const meterageRate = drillDisc.meterage_rate || job.meterage_rate;
        const dayRate = drillDisc.unit_price || job.unit_price;
        const revMethod = drillDisc.revenue_method || job.revenue_method;
        if (revMethod === 'meterage_rate' && meterageRate && rigMeterage) {
          rev = rigMeterage * meterageRate;
        } else if (revMethod === 'day_rate') {
          rev = dayRate || rigDayRate[rigId] || 0;
        } else if (revMethod === 'flat_fee' && job.client_charge) {
          rev = job.client_charge;
        } else if (meterageRate && rigMeterage) {
          rev = rigMeterage * meterageRate;
        } else {
          rev = rigDayRate[rigId] || 0;
        }
      }
      data.totalRevenue = rev;
      data.totalMeterage = rigMeterage;
    });

    return Object.entries(byRig).map(([rigId, data]) => {
      const rig = rigs.find(r => r.id === rigId);
      // Today's rota for this rig — prefer assignments stamped with this rig_asset_id
      // (the Crew-Rig flow), falling back to all rota for the rig's job.
      const rigAssignments = assignments.filter(a => a.rig_asset_id === rigId);
      const jobAssignments = data.job
        ? assignments.filter(a => a.job_id === data.job.id)
        : data.assignments;
      const crewSource = rigAssignments.length > 0 ? rigAssignments : jobAssignments;
      const crew = crewSource.map(a => allStaff.find(s => s.id === a.staff_id)).filter(Boolean);
      // Resolve Lead Driller + Second Man from crew_role (Crew-Rig pairing)
      const lead = crewSource.find(a => a.crew_role === 'lead_driller');
      const second = crewSource.find(a => a.crew_role === 'second_man');
      const leadDriller = lead ? allStaff.find(s => s.id === lead.staff_id) : null;
      const secondMan = second ? allStaff.find(s => s.id === second.staff_id) : null;
      return {
        rigId,
        rig,
        crew,
        leadDriller,
        secondMan,
        job: data.job,
        meterage: data.totalMeterage,
        revenue: data.totalRevenue,
        assignmentCount: data.assignments.length,
      };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [assignments, jobAssetAssignments, jobs, rigs, allStaff, rigDayRate]);

  // Drilling crews out today — crew on drilling teams OR crew on jobs with rigs deployed
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
              <h3 className="text-sm font-bold">Rig Performance Today</h3>
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
              {drillingCrewsOut} drilling crew{drillingCrewsOut !== 1 ? 's' : ''} out — assign a rig to track earnings.
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
              <h3 className="text-sm font-bold">Rig Performance Today</h3>
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

      {/* Rig cards */}
      <div className="divide-y divide-slate-100">
        {rigStats.map((stat, i) => (
          <motion.button
            key={stat.rigId}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => onRigClick?.(stat.rigId)}
            type="button"
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition active:scale-[0.99] text-left"
          >
            {/* Rig icon */}
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2E5A1A]/10 to-[#8DC63F]/10 flex items-center justify-center flex-shrink-0">
              <Drill className="w-5 h-5 text-[#2E5A1A]" />
            </div>

            {/* Rig name + crew */}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900 truncate">{stat.rig?.name || 'Unknown Rig'}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {stat.leadDriller || stat.secondMan ? (
                  <>
                    <HardHat className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                    <span className="text-xs text-slate-600 truncate">
                      {stat.leadDriller ? <span className="font-medium text-slate-700">Lead: {stat.leadDriller.name}</span> : null}
                      {stat.secondMan ? <span className="text-slate-400"> · Second: {stat.secondMan.name}</span> : null}
                    </span>
                  </>
                ) : stat.crew.length > 0 ? (
                  <>
                    <HardHat className="w-3 h-3 text-slate-400" />
                    <span className="text-xs text-slate-500 truncate">{stat.crew.map(c => c.name).join(', ')}</span>
                  </>
                ) : (
                  <span className="text-xs text-slate-400">No crew assigned</span>
                )}
              </div>
              {stat.job && (
                <p className="text-[11px] text-slate-400 truncate mt-0.5">{stat.job.name}</p>
              )}
            </div>

            {/* Revenue + meterage */}
            <div className="text-right flex-shrink-0">
              <div className="flex items-center gap-1 justify-end">
                <PoundSterling className="w-3.5 h-3.5 text-emerald-600" />
                <p className="text-sm font-bold text-emerald-700 tabular-nums">{fmtGBP(stat.revenue)}</p>
              </div>
              {stat.meterage > 0 ? (
                <div className="flex items-center gap-1 justify-end mt-0.5">
                  <Ruler className="w-3 h-3 text-amber-500" />
                  <p className="text-xs font-semibold text-amber-600 tabular-nums">{stat.meterage.toFixed(1)}m</p>
                </div>
              ) : (
                <p className="text-[10px] text-slate-400 mt-0.5">day rate</p>
              )}
            </div>
            {onRigClick && <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />}
          </motion.button>
        ))}
      </div>
    </div>
  );
}