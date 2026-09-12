import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import {
  Drill, MapPinOff, ChevronRight, Cog, Wrench,
  Truck, HardHat, Ruler, Clock, TrendingUp, Activity,
} from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import WidgetLoadingState from '@/components/dashboard/WidgetLoadingState';
import WidgetEmptyState from '@/components/dashboard/WidgetEmptyState';
import AllRigsModal from '@/components/dashboard/AllRigsModal';
import AnimatedNumber from '@/components/hubs/AnimatedNumber';
import WidgetActionFooter from '@/components/dashboard/WidgetActionFooter';
import { computeRigEarnings } from '@/utils/rigEarnings';

const fmtGBP = (v) => {
  if (v == null || isNaN(v)) return '£0';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(v);
};

const shiftDuration = (start) => {
  const ms = Date.now() - new Date(start).getTime();
  if (ms < 0) return '0m';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const METHOD_LABEL = { cp: 'CP', rotary: 'Rotary', window_sampling: 'Window', mixed: 'Mixed' };

/**
 * RigsOnSiteBentoWidget — the "Rigs on Site Today" hero tile.
 *
 * Now pulls LIVE drilling logs + earnings from InvestigationLog records via
 * the shared computeRigEarnings engine, so each rig row shows real revenue,
 * meterage, lead driller, shift duration and drilling method at a glance.
 *
 * On-site detection (per PRD):
 *  - 'on_site'    = rota today AND delivery sign-off (JAA status='on_site' OR rota arrived_on_site_at/started_at)
 *  - 'deployed'   = rota today AND active JAA but no sign-off yet
 *  - 'scheduled'  = rota today, no JAA, no sign-off
 *  - 'completed'  = rota completed
 */
export default function RigsOnSiteBentoWidget({ onJobBreakdown }) {
  const navigate = useNavigate();
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [showAllRigs, setShowAllRigs] = useState(false);

  // Auto-refresh
  const queryClient = useQueryClient();
  useEffect(() => {
    const id = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['rig-bento-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['rig-bento-today-logs'] });
    }, 4 * 60 * 1000);
    return () => clearInterval(id);
  }, [queryClient]);

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['rig-bento-assignments', todayStr],
    queryFn: () => base44.entities.RotaAssignment.filter({ assigned_date: todayStr }),
  });
  const { data: rigs = [], isLoading: rigsLoading } = useQuery({
    queryKey: ['rig-bento-rigs'],
    queryFn: () => base44.entities.SiteAsset.filter({ is_rig: true }),
  });
  const { data: jobAssetAssignments = [] } = useQuery({
    queryKey: ['rig-bento-jaa'],
    queryFn: () => base44.entities.JobAssetAssignment.list('-created_date', 500),
  });
  const { data: jobs = [] } = useQuery({ queryKey: ['rig-bento-jobs'], queryFn: () => base44.entities.Job.list() });
  const { data: allStaff = [] } = useQuery({ queryKey: ['rig-bento-staff'], queryFn: () => base44.entities.Staff.list() });

  // LIVE today's drilling logs — server-side date filter so we always get today's records
  const { data: todayLogs = [] } = useQuery({
    queryKey: ['rig-bento-today-logs', todayStr],
    queryFn: () => base44.entities.InvestigationLog.filter({
      date: todayStr,
      source: { $in: ['ags_import', 'keylogbook_remarks'] },
    }, '-created_date', 500),
    staleTime: 60000,
  });
  const { data: sorItems = [] } = useQuery({
    queryKey: ['rig-bento-sor'],
    queryFn: () => base44.entities.InvestigationSOR.list('-created_date', 500),
    staleTime: 120000,
  });

  // Live Geotab vehicle positions
  const { data: liveData, isLoading: gpsLoading } = useQuery({
    queryKey: ['geotab-live-locations-bento'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getVehicleLocationHistory', { mode: 'live_fast', limit: 500 });
      return res?.data ?? res;
    },
    refetchInterval: 30000,
    staleTime: 15000,
  });
  const liveVehicles = liveData?.vehicles || [];
  const gpsSettled = !gpsLoading;

  const rigStats = useMemo(() => {
    const byRig = {};

    // Source 1: JobAssetAssignments — rigs assigned to active jobs
    jobAssetAssignments.forEach(jaa => {
      const rig = rigs.find(r => r.id === jaa.asset_id || r.id === jaa.site_asset_id);
      if (!rig) return;
      if (jaa.status === 'returned') return;
      const job = jobs.find(j => j.id === jaa.job_id);
      if (job && (job.status === 'completed' || job.status === 'cancelled')) return;
      if (!byRig[rig.id]) byRig[rig.id] = { rotaAssignments: [], job, hasJAA: true };
      byRig[rig.id].hasJAA = true;
      if (!byRig[rig.id].job) byRig[rig.id].job = job;
    });

    // Source 2: today's RotaAssignments — rigs scheduled today
    assignments.forEach(a => {
      if (!a.rig_asset_id) return;
      const job = jobs.find(j => j.id === a.job_id);
      if (job && (job.status === 'completed' || job.status === 'cancelled')) return;
      if (!byRig[a.rig_asset_id]) byRig[a.rig_asset_id] = { rotaAssignments: [], job, hasJAA: false };
      byRig[a.rig_asset_id].rotaAssignments.push(a);
      if (!byRig[a.rig_asset_id].job) byRig[a.rig_asset_id].job = job;
    });

    // Group today's logs by device_name (rig name) for per-rig earnings
    const logsByDevice = {};
    todayLogs.forEach(l => {
      const dev = (l.device_name || '').trim();
      if (!dev) return;
      if (!logsByDevice[dev]) logsByDevice[dev] = [];
      logsByDevice[dev].push(l);
    });

    // Calculate per-rig state
    Object.entries(byRig).forEach(([rigId, data]) => {
      const job = data.job;
      const hasArrived = data.rotaAssignments.some(a => a.arrived_on_site_at || a.started_at);
      const isCompleted = data.rotaAssignments.some(a => a.status === 'completed' || a.completed_at);
      const hasRotaToday = data.rotaAssignments.length > 0;
      const hasOnSiteJAA = jobAssetAssignments.some(jaa =>
        (jaa.asset_id === rigId || jaa.site_asset_id === rigId) &&
        jaa.job_id === job?.id && jaa.status === 'on_site'
      );

      let state = 'assigned';
      if (hasRotaToday) {
        if (isCompleted) state = 'completed';
        else if (hasOnSiteJAA || hasArrived) state = 'on_site';
        else if (data.hasJAA) state = 'deployed';
        else state = 'scheduled';
      } else if (hasOnSiteJAA) {
        state = 'deployed';
      }

      data.state = state;
      data.hasRotaToday = hasRotaToday;
    });

    return Object.entries(byRig).map(([rigId, data]) => {
      const rig = rigs.find(r => r.id === rigId);
      const lead = data.rotaAssignments.find(a => a.crew_role === 'lead_driller');
      const leadDriller = lead ? allStaff.find(s => s.id === lead.staff_id) : null;

      // Per-rig earnings from today's live logs
      const rigName = (rig?.name || '').trim();
      const rigLogs = logsByDevice[rigName] || [];
      let revenue = 0, meterage = 0, boreholeCount = 0;
      if (rigLogs.length) {
        const { perRig } = computeRigEarnings({ logs: rigLogs, sorItems, job: data.job });
        const r = perRig[0];
        revenue = r?.earnings || 0;
        meterage = r?.totalMetres || 0;
        boreholeCount = r?.boreholeCount || 0;
      }

      // Shift start for on-site duration
      const onSiteAssignment = data.rotaAssignments.find(a => a.arrived_on_site_at) ||
                               data.rotaAssignments.find(a => a.started_at);
      const shiftStart = onSiteAssignment?.arrived_on_site_at || onSiteAssignment?.started_at;

      return {
        rigId,
        rig,
        job: data.job,
        state: data.state,
        hasRotaToday: data.hasRotaToday,
        leadDriller,
        firstAssignment: data.rotaAssignments[0],
        revenue,
        meterage,
        boreholeCount,
        shiftStart,
        drillingMethod: data.job?.drilling_method,
      };
    }).sort((a, b) => {
      const order = { on_site: 0, completed: 1, deployed: 2, scheduled: 3, assigned: 4 };
      return (order[a.state] - order[b.state]) || (b.revenue - a.revenue);
    });
  }, [assignments, jobAssetAssignments, jobs, rigs, allStaff, todayLogs, sorItems]);

  const onSiteCount = rigStats.filter(r => r.state === 'on_site').length;
  const deployedCount = rigStats.filter(r => r.state === 'deployed').length;
  const scheduledCount = rigStats.filter(r => r.state === 'scheduled').length;
  const completedCount = rigStats.filter(r => r.state === 'completed').length;
  const activeRigCount = rigStats.length;
  const totalRevenue = rigStats.reduce((s, r) => s + (r.revenue || 0), 0);
  const totalMeterage = rigStats.reduce((s, r) => s + (r.meterage || 0), 0);
  const avgRevenuePerRig = activeRigCount > 0 ? totalRevenue / activeRigCount : 0;
  const utilisationPct = activeRigCount > 0 ? Math.round(((onSiteCount + deployedCount) / activeRigCount) * 100) : 0;

  const handleClick = () => navigate('/fleet?filter=today');

  if (isLoading || rigsLoading) {
    return (
      <div className="hub-glass rounded-2xl p-5 min-h-[280px] flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center shadow-md">
            <Drill className="w-5 h-5 text-white" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Rigs on Site Today</h3>
        </div>
        <WidgetLoadingState rows={4} />
      </div>
    );
  }

  const top6 = rigStats.slice(0, 6);

  return (
    <>
    <div
      className="hub-glass rounded-2xl overflow-hidden h-full flex flex-col cursor-pointer hover:shadow-lg transition group"
      onClick={handleClick}
    >
      {/* Header */}
      <div className="bg-gradient-to-br from-[#2E5A1A] to-[#1c4a12] px-4 py-3.5 text-white flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center ring-1 ring-white/20">
              <Drill className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Rigs on Site Today</h3>
              <p className="text-[11px] text-white/70">{format(new Date(), 'EEE dd MMM')}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[9px] text-white/60 uppercase font-semibold tracking-wide">Earned Today</p>
            <p className="text-sm font-bold tabular-nums leading-none">{fmtGBP(totalRevenue)}</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 flex-1 flex flex-col">
        {activeRigCount === 0 ? (
          <WidgetEmptyState icon={Wrench} title="No rigs deployed" message="No rigs assigned to active jobs today." />
        ) : (
          <>
            {/* Big numbers row */}
            <div className="flex items-end gap-4 mb-3">
              <div>
                <p className="text-4xl font-bold text-emerald-600 tabular-nums leading-none"><AnimatedNumber value={onSiteCount} /></p>
                <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide mt-1">On Site</p>
              </div>
              <div className="border-l border-slate-200 pl-4">
                <p className="text-2xl font-bold text-amber-600 tabular-nums leading-none">{deployedCount}</p>
                <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide mt-1">Deployed</p>
              </div>
              {scheduledCount > 0 && (
                <div className="border-l border-slate-200 pl-4">
                  <p className="text-2xl font-bold text-slate-400 tabular-nums leading-none">{scheduledCount}</p>
                  <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide mt-1">Scheduled</p>
                </div>
              )}
              {completedCount > 0 && (
                <div className="border-l border-slate-200 pl-4">
                  <p className="text-2xl font-bold text-emerald-500 tabular-nums leading-none">{completedCount}</p>
                  <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide mt-1">Done</p>
                </div>
              )}
              {totalMeterage > 0 && (
                <div className="border-l border-slate-200 pl-4 ml-auto">
                  <p className="text-2xl font-bold text-slate-600 tabular-nums leading-none">{totalMeterage.toFixed(0)}m</p>
                  <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide mt-1">Drilled</p>
                </div>
              )}
            </div>

            {/* New stats: avg revenue per rig + utilisation */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2">
                <div className="flex items-center gap-1 mb-0.5">
                  <TrendingUp className="w-3 h-3 text-emerald-600" />
                  <span className="text-base font-bold tabular-nums text-emerald-700 leading-none">
                    <AnimatedNumber value={avgRevenuePerRig} format={(v) => fmtGBP(v)} />
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 font-medium">avg revenue / rig</p>
              </div>
              <div className="rounded-xl bg-blue-50 border border-blue-100 px-3 py-2">
                <div className="flex items-center gap-1 mb-0.5">
                  <Activity className="w-3 h-3 text-blue-600" />
                  <span className="text-base font-bold tabular-nums text-blue-700 leading-none">
                    <AnimatedNumber value={utilisationPct} format={(v) => `${Math.round(v)}%`} />
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 font-medium">utilisation</p>
              </div>
            </div>

            {/* Rig leaderboard */}
            <div className="space-y-0.5 flex-1">
              {top6.map((stat, i) => {
                const isOnSite = stat.state === 'on_site';
                const isDeployed = stat.state === 'deployed';
                const isCompleted = stat.state === 'completed';
                const isScheduled = stat.state === 'scheduled';

                const dotColor = isOnSite ? 'bg-emerald-500' : isCompleted ? 'bg-emerald-600' : isDeployed ? 'bg-amber-500' : isScheduled ? 'bg-slate-300' : 'bg-slate-200';
                const stateLabel = isOnSite ? 'On site' : isCompleted ? 'Done' : isDeployed ? 'Deployed' : isScheduled ? 'Scheduled' : 'Assigned';
                const stateColor = isOnSite ? 'text-emerald-700 bg-emerald-50' : isCompleted ? 'text-emerald-700 bg-emerald-50' : isDeployed ? 'text-amber-700 bg-amber-50' : isScheduled ? 'text-slate-500 bg-slate-100' : 'text-slate-400 bg-slate-50';
                const methodLabel = stat.drillingMethod && METHOD_LABEL[stat.drillingMethod];

                return (
                  <motion.div
                    key={stat.rigId}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-slate-50 transition"
                    onClick={(e) => { if (stat.job) { e.stopPropagation(); onJobBreakdown?.(stat.job); } }}
                  >
                    <div className="relative flex-shrink-0">
                      <span className={`block w-2.5 h-2.5 rounded-full ${dotColor}`} />
                      {isOnSite && <span className={`absolute inset-0 rounded-full ${dotColor} animate-ping opacity-60`} />}
                    </div>
                    <Cog className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-slate-900 truncate">{stat.rig?.name || 'Unknown Rig'}</p>
                        {methodLabel && (
                          <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-slate-200 text-slate-600 uppercase flex-shrink-0">{methodLabel}</span>
                        )}
                        {gpsSettled && !stat.rig?.geotab_device_id && (
                          <span title="No GPS tracker fitted on this rig" className="flex-shrink-0">
                            <MapPinOff className="w-3 h-3 text-slate-300" />
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 truncate">{stat.job?.name || 'No job'}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px]">
                        {stat.leadDriller && (
                          <span className="flex items-center gap-0.5 text-slate-500 truncate min-w-0">
                            <HardHat className="w-2.5 h-2.5 text-emerald-600 flex-shrink-0" />
                            <span className="truncate">{stat.leadDriller.name}</span>
                          </span>
                        )}
                        {stat.meterage > 0 && (
                          <span className="flex items-center gap-0.5 text-amber-600 flex-shrink-0">
                            <Ruler className="w-2.5 h-2.5" />
                            <span className="tabular-nums">{stat.meterage.toFixed(1)}m</span>
                          </span>
                        )}
                        {stat.revenue > 0 && (
                          <span className="text-emerald-600 font-bold flex-shrink-0 tabular-nums">{fmtGBP(stat.revenue)}</span>
                        )}
                        {isOnSite && stat.shiftStart && (
                          <span className="flex items-center gap-0.5 text-slate-400 flex-shrink-0">
                            <Clock className="w-2.5 h-2.5" />
                            <span className="tabular-nums">{shiftDuration(stat.shiftStart)}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${stateColor} flex-shrink-0`}>
                      {stateLabel}
                    </span>
                  </motion.div>
                );
              })}
            </div>

            {/* Footer — deep-link + quick-action */}
            <WidgetActionFooter
              deepLinkLabel="Fleet Hub"
              onDeepLink={() => navigate('/fleet?filter=today')}
            />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowAllRigs(true); }}
              className="w-full mt-1.5 flex items-center justify-center gap-1 px-2 py-1.5 text-slate-400 rounded-lg text-[11px] font-semibold hover:bg-slate-50 hover:text-slate-600 transition"
            >
              <Truck className="w-3 h-3" />
              View All Rigs ({activeRigCount})
              <ChevronRight className="w-3 h-3" />
            </button>
          </>
        )}
      </div>
    </div>
    {showAllRigs && (
      <AllRigsModal
        rigs={rigStats.map(r => ({
          ...r,
          revenue: r.revenue,
          meterage: r.meterage,
          crewDayRate: 0,
          shiftStart: r.shiftStart ? new Date(r.shiftStart).getTime() : null,
        }))}
        onClose={() => setShowAllRigs(false)}
      />
    )}
    </>
  );
}