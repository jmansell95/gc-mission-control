import React from 'react';
import {
  FlaskConical, AlertTriangle, XCircle, Search, Layers, User, Briefcase, CalendarDays,
  CheckCircle2, FileCheck2, Download,
} from 'lucide-react';

const REVIEW_FILTERS = [
  { key: 'all', label: 'All', cls: 'bg-slate-100 text-slate-600 hover:bg-slate-200' },
  { key: 'pending', label: 'Pending', cls: 'bg-amber-100 text-amber-700' },
  { key: 'queried', label: 'Queried', cls: 'bg-red-100 text-red-700' },
  { key: 'approved', label: 'Approved', cls: 'bg-emerald-100 text-emerald-700' },
];

const GROUP_OPTIONS = [
  { key: 'borehole', label: 'Borehole', icon: Layers },
  { key: 'staff', label: 'Staff', icon: User },
  { key: 'job', label: 'Job', icon: Briefcase },
  { key: 'date', label: 'Date', icon: CalendarDays },
];

/**
 * Sticky hub header — modern, informative, with live stat pills,
 * group-by control, search, review-status filters, and job/type filters.
 * Shared across desktop, tablet, and mobile (wraps on small screens).
 */
export default function InvestigationHeader({
  totalLogs, pendingCount, queriedCount,
  groupBy, setGroupBy,
  search, setSearch,
  reviewFilter, setReviewFilter,
  jobFilter, setJobFilter, jobs,
  typeFilter, setTypeFilter, logTypes,
}) {
  const approvedCount = totalLogs - pendingCount - queriedCount;
  const approvalRate = totalLogs > 0 ? Math.round((approvedCount / totalLogs) * 100) : 0;

  return (
    <div className="insight-card rounded-2xl mb-4 sticky top-0 z-30 shadow-md overflow-hidden">
      {/* Brand accent strip */}
      <div className="h-1 bg-gradient-to-r from-[#2E5A1A] via-[#5A8C1E] to-[#8DC63F]" />

      <div className="p-4 sm:p-5">
        {/* Title row */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="p-2.5 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] rounded-xl shadow-sm flex-shrink-0">
            <FlaskConical className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">Investigation Hub</h2>
            <p className="text-sm text-slate-500 hidden sm:block">Review every log & borehole record · approve, query, and export to OpenGround</p>
          </div>
        </div>

        {/* Live stat pills — informative at-a-glance */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-semibold tabular-nums inline-flex items-center gap-1">
            <FileCheck2 className="w-3.5 h-3.5" /> {totalLogs} logs
          </span>
          {pendingCount > 0 && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full font-semibold inline-flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> {pendingCount} pending
            </span>
          )}
          {queriedCount > 0 && (
            <span className="text-xs bg-red-100 text-red-700 px-2.5 py-1 rounded-full font-semibold inline-flex items-center gap-1">
              <XCircle className="w-3.5 h-3.5" /> {queriedCount} queried
            </span>
          )}
          {approvedCount > 0 && (
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-semibold inline-flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> {approvedCount} approved
            </span>
          )}
          {totalLogs > 0 && (
            <span className="text-xs bg-[#2E5A1A]/10 text-[#2E5A1A] px-2.5 py-1 rounded-full font-bold tabular-nums">
              {approvalRate}% approval rate
            </span>
          )}
        </div>

        {/* Group-by segmented control */}
        <div className="mt-3 flex items-center gap-1.5 bg-slate-100 rounded-xl p-1 w-full sm:w-auto sm:inline-flex">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide pl-2 pr-1 hidden sm:inline">Group by</span>
          {GROUP_OPTIONS.map(opt => {
            const Icon = opt.icon;
            const active = groupBy === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => setGroupBy(opt.key)}
                className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  active ? 'bg-white text-[#2E5A1A] shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" /> {opt.label}
              </button>
            );
          })}
        </div>

        {/* Filters row */}
        <div className="mt-3 flex flex-col sm:flex-row gap-2">
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
          <div className="grid grid-cols-2 sm:flex sm:gap-1.5 gap-1.5">
            <select
              value={jobFilter}
              onChange={e => setJobFilter(e.target.value)}
              className="text-xs px-2 py-2 rounded-lg border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-[#2E5A1A]/20"
            >
              <option value="all">All Jobs</option>
              {jobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
            </select>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="text-xs px-2 py-2 rounded-lg border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-[#2E5A1A]/20"
            >
              <option value="all">All Types</option>
              {Object.entries(logTypes).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}