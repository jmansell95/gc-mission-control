import React, { useState, useMemo } from 'react';
import { ChevronDown, CalendarDays, Clock, Activity as ActivityIcon } from 'lucide-react';
import SiteLogDayCard from './SiteLogDayCard';
import { detectActivityType } from '@/utils/siteLogUtils';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Monday of the week containing the given YYYY-MM-DD date string. */
function weekCommencing(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay(); // 0=Sun … 6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function fmtWeek(wc) {
  const d = new Date(wc + 'T00:00:00');
  const end = new Date(d); end.setDate(end.getDate() + 4);
  const opts = { day: 'numeric', month: 'short' };
  return `${d.toLocaleDateString('en-GB', opts)} – ${end.toLocaleDateString('en-GB', opts)}`;
}

function fmtDur(mins) {
  const m = Math.round(Number(mins) || 0);
  const h = Math.floor(m / 60), r = m % 60;
  if (h && r) return `${h}h ${r}m`;
  if (h) return `${h}h`;
  return m > 0 ? `${r}m` : '0m';
}

/**
 * SiteLogMonthGroup — 3-level drill-down: Month (collapsed) → Week commencing
 * (collapsed) → Day cards. Keeps the existing SiteLogDayCard intact inside
 * each week so dedup, raw/AI toggle, and inline edit continue to work.
 */
export default function SiteLogMonthGroup({ byDate, sortedDates, job, groupBy, selectedActivityId, onSelectActivity, selectMode, selectedIds, onToggleSelect, expandedMonths, setExpandedMonths, expandedWeeks, setExpandedWeeks, expandedDays, toggleDay, toggleAllMonths, toggleAllWeeksInMonth }) {
  // Group dates by month
  const byMonth = useMemo(() => {
    const map = {};
    sortedDates.forEach(date => {
      const monthKey = date.slice(0, 7); // YYYY-MM
      if (!map[monthKey]) map[monthKey] = [];
      map[monthKey].push(date);
    });
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0])); // newest month first
  }, [sortedDates]);

  // For each month, group its dates by week commencing
  const monthWeeks = useMemo(() => {
    const map = {};
    byMonth.forEach(([monthKey, dates]) => {
      const weeks = {};
      dates.forEach(date => {
        const wc = weekCommencing(date);
        if (!weeks[wc]) weeks[wc] = [];
        weeks[wc].push(date);
      });
      map[monthKey] = Object.entries(weeks).sort((a, b) => b[0].localeCompare(a[0]));
    });
    return map;
  }, [byMonth]);

  const allMonthsCollapsed = expandedMonths.size === 0;

  const toggleMonth = (monthKey) => {
    setExpandedMonths(prev => {
      const next = new Set(prev);
      if (next.has(monthKey)) { next.delete(monthKey); }
      else next.add(monthKey);
      return next;
    });
  };

  const toggleWeek = (wc) => {
    setExpandedWeeks(prev => {
      const next = new Set(prev);
      if (next.has(wc)) { next.delete(wc); }
      else next.add(wc);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {byMonth.map(([monthKey, dates]) => {
        const year = parseInt(monthKey.slice(0, 4), 10);
        const monthIdx = parseInt(monthKey.slice(5, 7), 10) - 1;
        const monthLabel = `${MONTH_NAMES[monthIdx]} ${year}`;
        const isMonthOpen = expandedMonths.has(monthKey);

        // Month-level stats
        const monthLogs = dates.flatMap(d => byDate[d] || []);
        const monthMinutes = monthLogs.reduce((s, l) => s + (l.duration_minutes || 0), 0);
        const monthPending = monthLogs.filter(l => (l.manager_review_status || 'pending') !== 'approved').length;

        const weeks = monthWeeks[monthKey] || [];

        return (
          <div key={monthKey} className="insight-card rounded-2xl overflow-hidden">
            {/* Month header */}
            <button
              onClick={() => toggleMonth(monthKey)}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50/60 transition group"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center flex-shrink-0 shadow-sm">
                <CalendarDays className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 text-left min-w-0">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">{monthLabel}</h3>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <ActivityIcon className="w-3 h-3" /> {monthLogs.length} {monthLogs.length === 1 ? 'activity' : 'activities'}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {fmtDur(monthMinutes)}
                  </span>
                  {monthPending > 0 && (
                    <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> {monthPending} pending
                    </span>
                  )}
                  <span className="text-slate-400">· {dates.length} {dates.length === 1 ? 'day' : 'days'}</span>
                </div>
              </div>
              <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${isMonthOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Weeks */}
            {isMonthOpen && (
              <div className="border-t border-slate-100 bg-slate-50/40 p-3 space-y-2.5 animate-slide-up">
                {weeks.map(([wc, weekDates]) => {
                  const isWeekOpen = expandedWeeks.has(wc);
                  const weekLogs = weekDates.flatMap(d => byDate[d] || []);
                  const weekMinutes = weekLogs.reduce((s, l) => s + (l.duration_minutes || 0), 0);
                  const weekPending = weekLogs.filter(l => (l.manager_review_status || 'pending') !== 'approved').length;

                  return (
                    <div key={wc} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                      {/* Week header */}
                      <button
                        onClick={() => toggleWeek(wc)}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-emerald-50/40 transition"
                      >
                        <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                          <CalendarDays className="w-3.5 h-3.5 text-emerald-700" />
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <p className="text-sm font-semibold text-slate-800">Week commencing {fmtWeek(wc)}</p>
                          <div className="flex items-center gap-2.5 mt-0.5 text-[11px] text-slate-500">
                            <span>{weekLogs.length} {weekLogs.length === 1 ? 'activity' : 'activities'}</span>
                            <span>· {fmtDur(weekMinutes)}</span>
                            {weekPending > 0 && <span className="text-amber-600 font-medium">· {weekPending} pending</span>}
                            <span>· {weekDates.length} {weekDates.length === 1 ? 'day' : 'days'}</span>
                          </div>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isWeekOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {/* Day cards */}
                      {isWeekOpen && (
                        <div className="border-t border-slate-100 p-2.5 space-y-2.5 animate-slide-up">
                          {weekDates.sort().reverse().map(date => (
                            <SiteLogDayCard
                              key={date}
                              date={date}
                              logs={byDate[date]}
                              job={job}
                              isExpanded={expandedDays.has(date)}
                              onToggle={toggleDay}
                              groupBy={groupBy}
                              selectedActivityId={selectedActivityId}
                              onSelectActivity={onSelectActivity}
                              selectMode={selectMode}
                              selectedIds={selectedIds}
                              onToggleSelect={onToggleSelect}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}