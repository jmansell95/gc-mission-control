import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Radio, Loader2, ChevronDown, ChevronUp, ArrowUpRight, Calendar } from 'lucide-react';
import { Skeleton } from '@/components/StateViews';
import KeyLogActivityCard from '@/components/investigation/KeyLogActivityCard';
import { londonDateStr, formatLondonDate } from '@/utils/siteLogUtils';

/**
 * LiveKeyLogFeed — pinned to the top of the Investigation Hub.
 *
 * Shows this week's incoming KeyLogBook remarks logs across ALL jobs as they
 * sync, grouped by day with clear date headers, then by job within each day.
 * Subscribes to realtime InvestigationLog creates so new logs appear without
 * a manual refresh. Each card deep-links back to the job's Site Activity tab.
 *
 * Props:
 *  - jobs: all jobs (for name lookup + navigation)
 */
export default function LiveKeyLogFeed({ jobs = [] }) {
  const queryClient = useQueryClient();
  const [collapsed, setCollapsed] = useState(false);
  const [pulse, setPulse] = useState(false);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['live-keylog-feed'],
    queryFn: async () => {
      // Last 7 days of keylogbook_remarks logs, newest first
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const all = await base44.entities.InvestigationLog.list('-created_date', 500);
      return all.filter(l => l.source === 'keylogbook_remarks' && (l.created_date || l.created_at || '') >= since);
    },
    refetchInterval: 60000, // safety net refresh every minute
  });

  // Realtime subscription — new logs push in instantly
  useEffect(() => {
    const unsubscribe = base44.entities.InvestigationLog.subscribe((event) => {
      if (event?.type === 'create') {
        queryClient.invalidateQueries({ queryKey: ['live-keylog-feed'] });
        setPulse(true);
        setTimeout(() => setPulse(false), 1500);
      }
    });
    return unsubscribe;
  }, [queryClient]);

  const jobMap = useMemo(() => {
    const m = {};
    jobs.forEach(j => { m[j.id] = j; });
    return m;
  }, [jobs]);

  // Group by day (descending), then by job within each day
  const byDay = useMemo(() => {
    const dayMap = {};
    logs.forEach(l => {
      const dateStr = l.date || (l.created_date || '').slice(0, 10) || londonDateStr(0);
      if (!dayMap[dateStr]) dayMap[dateStr] = { date: dateStr, jobs: {} };
      const jobKey = l.job_id || '__no_job__';
      if (!dayMap[dateStr].jobs[jobKey]) {
        dayMap[dateStr].jobs[jobKey] = {
          jobId: jobKey,
          jobName: jobMap[l.job_id]?.name || 'Unknown job',
          logs: [],
        };
      }
      dayMap[dateStr].jobs[jobKey].logs.push(l);
    });

    // Convert to sorted array of days, each with sorted array of job groups
    return Object.values(dayMap)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(day => ({
        ...day,
        jobGroups: Object.values(day.jobs).sort((a, b) => {
          const aMax = Math.max(...a.logs.map(l => new Date(l.created_date || l.created_at || 0).getTime()));
          const bMax = Math.max(...b.logs.map(l => new Date(l.created_date || l.created_at || 0).getTime()));
          return bMax - aMax;
        }),
      }));
  }, [logs, jobMap]);

  const todayCount = logs.filter(l => (l.date || '') === londonDateStr(0)).length;
  const weekCount = logs.length;

  if (isLoading) {
    return (
      <div className="hub-glass rounded-2xl p-4 mb-4">
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
    );
  }

  if (logs.length === 0) return null;

  const isToday = (dateStr) => dateStr === londonDateStr(0);
  const isYesterday = (dateStr) => dateStr === londonDateStr(-1);

  const dayLabel = (dateStr) => {
    if (isToday(dateStr)) return 'Today';
    if (isYesterday(dateStr)) return 'Yesterday';
    try {
      return formatLondonDate(dateStr);
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="hub-glass rounded-2xl mb-4 overflow-hidden">
      {/* Header — pulsing live indicator */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-50/60 transition"
      >
        <div className="relative flex-shrink-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center shadow-sm">
            <Radio className="w-5 h-5 text-white" />
          </div>
          <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-white" />
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm sm:text-base font-bold text-slate-900">Live KeyLogBook Feed</h3>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide inline-flex items-center gap-1 ${pulse ? 'bg-emerald-500 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current" /> Live
            </span>
            <span className="text-xs text-slate-500">{weekCount} activities this week</span>
            {todayCount > 0 && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">{todayCount} today</span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5 hidden sm:block">This week's incoming driller logs across all jobs — auto-refreshing</p>
        </div>
        {collapsed ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronUp className="w-5 h-5 text-slate-400" />}
      </button>

      {!collapsed && (
        <div className="px-3 sm:px-4 pb-4 space-y-3 max-h-[32rem] overflow-y-auto">
          {byDay.map(day => (
            <div key={day.date} className="space-y-2">
              {/* Day header — clear date with activity count */}
              <div className="flex items-center gap-2 px-1 pt-1">
                <Calendar className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                <p className="text-xs font-bold text-slate-700">{dayLabel(day.date)}</p>
                <span className="text-[10px] text-slate-400">
                  {Object.values(day.jobs).reduce((s, g) => s + g.logs.length, 0)} activities
                </span>
                <div className="flex-1 h-px bg-slate-100" />
              </div>

              {/* Job groups within this day */}
              {day.jobGroups.map(group => {
                const job = jobMap[group.jobId];
                return (
                  <div key={`${day.date}-${group.jobId}`} className="rounded-xl border border-slate-100 overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-50/80 border-b border-slate-100">
                      <ArrowUpRight className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                      <p className="text-xs font-bold text-slate-800 truncate flex-1">{group.jobName}</p>
                      <span className="text-[10px] text-slate-400 flex-shrink-0">{group.logs.length} {group.logs.length === 1 ? 'activity' : 'activities'}</span>
                    </div>
                    <div className="p-2 space-y-1.5 bg-white">
                      {group.logs.slice(0, 10).map(log => (
                        <KeyLogActivityCard
                          key={log.id}
                          log={log}
                          job={job}
                          linkDirection="to_job"
                          compact
                        />
                      ))}
                      {group.logs.length > 10 && (
                        <p className="text-[10px] text-slate-400 text-center py-1">+ {group.logs.length - 10} more</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}