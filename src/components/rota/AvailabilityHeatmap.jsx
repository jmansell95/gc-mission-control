import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import {
  Search, ChevronLeft, ChevronRight, Download, Loader2, Grid3x3, Users, Cog,
  Calendar, TrendingUp, Coffee, Wrench, CalendarPlus, Zap,
} from 'lucide-react';
import { startOfWeek, addWeeks, addMonths, format } from 'date-fns';
import { useDivision } from '@/contexts/DivisionContext';
import {
  STATUS_CONFIG, STATUS_ORDER, buildStatusMaps, getYearDays, getMonthDays, getWeekDays,
  computeRangeAnalytics, findAvailableResources,
} from './heatmapUtils';
import YearHeatmapGrid from './YearHeatmapGrid';
import MonthHeatmapGrid from './MonthHeatmapGrid';
import WeekListView from './WeekListView';

export default function AvailabilityHeatmap() {
  const navigate = useNavigate();
  const { activeDivision } = useDivision();
  const [viewMode, setViewMode] = useState('year');
  const [year, setYear] = useState(new Date().getFullYear());
  const [monthIdx, setMonthIdx] = useState(new Date().getMonth());
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [search, setSearch] = useState('');
  const [resourceToggle, setResourceToggle] = useState('all');
  const [jumpDate, setJumpDate] = useState('');
  const [showGapFinder, setShowGapFinder] = useState(false);
  const [gapFrom, setGapFrom] = useState('');
  const [gapTo, setGapTo] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['availability-matrix', year, activeDivision?.id],
    queryFn: async () => {
      const res = await base44.functions.invoke('getAvailabilityMatrix', { year, division_id: activeDivision?.id || '' });
      return res.data;
    },
  });

  const { staffStatus, rigStatus } = useMemo(() => buildStatusMaps(data), [data]);

  const q = search.trim().toLowerCase();
  const filteredStaff = useMemo(() => {
    if (!data?.staff) return [];
    if (!q) return data.staff;
    return data.staff.filter(s =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.job_title || '').toLowerCase().includes(q) ||
      (s.team_name || '').toLowerCase().includes(q)
    );
  }, [data, q]);

  const filteredRigs = useMemo(() => {
    if (!data?.rigs) return [];
    if (!q) return data.rigs;
    return data.rigs.filter(r =>
      (r.name || '').toLowerCase().includes(q) ||
      (r.make || '').toLowerCase().includes(q) ||
      (r.model || '').toLowerCase().includes(q)
    );
  }, [data, q]);

  const showStaff = resourceToggle === 'all' || resourceToggle === 'staff';
  const showRigs = resourceToggle === 'all' || resourceToggle === 'rigs';

  // Visible days based on view mode
  const visibleDays = useMemo(() => {
    if (viewMode === 'year') return getYearDays(year);
    if (viewMode === 'month') return getMonthDays(year, monthIdx);
    return getWeekDays(weekStart);
  }, [viewMode, year, monthIdx, weekStart]);

  // Analytics for the visible range
  const analytics = useMemo(() => {
    return computeRangeAnalytics(
      showStaff ? filteredStaff : [],
      showRigs ? filteredRigs : [],
      staffStatus, rigStatus, visibleDays
    );
  }, [filteredStaff, filteredRigs, staffStatus, rigStatus, visibleDays, showStaff, showRigs]);

  // Gap finder results
  const gapResults = useMemo(() => {
    if (!gapFrom || !gapTo) return [];
    return findAvailableResources(filteredStaff, filteredRigs, staffStatus, rigStatus, gapFrom, gapTo);
  }, [filteredStaff, filteredRigs, staffStatus, rigStatus, gapFrom, gapTo]);

  const handleJump = (e) => {
    e.preventDefault();
    if (!jumpDate) return;
    const d = new Date(jumpDate + 'T00:00:00');
    if (viewMode === 'year') {
      const grid = document.querySelector('.heatmap-grid-scroll');
      if (grid) {
        const idx = getYearDays(year).findIndex(dd => dd.dateStr === jumpDate);
        if (idx >= 0) grid.scrollLeft = idx * 7;
      }
    } else if (viewMode === 'month') {
      setMonthIdx(d.getMonth());
      setYear(d.getFullYear());
    } else {
      setWeekStart(startOfWeek(d, { weekStartsOn: 1 }));
    }
  };

  const handleExport = () => {
    navigate(`/reports?hub=availability&dateFrom=${year}-01-01&dateTo=${year}-12-31`);
  };

  const handlePrev = () => {
    if (viewMode === 'year') setYear(y => y - 1);
    else if (viewMode === 'month') {
      if (monthIdx === 0) { setYear(y => y - 1); setMonthIdx(11); }
      else setMonthIdx(m => m - 1);
    } else setWeekStart(w => addWeeks(w, -1));
  };
  const handleNext = () => {
    if (viewMode === 'year') setYear(y => y + 1);
    else if (viewMode === 'month') {
      if (monthIdx === 11) { setYear(y => y + 1); setMonthIdx(0); }
      else setMonthIdx(m => m + 1);
    } else setWeekStart(w => addWeeks(w, 1));
  };

  const dateLabel = useMemo(() => {
    if (viewMode === 'year') return String(year);
    if (viewMode === 'month') return format(new Date(year, monthIdx, 1), 'MMMM yyyy');
    return `Week of ${format(weekStart, 'dd MMM yyyy')}`;
  }, [viewMode, year, monthIdx, weekStart]);

  return (
    <div className="space-y-3">
      {/* Controls bar */}
      <div className="insight-card rounded-2xl p-3 flex flex-wrap items-center gap-2">
        {/* View mode toggle */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
          {[
            { id: 'year', label: 'Year', icon: Grid3x3 },
            { id: 'month', label: 'Month', icon: Calendar },
            { id: 'week', label: 'Week', icon: Users },
          ].map(opt => {
            const Icon = opt.icon;
            return (
              <button key={opt.id} onClick={() => setViewMode(opt.id)}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-bold transition ${viewMode === opt.id ? 'bg-[#2E5A1A] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}>
                <Icon className="w-3.5 h-3.5" /> {opt.label}
              </button>
            );
          })}
        </div>

        {/* Date navigation */}
        <div className="flex items-center gap-1 bg-white rounded-lg border border-slate-200 p-0.5">
          <button onClick={handlePrev} className="p-1.5 rounded-md hover:bg-slate-100 transition"><ChevronLeft className="w-4 h-4 text-slate-500" /></button>
          <span className="px-2 text-sm font-bold text-slate-800 tabular-nums min-w-[7rem] text-center">{dateLabel}</span>
          <button onClick={handleNext} className="p-1.5 rounded-md hover:bg-slate-100 transition"><ChevronRight className="w-4 h-4 text-slate-500" /></button>
        </div>

        {/* Jump to date */}
        <form onSubmit={handleJump} className="flex items-center gap-1">
          <input type="date" value={jumpDate} onChange={e => setJumpDate(e.target.value)}
            className="h-9 px-2 text-xs font-medium border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#2E5A1A] transition" />
          <button type="submit" className="h-9 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold transition">Jump</button>
        </form>

        {/* Search */}
        <div className="relative flex-1 min-w-[140px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search staff, rigs, teams…"
            className="w-full h-9 pl-9 pr-3 text-xs font-medium border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#2E5A1A] transition" />
        </div>

        {/* Resource toggle */}
        <div className="flex items-center gap-1 bg-white rounded-lg border border-slate-200 p-0.5">
          {[
            { id: 'all', label: 'All', icon: Grid3x3 },
            { id: 'staff', label: 'Staff', icon: Users },
            { id: 'rigs', label: 'Rigs', icon: Cog },
          ].map(opt => {
            const Icon = opt.icon;
            return (
              <button key={opt.id} onClick={() => setResourceToggle(opt.id)}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold transition ${resourceToggle === opt.id ? 'bg-[#2E5A1A] text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
                <Icon className="w-3.5 h-3.5" /> {opt.label}
              </button>
            );
          })}
        </div>

        {/* Gap finder toggle */}
        <button onClick={() => setShowGapFinder(v => !v)}
          className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-bold transition ${showGapFinder ? 'bg-violet-600 text-white' : 'bg-violet-50 text-violet-700 hover:bg-violet-100'}`}>
          <Zap className="w-3.5 h-3.5" /> Find Free
        </button>

        <button onClick={handleExport}
          className="inline-flex items-center gap-1.5 h-9 px-3 bg-[#2E5A1A] text-white rounded-lg text-xs font-bold hover:bg-[#1c4a12] transition shadow-sm flex-shrink-0">
          <Download className="w-3.5 h-3.5" /> Export
        </button>
      </div>

      {/* Analytics strip */}
      {!isLoading && (filteredStaff.length > 0 || filteredRigs.length > 0) && (
        <div className="insight-card rounded-2xl p-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="relative w-12 h-12">
              <svg width="48" height="48" viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="20" fill="none" stroke="#e2e8f0" strokeWidth="4" />
                <circle cx="24" cy="24" r="20" fill="none" stroke="#2E5A1A" strokeWidth="4" strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 20} strokeDashoffset={2 * Math.PI * 20 * (1 - analytics.utilPct / 100)}
                  transform="rotate(-90 24 24)" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-800">{analytics.utilPct}%</span>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wide">Utilization</p>
              <p className="text-xs text-slate-600">{viewMode === 'year' ? 'This year' : viewMode === 'month' ? 'This month' : 'This week'}</p>
            </div>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-emerald-500" />
            <span className="text-xs font-bold text-slate-700 tabular-nums">{analytics.jobCount}</span>
            <span className="text-xs text-slate-400">On Job</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-blue-400" />
            <span className="text-xs font-bold text-slate-700 tabular-nums">{analytics.leaveCount}</span>
            <span className="text-xs text-slate-400">Leave</span>
          </div>
          {analytics.maintenanceCount > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-violet-500" />
              <span className="text-xs font-bold text-slate-700 tabular-nums">{analytics.maintenanceCount}</span>
              <span className="text-xs text-slate-400">Maintenance</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-slate-200" />
            <span className="text-xs font-bold text-slate-700 tabular-nums">{analytics.availableCount}</span>
            <span className="text-xs text-slate-400">Available</span>
          </div>
          <div className="ml-auto text-[10px] text-slate-400">
            {showStaff ? filteredStaff.length : 0} staff · {showRigs ? filteredRigs.length : 0} rigs
          </div>
        </div>
      )}

      {/* Gap finder panel */}
      {showGapFinder && (
        <div className="insight-card rounded-2xl p-4 space-y-3 border-violet-200">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-violet-600" />
            <h3 className="text-sm font-bold text-slate-900">Who's Free When?</h3>
            <span className="text-xs text-slate-400">— find resources with no assignments across a date range</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-end">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">From</label>
              <input type="date" value={gapFrom} onChange={e => setGapFrom(e.target.value)}
                className="h-9 px-2 text-xs font-medium border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-violet-500 transition" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">To</label>
              <input type="date" value={gapTo} onChange={e => setGapTo(e.target.value)}
                className="h-9 px-2 text-xs font-medium border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-violet-500 transition" />
            </div>
          </div>
          {gapFrom && gapTo && (
            <div>
              {gapResults.length === 0 ? (
                <p className="text-xs text-slate-400 py-2">No resources are completely free across this range. Try widening the search or removing filters.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {gapResults.slice(0, 30).map(r => (
                    <div key={r.id} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-50 border border-violet-200 text-xs">
                      {r.type === 'rig' ? <Cog className="w-3 h-3 text-blue-600" /> : <Users className="w-3 h-3 text-[#2E5A1A]" />}
                      <span className="font-semibold text-slate-800">{r.name}</span>
                      {r.team_name && <span className="text-slate-400">· {r.team_name}</span>}
                      {r.job_title && <span className="text-slate-400">· {r.job_title}</span>}
                    </div>
                  ))}
                  {gapResults.length > 30 && <span className="text-xs text-slate-400 self-center">+{gapResults.length - 30} more</span>}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 px-1">
        {STATUS_ORDER.map(key => {
          const cfg = STATUS_CONFIG[key];
          return (
            <div key={key} className="flex items-center gap-1.5">
              <div className={`w-3.5 h-3.5 rounded ${cfg.bg}`} />
              <span className="text-xs font-medium text-slate-600">{cfg.label}</span>
            </div>
          );
        })}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="insight-card rounded-2xl p-12 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-[#2E5A1A] animate-spin" />
          <span className="ml-3 text-sm text-slate-500">Loading availability matrix…</span>
        </div>
      ) : (filteredStaff.length === 0 && filteredRigs.length === 0) ? (
        <div className="insight-card rounded-2xl p-12 text-center">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-500">No resources found</p>
          <p className="text-xs text-slate-400 mt-1">Try a different search or year.</p>
        </div>
      ) : viewMode === 'year' ? (
        <YearHeatmapGrid days={visibleDays} staffRows={showStaff ? filteredStaff : []} rigRows={showRigs ? filteredRigs : []}
          staffStatus={staffStatus} rigStatus={rigStatus} />
      ) : viewMode === 'month' ? (
        <MonthHeatmapGrid days={visibleDays} staffRows={showStaff ? filteredStaff : []} rigRows={showRigs ? filteredRigs : []}
          staffStatus={staffStatus} rigStatus={rigStatus} />
      ) : (
        <WeekListView days={visibleDays} staffRows={showStaff ? filteredStaff : []} rigRows={showRigs ? filteredRigs : []}
          staffStatus={staffStatus} rigStatus={rigStatus} />
      )}
    </div>
  );
}