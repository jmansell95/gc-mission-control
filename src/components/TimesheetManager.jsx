import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Clock, CheckCircle2, XCircle, TrendingUp, Users, Search, ChevronLeft, ChevronRight,
  CalendarDays, Ruler, FileText, RotateCcw, Calendar, CalendarRange, Merge, Loader2,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import WithdrawnAcknowledgementPanel from '@/components/WithdrawnAcknowledgementPanel';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/StateViews';
import { computeStaffOvertime, buildRateMap, weekKey, entryMinutes } from '@/utils/overtime';
import { fmtDur, getWeekSignatures, computeWeekStatus } from '@/utils/timesheetHelpers';
import WeeklyTimesheetCard from '@/components/timesheets/WeeklyTimesheetCard';
import PendingReviewQueue from '@/components/timesheets/PendingReviewQueue';
import WeeklySummaryTable from '@/components/timesheets/WeeklySummaryTable';

const meterageOf = (t) => Number(t?.meterage) || 0;

function StatBox({ icon: Icon, label, value, gradient = 'stat-gradient-slate', sub }) {
  return (
    <div className="insight-card rounded-2xl p-4 relative overflow-hidden">
      <div className={`absolute -top-6 -right-6 w-20 h-20 rounded-full ${gradient} opacity-10`} />
      <div className="relative">
        <div className={`w-9 h-9 rounded-xl ${gradient} flex items-center justify-center mb-2.5`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <p className="text-2xl font-extrabold text-slate-900 tabular-nums leading-none">{value}</p>
        <p className="text-xs font-semibold text-slate-500 mt-1">{label}</p>
        {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

const RANGE_MODES = [
  { key: 'today', label: 'Today', icon: Clock },
  { key: 'week', label: 'This Week', icon: CalendarDays },
  { key: 'month', label: 'This Month', icon: CalendarRange },
  { key: 'custom', label: 'Custom', icon: Calendar },
];

export default function TimesheetManager() {
  const [staffFilter, setStaffFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [rangeMode, setRangeMode] = useState('week');
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [customStart, setCustomStart] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [bulkMerging, setBulkMerging] = useState(false);
  const queryClient = useQueryClient();

  const { data: timesheets = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['timesheets'],
    queryFn: () => base44.entities.Timesheet.list('-created_date', 500)
  });
  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list() });
  const { data: overtimeRates = [] } = useQuery({ queryKey: ['overtime-rates'], queryFn: () => base44.entities.OvertimeRate.list() });
  const { data: overtimeSetting } = useQuery({
    queryKey: ['overtime-setting'],
    queryFn: async () => { const list = await base44.entities.OvertimeSetting.list(); return list[0] || null; }
  });
  const { data: currentUser } = useQuery({ queryKey: ['current-user'], queryFn: () => base44.auth.me() });

  const otRateMap = buildRateMap(overtimeRates);
  const otThreshold = overtimeSetting?.weekly_threshold_hours ?? 40;

  // Compute the date range based on the selected mode
  const { rangeStart, rangeEnd, rangeLabel } = useMemo(() => {
    const now = new Date();
    if (rangeMode === 'today') {
      const today = format(now, 'yyyy-MM-dd');
      return { rangeStart: today, rangeEnd: today, rangeLabel: format(now, 'EEEE, dd MMM yyyy') };
    }
    if (rangeMode === 'week') {
      const d = new Date();
      const day = d.getDay();
      const diff = day === 0 ? 6 : day - 1;
      const monday = new Date(d);
      monday.setDate(d.getDate() - diff + weekOffset * 7);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return {
        rangeStart: format(monday, 'yyyy-MM-dd'),
        rangeEnd: format(sunday, 'yyyy-MM-dd'),
        rangeLabel: `${format(monday, 'dd MMM')} – ${format(sunday, 'dd MMM yyyy')}`,
      };
    }
    if (rangeMode === 'month') {
      const d = new Date();
      d.setMonth(d.getMonth() + monthOffset);
      const start = startOfMonth(d);
      const end = endOfMonth(d);
      return {
        rangeStart: format(start, 'yyyy-MM-dd'),
        rangeEnd: format(end, 'yyyy-MM-dd'),
        rangeLabel: format(d, 'MMMM yyyy'),
      };
    }
    return { rangeStart: customStart, rangeEnd: customEnd, rangeLabel: `${format(parseISO(customStart), 'dd MMM')} – ${format(parseISO(customEnd), 'dd MMM yyyy')}` };
  }, [rangeMode, weekOffset, monthOffset, customStart, customEnd]);

  // Work timesheets = non-break
  const workTimesheets = timesheets.filter((t) => !t.is_break);

  // Overtime breakdowns per staff
  const otBreakdowns = useMemo(() => {
    const map = {};
    staff.forEach((s) => {
      const entries = timesheets.filter((t) => t.staff_id === s.id && (t.status === 'submitted' || t.status === 'approved' || t.status === 'merged'));
      map[s.id] = computeStaffOvertime(entries, otRateMap, otThreshold);
    });
    return map;
  }, [staff, timesheets, otRateMap, otThreshold]);

  // Filter timesheets by the selected date range
  const rangeFiltered = useMemo(() => {
    return workTimesheets.filter((t) => {
      if (!t.date) return false;
      return t.date >= rangeStart && t.date <= rangeEnd;
    });
  }, [workTimesheets, rangeStart, rangeEnd]);

  // Stats for the selected range
  const pendingCount = rangeFiltered.filter((t) => t.status === 'submitted').length;
  const approvedCount = rangeFiltered.filter((t) => t.status === 'approved').length;
  const rangeMins = rangeFiltered.filter((t) => t.status !== 'rejected').reduce((s, t) => s + entryMinutes(t), 0);
  const rangeOtMins = rangeFiltered.filter((t) => t.status !== 'rejected').reduce((s, t) => s + (otBreakdowns[t.staff_id]?.[t.id]?.otMins || 0), 0);
  const rangeMeterage = rangeFiltered.filter((t) => t.status === 'approved').reduce((s, t) => s + meterageOf(t), 0);

  // Apply staff, status, and search filters
  const displayFiltered = useMemo(() => {
    return rangeFiltered.filter((t) => {
      if (staffFilter !== 'all' && t.staff_id !== staffFilter) return false;
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (search.trim()) {
        const member = staff.find((s) => s.id === t.staff_id);
        const job = jobs.find((j) => j.id === t.job_id);
        const q = search.toLowerCase();
        if (!`${member?.name || ''} ${job?.name || ''} ${t.task_description || ''} ${t.notes || ''}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [rangeFiltered, staffFilter, statusFilter, search, staff, jobs]);

  // Group by staff + week_start (for week mode — uses WeeklyTimesheetCard)
  const weeklyGroups = useMemo(() => {
    if (rangeMode !== 'week') return [];
    const groups = {};
    displayFiltered.forEach((t) => {
      const wk = t.week_start || weekKey(t.date);
      const key = `${t.staff_id}|${wk}`;
      if (!groups[key]) groups[key] = { staffId: t.staff_id, weekStart: wk, entries: [] };
      groups[key].entries.push(t);
    });
    return Object.values(groups).sort((a, b) => {
      const an = staff.find((s) => s.id === a.staffId)?.name || '';
      const bn = staff.find((s) => s.id === b.staffId)?.name || '';
      return an.localeCompare(bn);
    });
  }, [displayFiltered, rangeMode, staff]);

  // Group by date (for today/month/custom modes — flat list)
  const byDateGroups = useMemo(() => {
    if (rangeMode === 'week') return [];
    const groups = {};
    displayFiltered.forEach((t) => {
      if (!groups[t.date]) groups[t.date] = [];
      groups[t.date].push(t);
    });
    return Object.keys(groups).sort().reverse().map(date => ({ date, entries: groups[date] }));
  }, [displayFiltered, rangeMode]);

  const handleBulkApprove = async () => {
    const pending = displayFiltered.filter((t) => t.status === 'submitted');
    if (pending.length === 0) return;
    if (!confirm(`Approve ${pending.length} submitted timesheet(s)?`)) return;
    const updates = pending.map((t) => ({ id: t.id, status: 'approved', approved_by_name: currentUser?.full_name || '' }));
    await base44.entities.Timesheet.bulkUpdate(updates);
    queryClient.invalidateQueries({ queryKey: ['timesheets'] });
  };

  const handleApprove = async (id) => {
    await base44.entities.Timesheet.update(id, { status: 'approved', approved_by_name: currentUser?.full_name || '' });
    queryClient.invalidateQueries({ queryKey: ['timesheets'] });
  };
  const handleReject = async (id) => {
    await base44.entities.Timesheet.update(id, { status: 'rejected' });
    queryClient.invalidateQueries({ queryKey: ['timesheets'] });
  };

  // Bulk merge all ready weeks
  const handleMergeAllReady = async () => {
    // Check which groups are ready to merge (all approved, not yet merged)
    const readyGroups = [];
    for (const g of weeklyGroups) {
      const sigs = await getWeekSignatures(g.weekStart, g.staffId);
      const status = computeWeekStatus(g.entries, sigs);
      if (status.readyToMerge) readyGroups.push(g);
    }
    if (readyGroups.length === 0) return;
    if (!confirm(`Merge ${readyGroups.length} ready week(s) into weekly timesheets? This locks them for payroll.`)) return;
    setBulkMerging(true);
    for (const g of readyGroups) {
      try {
        await base44.functions.invoke('mergeWeeklyTimesheet', { staff_id: g.staffId, week_start: g.weekStart });
      } catch (e) { /* continue with next */ }
    }
    queryClient.invalidateQueries({ queryKey: ['timesheets'] });
    queryClient.invalidateQueries({ queryKey: ['all-timesheets-mgr'] });
    setBulkMerging(false);
  };

  const statusConfig = {
    draft: { label: 'Draft', badge: 'bg-slate-100 text-slate-600' },
    submitted: { label: 'Submitted', badge: 'bg-amber-100 text-amber-700' },
    approved: { label: 'Approved', badge: 'bg-emerald-100 text-emerald-700' },
    rejected: { label: 'Rejected', badge: 'bg-red-100 text-red-700' },
    merged: { label: 'Merged', badge: 'bg-indigo-100 text-indigo-700' },
  };

  const renderFlatEntry = (t) => {
    const member = staff.find((s) => s.id === t.staff_id);
    const job = jobs.find((j) => j.id === t.job_id);
    const mins = entryMinutes(t);
    const ot = otBreakdowns[t.staff_id]?.[t.id] || {};
    const sc = statusConfig[t.status] || statusConfig.submitted;
    return (
      <div key={t.id} className="p-3 bg-white rounded-xl border border-slate-100 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0">
          <Clock className="w-4 h-4 text-emerald-600" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium text-sm text-slate-900 truncate">{member?.name || 'Unknown'}</p>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${sc.badge}`}>{sc.label}</span>
          </div>
          <p className="text-xs text-slate-500 truncate mt-0.5">{job?.name || '—'} · {t.is_summary ? 'Daily Summary' : t.task_description}</p>
          <div className="flex items-center gap-2 mt-1 text-xs flex-wrap">
            <span className="font-semibold text-slate-700">{fmtDur(mins)}</span>
            {ot.isOvertime && <span className="text-amber-600 font-medium">OT ×{ot.multiplier}</span>}
            {t.start_time && t.end_time && <span className="text-slate-400">{t.start_time}–{t.end_time}</span>}
          </div>
        </div>
        {t.status === 'submitted' && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={() => handleApprove(t.id)} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition" title="Approve"><CheckCircle2 className="w-5 h-5" /></button>
            <button onClick={() => handleReject(t.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition" title="Reject"><XCircle className="w-5 h-5" /></button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <SettingsSectionHeader icon={Clock} title="Timesheets" description="Review daily entries, approve the week, then merge & download for payroll" />

      {/* Stat boxes */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
        <StatBox icon={Clock} label="Pending Approval" value={pendingCount} gradient="stat-gradient-amber" />
        <StatBox icon={CheckCircle2} label="Total Hours" value={fmtDur(rangeMins)} gradient="stat-gradient-emerald" sub="in range" />
        <StatBox icon={TrendingUp} label="Overtime" value={fmtDur(rangeOtMins)} gradient="stat-gradient-rose" sub="across all crew" />
        <StatBox icon={FileText} label="Approved" value={approvedCount} gradient="stat-gradient-slate" sub="entries" />
        {rangeMeterage > 0 && (
          <StatBox icon={Ruler} label="Meterage" value={`${rangeMeterage}m`} gradient="stat-gradient-violet" sub="approved" />
        )}
      </div>

      <WithdrawnAcknowledgementPanel timesheets={timesheets} staff={staff} jobs={jobs} currentUser={currentUser} />

      {/* Range mode selector */}
      <div className="flex flex-wrap gap-2 mb-3">
        {RANGE_MODES.map(m => {
          const Icon = m.icon;
          return (
            <button key={m.key} onClick={() => setRangeMode(m.key)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition ${rangeMode === m.key ? 'bg-[#2E5A1A] text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
              <Icon className="w-4 h-4" /> {m.label}
            </button>
          );
        })}
      </div>

      {/* Date navigator + filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4 items-stretch sm:items-center">
        {rangeMode === 'week' && (
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2 py-1.5">
            <button onClick={() => setWeekOffset((w) => w - 1)} className="p-1 text-slate-400 hover:text-slate-700 rounded transition" title="Previous week">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 min-w-[140px] justify-center">
              <CalendarDays className="w-4 h-4 text-emerald-600" />
              {rangeLabel}
            </div>
            <button onClick={() => setWeekOffset((w) => w + 1)} disabled={weekOffset >= 0} className="p-1 text-slate-400 hover:text-slate-700 rounded transition disabled:opacity-30 disabled:cursor-not-allowed" title="Next week">
              <ChevronRight className="w-4 h-4" />
            </button>
            {weekOffset !== 0 && (
              <button onClick={() => setWeekOffset(0)} className="ml-1 p-1 text-slate-400 hover:text-emerald-600 rounded transition" title="Jump to this week">
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
        {rangeMode === 'month' && (
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2 py-1.5">
            <button onClick={() => setMonthOffset((m) => m - 1)} className="p-1 text-slate-400 hover:text-slate-700 rounded transition" title="Previous month">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 min-w-[120px] justify-center">
              <CalendarRange className="w-4 h-4 text-emerald-600" />
              {rangeLabel}
            </div>
            <button onClick={() => setMonthOffset((m) => m + 1)} disabled={monthOffset >= 0} className="p-1 text-slate-400 hover:text-slate-700 rounded transition disabled:opacity-30 disabled:cursor-not-allowed" title="Next month">
              <ChevronRight className="w-4 h-4" />
            </button>
            {monthOffset !== 0 && (
              <button onClick={() => setMonthOffset(0)} className="ml-1 p-1 text-slate-400 hover:text-emerald-600 rounded transition" title="Jump to this month">
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
        {rangeMode === 'today' && (
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2">
            <Clock className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-semibold text-slate-700">{rangeLabel}</span>
          </div>
        )}
        {rangeMode === 'custom' && (
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2 py-1.5">
            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
              className="px-2 py-1 text-sm border-0 focus:outline-none focus:ring-0 bg-transparent" />
            <span className="text-slate-400 text-sm">–</span>
            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
              className="px-2 py-1 text-sm border-0 focus:outline-none focus:ring-0 bg-transparent" />
          </div>
        )}
        <select value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-sm border border-slate-200 bg-white text-slate-600 focus:outline-none focus:border-emerald-600 capitalize">
          <option value="all">All staff</option>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-sm border border-slate-200 bg-white text-slate-600 focus:outline-none focus:border-emerald-600 capitalize">
          <option value="all">All statuses</option>
          <option value="submitted">Submitted</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="merged">Merged</option>
        </select>
        <div className="relative flex-1 sm:max-w-xs sm:ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search staff, job or task..."
            className="w-full pl-9 pr-4 py-1.5 rounded-lg text-sm border border-slate-200 bg-white focus:outline-none focus:border-emerald-600" />
        </div>
      </div>

      {/* Bulk approve (non-week modes) */}
      {rangeMode !== 'week' && pendingCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <button onClick={handleBulkApprove} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#2E5A1A] text-white rounded-lg text-xs font-semibold hover:bg-[#1c4a12] transition">
            <CheckCircle2 className="w-3.5 h-3.5" /> Approve all submitted ({pendingCount})
          </button>
          <span className="text-[11px] text-slate-400">Approves every submitted day across all crew for the selected range.</span>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="insight-card rounded-2xl overflow-hidden">
          <TableSkeleton rows={4} cols={6} />
        </div>
      ) : isError ? (
        <div className="insight-card rounded-2xl overflow-hidden">
          <ErrorState message="Couldn't load timesheets" onRetry={refetch} />
        </div>
      ) : rangeMode === 'week' ? (
        <div className="space-y-4">
          {/* 1. Pending Review Queue */}
          <PendingReviewQueue
            timesheets={rangeFiltered}
            staff={staff}
            jobs={jobs}
            otBreakdowns={otBreakdowns}
            currentUser={currentUser}
            weekStart={rangeStart}
          />

          {/* 2. Consolidated Weekly Summary Table */}
          {weeklyGroups.length > 0 && (
            <WeeklySummaryTable
              weeklyGroups={weeklyGroups}
              staff={staff}
              jobs={jobs}
              otBreakdowns={otBreakdowns}
              weekStart={rangeStart}
              onMergeAll={handleMergeAllReady}
              merging={bulkMerging}
            />
          )}

          {/* 3. Per-staff Weekly Cards */}
          {weeklyGroups.length === 0 ? (
            <div className="insight-card rounded-2xl overflow-hidden">
              <EmptyState icon={Users} title="No timesheets this week" message="No submitted or approved timesheets for the selected week and filters. Use the arrows to check other weeks." />
            </div>
          ) : (
            <div className="space-y-4">
              {weeklyGroups.map((g) => {
                const member = staff.find((s) => s.id === g.staffId);
                return (
                  <WeeklyTimesheetCard
                    key={`${g.staffId}|${g.weekStart}`}
                    staffMember={member}
                    weekStart={g.weekStart}
                    dailySummaries={g.entries}
                    jobs={jobs}
                    otBreakdowns={otBreakdowns[g.staffId] || {}}
                    currentUser={currentUser}
                  />
                );
              })}
            </div>
          )}
        </div>
      ) : (
        byDateGroups.length === 0 ? (
          <div className="insight-card rounded-2xl overflow-hidden">
            <EmptyState icon={Users} title="No timesheets in this range" message="No timesheets found for the selected date range and filters. Try a different range or clear your filters." />
          </div>
        ) : (
          <div className="space-y-4">
            {byDateGroups.map(({ date, entries }) => (
              <div key={date}>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{format(new Date(date + 'T00:00:00'), 'EEEE, dd MMM yyyy')}</p>
                <div className="space-y-2">{entries.map(renderFlatEntry)}</div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}