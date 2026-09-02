import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Activity, Search, Maximize2, Minimize2, Loader2, CheckSquare } from 'lucide-react';
import { Skeleton, EmptyState } from '@/components/StateViews';
import { useToast } from '@/components/ui/use-toast';
import SiteLogDayCard from './SiteLogDayCard';
import SiteLogDateRange from './SiteLogDateRange';
import SiteLogBulkBar from './SiteLogBulkBar';
import SiteLogExport from './SiteLogExport';
import { detectActivityType, TAG_COLORS, ALL_TAG_TYPES, londonDateStr } from '@/utils/siteLogUtils';

function fmtDur(mins) {
  const m = Math.round(Number(mins) || 0);
  const h = Math.floor(m / 60), r = m % 60;
  if (h && r) return `${h}h ${r}m`;
  if (h) return `${h}h`;
  return m > 0 ? `${r}m` : '0m';
}

/**
 * SiteLogReviewManager — redesigned Site Logs timeline with full filtering.
 *
 * Features: date range picker (default 7 days), driller filter, search, status
 * filter, activity type tags + filter, group by borehole/chronological,
 * expand/collapse all, bulk approve/reject, and Excel/PDF export.
 */
export default function SiteLogReviewManager({ job, assignedStaff, initialSelectedLogId }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ driller: 'all', search: '', status: 'all', groupBy: 'chrono', activityType: 'all' });
  const [dateRange, setDateRange] = useState({ preset: '7d', from: londonDateStr(-6), to: londonDateStr(0) });
  const [collapsedDays, setCollapsedDays] = useState(new Set());
  const [selectedActivityId, setSelectedActivityId] = useState(initialSelectedLogId || null);
  const [backfilling, setBackfilling] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['investigation-logs', job.id],
    queryFn: () => base44.entities.InvestigationLog.filter({ job_id: job.id }),
  });

  const remarksLogs = logs.filter(l => l.source === 'keylogbook_remarks');

  // Distinct drillers
  const drillers = useMemo(() =>
    [...new Set(remarksLogs.map(l => l.staff_name).filter(Boolean))].sort(),
  [remarksLogs]);

  // Apply filters (including date range + activity type)
  const filteredLogs = useMemo(() =>
    remarksLogs.filter(l => {
      if (dateRange.from && l.date < dateRange.from) return false;
      if (dateRange.to && l.date > dateRange.to) return false;
      if (filters.driller !== 'all' && l.staff_name !== filters.driller) return false;
      if (filters.search && !l.description?.toLowerCase().includes(filters.search.toLowerCase())) return false;
      const status = l.manager_review_status || 'pending';
      if (filters.status === 'pending' && status !== 'pending' && status !== 'queried') return false;
      if (filters.status === 'approved' && status !== 'approved') return false;
      if (filters.activityType !== 'all' && detectActivityType(l.description).type !== filters.activityType) return false;
      return true;
    }),
  [remarksLogs, filters, dateRange]);

  // Group by date
  const byDate = useMemo(() => {
    const map = {};
    filteredLogs.forEach(l => {
      if (!map[l.date]) map[l.date] = [];
      map[l.date].push(l);
    });
    return map;
  }, [filteredLogs]);

  const sortedDates = Object.keys(byDate).sort().reverse();

  // Bidirectional deep-link: when arriving from the Investigation Hub, the
  // target log id is passed in. Auto-expand the day that contains it so the
  // manager lands on the right activity without having to hunt for it.
  useEffect(() => {
    if (!initialSelectedLogId) return;
    const day = Object.keys(byDate).find(d => byDate[d].some(l => l.id === initialSelectedLogId));
    if (day) {
      setCollapsedDays(prev => { const next = new Set(prev); next.delete(day); return next; });
    }
  }, [initialSelectedLogId, byDate]);

  // Stats
  const pendingCount = filteredLogs.filter(l => (l.manager_review_status || 'pending') !== 'approved').length;
  const approvedCount = filteredLogs.filter(l => l.manager_review_status === 'approved').length;
  const totalMinutes = filteredLogs.reduce((s, l) => s + (l.duration_minutes || 0), 0);

  // Expand/collapse all
  const allCollapsed = sortedDates.length > 0 && collapsedDays.size === sortedDates.length;
  const toggleAll = () => {
    if (allCollapsed) setCollapsedDays(new Set());
    else setCollapsedDays(new Set(sortedDates));
  };
  const toggleDay = (date) => {
    setCollapsedDays(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };
  const isDayExpanded = (date) => !collapsedDays.has(date);

  // Backfill durations
  const handleBackfill = async () => {
    setBackfilling(true);
    try {
      const res = await base44.functions.invoke('backfillKlbDurations', {});
      const data = res.data || res;
      queryClient.invalidateQueries({ queryKey: ['investigation-logs', job.id] });
      toast({ title: 'Durations backfilled', description: `Fixed ${data.updated || 0} of ${data.logs_with_zero_duration || 0} logs with missing durations.` });
    } catch (e) {
      toast({ title: 'Error', description: 'Backfill failed. Please try again.', variant: 'destructive' });
    }
    setBackfilling(false);
  };

  // Bulk selection
  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const selectAll = () => setSelectedIds(new Set(filteredLogs.map(l => l.id)));

  const handleBulkApprove = async () => {
    setBulkProcessing(true);
    try {
      const updates = Array.from(selectedIds).map(id => ({ id, manager_review_status: 'approved' }));
      for (let i = 0; i < updates.length; i += 500) {
        await base44.entities.InvestigationLog.bulkUpdate(updates.slice(i, i + 500));
      }
      queryClient.invalidateQueries({ queryKey: ['investigation-logs', job.id] });
      toast({ title: 'Approved', description: `${selectedIds.size} activities approved.` });
      setSelectedIds(new Set());
      setSelectMode(false);
    } catch (e) {
      toast({ title: 'Error', description: 'Bulk approve failed.', variant: 'destructive' });
    }
    setBulkProcessing(false);
  };

  const handleBulkReject = async () => {
    setBulkProcessing(true);
    try {
      const updates = Array.from(selectedIds).map(id => ({ id, manager_review_status: 'queried' }));
      for (let i = 0; i < updates.length; i += 500) {
        await base44.entities.InvestigationLog.bulkUpdate(updates.slice(i, i + 500));
      }
      queryClient.invalidateQueries({ queryKey: ['investigation-logs', job.id] });
      toast({ title: 'Rejected', description: `${selectedIds.size} activities rejected (flagged for query).` });
      setSelectedIds(new Set());
      setSelectMode(false);
    } catch (e) {
      toast({ title: 'Error', description: 'Bulk reject failed.', variant: 'destructive' });
    }
    setBulkProcessing(false);
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <Skeleton className="h-8 w-48 mb-4" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {remarksLogs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <EmptyState
            icon={Activity}
            title="No site logs yet"
            message="Daily activities will appear here automatically when your driller saves their remarks in KeyLogBook and the data syncs via the webhook or AGS import."
          />
        </div>
      ) : (
        <>
          {/* Filter bar */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 space-y-2.5">
            {/* Date range */}
            <SiteLogDateRange value={dateRange} onChange={setDateRange} />

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search activities…"
                value={filters.search}
                onChange={e => setFilters({ ...filters, search: e.target.value })}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-600 focus:bg-white transition"
              />
            </div>

            {/* Filter pills row */}
            <div className="flex items-center gap-2 flex-wrap">
              {drillers.length > 1 && (
                <select
                  value={filters.driller}
                  onChange={e => setFilters({ ...filters, driller: e.target.value })}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:border-emerald-600 cursor-pointer"
                >
                  <option value="all">All drillers</option>
                  {drillers.map(dr => <option key={dr} value={dr}>{dr}</option>)}
                </select>
              )}

              <div className="flex bg-slate-100 rounded-xl p-0.5">
                {['all', 'pending', 'approved'].map(s => (
                  <button key={s}
                    onClick={() => setFilters({ ...filters, status: s })}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${filters.status === s ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    {s}
                  </button>
                ))}
              </div>

              <div className="flex bg-slate-100 rounded-xl p-0.5">
                <button onClick={() => setFilters({ ...filters, groupBy: 'chrono' })}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${filters.groupBy === 'chrono' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  Chronological
                </button>
                <button onClick={() => setFilters({ ...filters, groupBy: 'borehole' })}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${filters.groupBy === 'borehole' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  By Borehole
                </button>
              </div>

              {/* Select mode toggle */}
              <button onClick={() => { setSelectMode(!selectMode); if (selectMode) setSelectedIds(new Set()); }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition ${selectMode ? 'bg-emerald-600 text-white' : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'}`}>
                <CheckSquare className="w-3.5 h-3.5" /> {selectMode ? 'Exit Select' : 'Select'}
              </button>

              {/* Export */}
              <SiteLogExport logs={filteredLogs} jobName={job?.name} />

              {/* Expand/collapse all */}
              <button onClick={toggleAll}
                className="ml-auto flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 transition">
                {allCollapsed ? <><Maximize2 className="w-3.5 h-3.5" /> Expand all</> : <><Minimize2 className="w-3.5 h-3.5" /> Collapse all</>}
              </button>
            </div>

            {/* Activity type filter pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button onClick={() => setFilters({ ...filters, activityType: 'all' })}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${filters.activityType === 'all' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                All types
              </button>
              {ALL_TAG_TYPES.map(t => {
                const c = TAG_COLORS[t.color];
                return (
                  <button key={t.type} onClick={() => setFilters({ ...filters, activityType: t.type })}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${filters.activityType === t.type ? `${c.bg} ${c.text} ring-1 ring-current` : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* Backfill button */}
            {remarksLogs.some(l => (!l.duration_minutes || l.duration_minutes === 0) && l.start_time && l.end_time) && (
              <button onClick={handleBackfill} disabled={backfilling}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl text-xs font-semibold text-amber-700 transition disabled:opacity-50">
                {backfilling ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Fixing durations…</> : 'Fix missing durations (midnight-crossing fix)'}
              </button>
            )}
          </div>

          {/* Mini stats */}
          <div className="grid grid-cols-4 gap-2">
            <MiniStat label="Activities" value={filteredLogs.length} tone="slate" />
            <MiniStat label="Approved" value={approvedCount} tone="emerald" />
            <MiniStat label="Pending" value={pendingCount} tone="amber" />
            <MiniStat label="Total Time" value={fmtDur(totalMinutes)} tone="indigo" />
          </div>

          {/* Day-by-day timeline */}
          {sortedDates.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
              <p className="text-sm text-slate-400">No activities match your filters.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedDates.map(date => (
                <SiteLogDayCard
                  key={date}
                  date={date}
                  logs={byDate[date]}
                  job={job}
                  isExpanded={isDayExpanded(date)}
                  onToggle={toggleDay}
                  groupBy={filters.groupBy}
                  selectedActivityId={selectedActivityId}
                  onSelectActivity={setSelectedActivityId}
                  selectMode={selectMode}
                  selectedIds={selectedIds}
                  onToggleSelect={toggleSelect}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Bulk action bar */}
      {selectMode && (
        <SiteLogBulkBar
          selectedCount={selectedIds.size}
          totalCount={filteredLogs.length}
          onApprove={handleBulkApprove}
          onReject={handleBulkReject}
          onSelectAll={selectAll}
          onClear={() => setSelectedIds(new Set())}
          onExit={() => { setSelectMode(false); setSelectedIds(new Set()); }}
          processing={bulkProcessing}
        />
      )}
    </div>
  );
}

function MiniStat({ label, value, tone }) {
  const tones = {
    slate: 'text-slate-700',
    amber: 'text-amber-600',
    emerald: 'text-emerald-700',
    indigo: 'text-indigo-700',
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-2 py-2.5 text-center shadow-sm">
      <p className="text-[9px] text-slate-400 uppercase font-medium tracking-wide">{label}</p>
      <p className={`text-base font-bold tabular-nums ${tones[tone] || 'text-slate-800'}`}>{value}</p>
    </div>
  );
}