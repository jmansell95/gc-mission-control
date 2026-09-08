import React, { useMemo, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { FileText, Mountain, ChevronRight, Cog, ExternalLink, HardHat } from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import WidgetLoadingState from '@/components/dashboard/WidgetLoadingState';
import WidgetEmptyState from '@/components/dashboard/WidgetEmptyState';
import AnimatedNumber from '@/components/hubs/AnimatedNumber';
import WidgetActionFooter from '@/components/dashboard/WidgetActionFooter';
import SparklineMini from '@/components/dashboard/SparklineMini';
import { useToast } from '@/components/ui/use-toast';
import { computeRigEarnings } from '@/utils/rigEarnings';
import { setInvestigationHubDeepLink, navigateToInvestigationHub } from '@/utils/investigationDeepLink';

const fmtGBP = (v) => {
  if (v == null || isNaN(v)) return '£0';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(v);
};

/**
 * LiveDrillingRevenueWidget — "Live Drilling Logs Today" hero tile.
 *
 * Shows today's drilling activity aggregated from live KeyLogBook
 * InvestigationLog entries: log count, metres drilled, boreholes, active rigs,
 * a 7-day trend sparkline, top borehole, and a per-job breakdown. Each job row
 * deep-links to the Investigation Hub scoped to that job; the footer links to
 * all of today's logs and offers a quick KeyLogBook sync.
 */
export default function LiveDrillingRevenueWidget({ onNavigate }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);

  // Auto-refresh every 4 minutes
  useEffect(() => {
    const id = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['rev-bento-logs'] });
    }, 4 * 60 * 1000);
    return () => clearInterval(id);
  }, [queryClient]);

  // Server-side date filter — fixes the "not working" bug where client-side
  // filtering of the 500 most-recent logs missed today's records when older
  // imports dominated the recent batch.
  const { data: todayLogs = [], isLoading } = useQuery({
    queryKey: ['rev-bento-logs', 'today', todayStr],
    queryFn: () => base44.entities.InvestigationLog.filter({
      date: todayStr,
      source: { $in: ['ags_import', 'keylogbook_remarks'] },
    }, '-created_date', 500),
    staleTime: 60000,
  });

  const { data: sorItems = [] } = useQuery({
    queryKey: ['rev-bento-sor'],
    queryFn: () => base44.entities.InvestigationSOR.list('-created_date', 500),
    staleTime: 120000,
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['rev-bento-jobs'],
    queryFn: () => base44.entities.Job.list(),
  });

  // 7-day trend — fetch recent logs and group by date
  const { data: weekLogs = [] } = useQuery({
    queryKey: ['rev-bento-week'],
    queryFn: () => base44.entities.InvestigationLog.filter({
      source: { $in: ['ags_import', 'keylogbook_remarks'] },
    }, '-created_date', 500),
    staleTime: 120000,
  });
  const weekTrend = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = format(new Date(Date.now() - i * 86400000), 'yyyy-MM-dd');
      days.push(weekLogs.filter(l => l.date === d).length);
    }
    return days;
  }, [weekLogs]);

  // Top borehole by depth today
  const topBorehole = useMemo(() => {
    const byRef = {};
    todayLogs.forEach(l => {
      if (!l.borehole_ref) return;
      if (!byRef[l.borehole_ref]) byRef[l.borehole_ref] = { ref: l.borehole_ref, metres: 0, logs: 0 };
      byRef[l.borehole_ref].logs++;
      if (l.source === 'ags_import' && l.depth_to != null) byRef[l.borehole_ref].metres = Math.max(byRef[l.borehole_ref].metres, l.depth_to);
    });
    return Object.values(byRef).sort((a, b) => b.metres - a.metres)[0] || null;
  }, [todayLogs]);

  // Per-job breakdown of today's logs
  const perJob = useMemo(() => {
    const byJob = {};
    todayLogs.forEach((l) => {
      const jid = l.job_id || 'unassigned';
      if (!byJob[jid]) byJob[jid] = { jobId: jid, logs: [], boreholes: new Set() };
      byJob[jid].logs.push(l);
      if (l.borehole_ref) byJob[jid].boreholes.add(l.borehole_ref);
    });

    return Object.values(byJob).map((g) => {
      const job = jobs.find((j) => j.id === g.jobId);
      const { perRig, totals } = computeRigEarnings({ logs: g.logs, sorItems, job });
      return {
        jobId: g.jobId,
        job,
        logCount: g.logs.length,
        boreholeCount: g.boreholes.size,
        metres: totals.metres,
        earnings: totals.earnings,
        activeRigs: perRig.length,
      };
    }).sort((a, b) => b.logCount - a.logCount || b.earnings - a.earnings);
  }, [todayLogs, sorItems, jobs]);

  const totals = useMemo(() => {
    const metres = perJob.reduce((s, j) => s + j.metres, 0);
    const earnings = perJob.reduce((s, j) => s + j.earnings, 0);
    const boreholes = perJob.reduce((s, j) => s + j.boreholeCount, 0);
    const rigs = perJob.reduce((s, j) => s + j.activeRigs, 0);
    return { logCount: todayLogs.length, metres, earnings, boreholes, rigs };
  }, [perJob, todayLogs]);

  const handleViewAll = () => {
    setInvestigationHubDeepLink({ dateFilter: 'today' });
    if (onNavigate) onNavigate('investigation');
    else navigate('/admin');
  };

  const handleJobClick = (e, jobId) => {
    e.stopPropagation();
    navigateToInvestigationHub(jobId);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await base44.functions.invoke('syncKeyLogBook');
      toast({ title: 'KeyLogBook sync triggered' });
      queryClient.invalidateQueries({ queryKey: ['rev-bento-logs'] });
    } catch {
      toast({ title: 'Sync failed', variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  const topJobs = perJob.slice(0, 4);

  if (isLoading) {
    return (
      <div className="insight-card rounded-2xl p-5 min-h-[280px] flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-700 flex items-center justify-center shadow-md">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Live Drilling Logs Today</h3>
        </div>
        <WidgetLoadingState rows={4} />
      </div>
    );
  }

  return (
    <div
      className="insight-card rounded-2xl overflow-hidden h-full flex flex-col cursor-pointer hover:shadow-lg transition group"
      onClick={handleViewAll}
    >
      {/* Header */}
      <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 px-4 py-3.5 text-white flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center ring-1 ring-white/20">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Live Drilling Logs Today</h3>
              <p className="text-[11px] text-white/70">Today · {format(new Date(), 'EEE dd MMM')}</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-white/50 group-hover:text-white group-hover:translate-x-0.5 transition" />
        </div>
      </div>

      {/* Body */}
      <div className="p-4 flex-1 flex flex-col">
        {totals.logCount === 0 ? (
          <WidgetEmptyState icon={Mountain} title="No drilling logs today" message="No KeyLogBook logs synced for today yet." />
        ) : (
          <>
            {/* Big log count */}
            <div className="mb-4">
              <div className="flex items-end gap-2">
                <p className="text-4xl font-bold text-emerald-600 tabular-nums leading-none"><AnimatedNumber value={totals.logCount} /></p>
                <span className="text-xs font-semibold text-slate-400 mb-1">logs</span>
              </div>
              <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide mt-1.5">
                {totals.earnings > 0 ? `${fmtGBP(totals.earnings)} earned` : 'synced from KeyLogBook'}
              </p>
            </div>

            {/* Secondary stats */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="rounded-xl bg-slate-50 border border-slate-100 px-2.5 py-2">
                <div className="flex items-center gap-1 mb-0.5">
                  <Mountain className="w-3 h-3 text-slate-400" />
                  <span className="text-base font-bold tabular-nums text-slate-800 leading-none">{totals.metres.toFixed(1)}</span>
                </div>
                <p className="text-[10px] text-slate-400 font-medium">metres drilled</p>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-100 px-2.5 py-2">
                <div className="flex items-center gap-1 mb-0.5">
                  <Cog className="w-3 h-3 text-slate-400" />
                  <span className="text-base font-bold tabular-nums text-slate-800 leading-none">{totals.boreholes}</span>
                </div>
                <p className="text-[10px] text-slate-400 font-medium">boreholes</p>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-100 px-2.5 py-2">
                <div className="flex items-center gap-1 mb-0.5">
                  <HardHat className="w-3 h-3 text-slate-400" />
                  <span className="text-base font-bold tabular-nums text-slate-800 leading-none">{totals.rigs}</span>
                </div>
                <p className="text-[10px] text-slate-400 font-medium">active rigs</p>
              </div>
            </div>

            {/* 7-day trend + top borehole */}
            <div className="flex items-center justify-between gap-2 mb-3 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">7-day trend</p>
                <SparklineMini data={weekTrend} color="#10b981" width={80} height={24} />
              </div>
              {topBorehole && (
                <div className="text-right min-w-0">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Top borehole</p>
                  <p className="text-xs font-bold text-slate-800 truncate">{topBorehole.ref}</p>
                  <p className="text-[10px] text-amber-600 font-semibold tabular-nums">{topBorehole.metres.toFixed(1)}m</p>
                </div>
              )}
            </div>

            {/* Top jobs by log count */}
            {topJobs.length > 0 && (
              <div className="space-y-0.5 flex-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Today's jobs</p>
                {topJobs.map((j, i) => (
                  <motion.div
                    key={j.jobId}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-emerald-50/50 transition cursor-pointer"
                    onClick={(e) => handleJobClick(e, j.jobId)}
                    title="View this job's logs in the Investigation Hub"
                  >
                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                      {j.logCount}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">{j.job?.name || 'Unassigned'}</p>
                      <p className="text-[10px] text-slate-400">
                        {j.boreholeCount} holes · {j.metres.toFixed(1)}m{j.earnings > 0 ? ` · ${fmtGBP(j.earnings)}` : ''}
                      </p>
                    </div>
                    <ExternalLink className="w-3 h-3 text-slate-300 group-hover:text-emerald-600 flex-shrink-0" />
                  </motion.div>
                ))}
              </div>
            )}

            {/* Footer — deep-link + quick-action */}
            <WidgetActionFooter
              deepLinkLabel="Investigation Hub"
              onDeepLink={handleViewAll}
              quickActionLabel={syncing ? 'Syncing…' : 'Sync KeyLogBook'}
              onQuickAction={handleSync}
            />
          </>
        )}
      </div>
    </div>
  );
}