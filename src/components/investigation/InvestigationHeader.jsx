import React, { useState } from 'react';
import {
  Search, Filter, X, Mountain, Loader2, CircleDashed, CheckCircle2,
} from 'lucide-react';

const REVIEW_FILTERS = [
  { key: 'all', label: 'All', cls: 'bg-slate-100 text-slate-600 hover:bg-slate-200' },
  { key: 'pending', label: 'Pending', cls: 'bg-amber-100 text-amber-700' },
  { key: 'queried', label: 'Queried', cls: 'bg-red-100 text-red-700' },
  { key: 'approved', label: 'Approved', cls: 'bg-emerald-100 text-emerald-700' },
];

const BOREHOLE_STATUS_FILTERS = [
  { key: 'all', label: 'All Holes', icon: Mountain, cls: 'bg-slate-100 text-slate-600 hover:bg-slate-200' },
  { key: 'in_progress', label: 'In Progress', icon: Loader2, cls: 'bg-amber-100 text-amber-700' },
  { key: 'unchecked', label: 'Unchecked', icon: CircleDashed, cls: 'bg-slate-100 text-slate-600' },
  { key: 'complete', label: 'Completed', icon: CheckCircle2, cls: 'bg-emerald-100 text-emerald-700' },
];

/**
 * Simplified filter header — search + review-status pills are always visible;
 * advanced filters (type, borehole status, driller, date range) are hidden
 * behind a "Filters" toggle so the bar stays clean. The group-by control
 * and duplicate title/stats are removed (drilldown hierarchy replaces
 * group-by; HubShell owns the title and stats).
 */
export default function InvestigationHeader({
  search, setSearch,
  reviewFilter, setReviewFilter,
  typeFilter, setTypeFilter, logTypes,
  boreholeStatusFilter, setBoreholeStatusFilter,
  drillerFilter, setDrillerFilter, drillerOptions,
  dateFrom, setDateFrom, dateTo, setDateTo,
}) {
  const [showFilters, setShowFilters] = useState(false);
  const hasActiveFilters = typeFilter !== 'all' || boreholeStatusFilter !== 'all' || drillerFilter !== 'all' || dateFrom || dateTo;

  return (
    <div className="hub-glass rounded-2xl mb-4 sticky top-0 z-30 shadow-md overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-[#2E5A1A] via-[#5A8C1E] to-[#8DC63F]" />
      <div className="p-3 sm:p-4">
        {/* Primary row: search + review pills + filters toggle */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search borehole, sample, staff, description..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#2E5A1A]/20 focus:border-[#2E5A1A]/30 outline-none transition"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {REVIEW_FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setReviewFilter(f.key)}
                className={`text-xs px-2.5 py-2 rounded-lg font-medium transition ${
                  reviewFilter === f.key ? 'bg-[#2E5A1A] text-white shadow-sm' : (f.cls || 'bg-slate-100 text-slate-600 hover:bg-slate-200')
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowFilters(f => !f)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition flex-shrink-0 ${showFilters || hasActiveFilters ? 'bg-[#2E5A1A]/10 text-[#2E5A1A] border border-[#2E5A1A]/20' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent'}`}
          >
            <Filter className="w-3.5 h-3.5" /> Filters
            {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-[#2E5A1A]" />}
          </button>
        </div>

        {/* Advanced filters (collapsible) */}
        {showFilters && (
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-2.5">
            {/* Borehole status pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide inline-flex items-center gap-1">
                <Mountain className="w-3.5 h-3.5" /> Status
              </span>
              {BOREHOLE_STATUS_FILTERS.map(f => {
                const Icon = f.icon;
                const active = boreholeStatusFilter === f.key;
                return (
                  <button
                    key={f.key}
                    onClick={() => setBoreholeStatusFilter(f.key)}
                    className={`inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-medium transition ${
                      active ? 'bg-[#2E5A1A] text-white shadow-sm' : (f.cls || 'bg-slate-100 text-slate-600 hover:bg-slate-200')
                    }`}
                  >
                    <Icon className="w-3 h-3" /> {f.label}
                  </button>
                );
              })}
            </div>

            {/* Type + driller + date range */}
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                className="text-xs px-2.5 py-2 rounded-lg border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-[#2E5A1A]/20 flex-1 sm:flex-none"
              >
                <option value="all">All Types</option>
                {Object.entries(logTypes).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <select
                value={drillerFilter}
                onChange={e => setDrillerFilter(e.target.value)}
                className="text-xs px-2.5 py-2 rounded-lg border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-[#2E5A1A]/20 flex-1 sm:flex-none"
              >
                <option value="all">All Drillers</option>
                {drillerOptions.map(dr => <option key={dr} value={dr}>{dr}</option>)}
              </select>
              <div className="flex items-center gap-1.5 flex-1 sm:flex-none">
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  className="text-xs px-2.5 py-2 rounded-lg border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-[#2E5A1A]/20 w-full sm:w-auto" />
                <span className="text-slate-300 text-xs">→</span>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  className="text-xs px-2.5 py-2 rounded-lg border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-[#2E5A1A]/20 w-full sm:w-auto" />
              </div>
              {hasActiveFilters && (
                <button
                  onClick={() => { setTypeFilter('all'); setBoreholeStatusFilter('all'); setDrillerFilter('all'); setDateFrom(''); setDateTo(''); }}
                  className="text-xs px-2.5 py-2 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 font-medium inline-flex items-center gap-1 transition flex-shrink-0"
                >
                  <X className="w-3 h-3" /> Clear
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}