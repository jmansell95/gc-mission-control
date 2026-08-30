import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, ChevronLeft, ChevronRight, Search, Filter, X } from 'lucide-react';
import { format, addDays, startOfWeek } from 'date-fns';
import EnterpriseHubShell from '@/components/enterprise/EnterpriseHubShell';
import { useCrewAvailability, HEATMAP_LEGEND } from '@/hooks/useCrewAvailability';

export default function EnterpriseCrewAvailabilityPage() {
  const navigate = useNavigate();
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [search, setSearch] = useState('');
  const [divFilter, setDivFilter] = useState('all');
  const { staff, divisions, divMap, days, dayStrs, getCellStatus, stats, isLoading } = useCrewAvailability(weekStart);

  const filtered = useMemo(() => {
    return staff.filter(s => {
      if (divFilter !== 'all' && s.division_id !== divFilter) return false;
      if (search && !(s.name || '').toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [staff, divFilter, search]);

  return (
    <EnterpriseHubShell
      title="Crew Availability"
      subtitle={`${stats.total} crew members across all business streams`}
      icon={Users}
      accent="#8b5cf6"
    >
      {/* Sticky controls */}
      <div className="insight-card rounded-2xl p-3 sm:p-4 sticky top-2 z-20">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          {/* Week nav */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition">
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </button>
            <span className="text-xs font-bold text-slate-700 px-1 whitespace-nowrap tabular-nums">
              {format(weekStart, 'dd MMM')} — {format(addDays(weekStart, 6), 'dd MMM')}
            </span>
            <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition">
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search crew…"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-300"
            />
          </div>
        </div>

        {/* Division filter pills */}
        <div className="flex gap-1.5 mt-3 overflow-x-auto no-scrollbar pb-0.5">
          <FilterPill active={divFilter === 'all'} onClick={() => setDivFilter('all')} label="All" color="#94a3b8" />
          {divisions.map(d => (
            <FilterPill
              key={d.id}
              active={divFilter === d.id}
              onClick={() => setDivFilter(d.id)}
              label={d.name}
              color={d.color || '#2E5A1A'}
            />
          ))}
        </div>

        {/* Stats bar */}
        <div className="flex flex-wrap gap-2 mt-3 text-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> On Job · {stats.onJobCount}
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 ring-1 ring-slate-200">
            <span className="w-2 h-2 rounded-full bg-slate-300" /> Free · {stats.freeCount}
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 ring-1 ring-blue-200">
            <span className="w-2 h-2 rounded-full bg-blue-500" /> Leave · {stats.leaveCount}
          </div>
        </div>
      </div>

      {/* Crew cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="insight-card rounded-2xl p-8 text-center">
          <p className="text-sm text-slate-400">No crew members match your filters.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(s => (
            <CrewCard
              key={s.id}
              staff={s}
              divMap={divMap}
              days={days}
              dayStrs={dayStrs}
              getCellStatus={getCellStatus}
            />
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="insight-card rounded-2xl p-3 sm:p-4">
        <div className="flex flex-wrap gap-3">
          {HEATMAP_LEGEND.map(l => (
            <div key={l.label} className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="w-3 h-3 rounded" style={{ background: l.color }} />
              {l.label}
            </div>
          ))}
        </div>
      </div>
    </EnterpriseHubShell>
  );
}

function FilterPill({ active, onClick, label, color }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${
        active ? 'command-gradient text-white glow-brand' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
      {label}
    </button>
  );
}

function CrewCard({ staff, divMap, days, dayStrs, getCellStatus }) {
  const [expanded, setExpanded] = useState(false);
  const div = divMap[staff.division_id];
  const divColor = div?.color || '#94a3b8';
  const divName = div?.name || 'Unassigned';

  // Count statuses for this crew member this week
  const weekSummary = useMemo(() => {
    let jobs = 0, free = 0, leave = 0;
    for (const d of dayStrs) {
      const st = getCellStatus(staff.id, d).status;
      if (st === 'job') jobs++;
      else if (st === 'free') free++;
      else if (st === 'leave') leave++;
    }
    return { jobs, free, leave };
  }, [staff.id, dayStrs, getCellStatus]);

  return (
    <div className="insight-card rounded-2xl overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-3 p-3 sm:p-4">
        <span className="w-2.5 h-12 rounded-full flex-shrink-0" style={{ background: divColor }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm sm:text-base font-bold text-slate-900 truncate">{staff.name}</p>
          <p className="text-xs text-slate-500 truncate flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: divColor }} />
            {divName}
            {staff.job_title && <span className="text-slate-400">· {staff.job_title}</span>}
          </p>
        </div>
        {/* Week mini-summary */}
        <div className="flex items-center gap-2 flex-shrink-0 text-xs">
          <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold">
            {weekSummary.jobs}<span className="hidden sm:inline"> jobs</span>
          </span>
          <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 text-slate-500 font-bold">
            {weekSummary.free}<span className="hidden sm:inline"> free</span>
          </span>
        </div>
      </div>

      {/* 7-day strip */}
      <div className="px-3 sm:px-4 pb-3 sm:pb-4">
        <div className="grid grid-cols-7 gap-1.5">
          {dayStrs.map((dStr, i) => {
            const cell = getCellStatus(staff.id, dStr);
            return (
              <div key={dStr} className="flex flex-col items-center gap-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">{format(days[i], 'EEE')}</span>
                <span className="text-[10px] text-slate-400 tabular-nums">{format(days[i], 'dd')}</span>
                <div
                  className="w-full aspect-square min-h-[36px] rounded-lg flex items-center justify-center text-[10px] font-extrabold transition"
                  style={{
                    background: cell.color || '#f1f5f9',
                    color: cell.color ? 'white' : '#cbd5e1',
                  }}
                  title={`${staff.name} — ${cell.status}`}
                >
                  {cell.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}