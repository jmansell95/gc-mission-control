import React from 'react';
import { Search } from 'lucide-react';

const STATUSES = [
  { value: 'all', label: 'All' },
  { value: 'planning', label: 'Planning' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'decommissioning', label: 'Decommissioning' },
  { value: 'completed', label: 'Completed' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'cancelled', label: 'Cancelled' },
];

/** Status chips + search box for the Projects Hub. */
export default function JobStatusFilterBar({ jobs, statusFilter, onStatusChange, searchQuery, onSearchChange }) {
  const countFor = (v) => v === 'all' ? jobs.length : jobs.filter(j => (j.status || 'planning') === v).length;
  return (
    <div className="hub-glass rounded-3xl p-3 sm:p-4 space-y-3 animate-slide-up">
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 sm:flex-wrap sm:overflow-visible">
        {STATUSES.map(btn => {
          const active = statusFilter === btn.value;
          return (
            <button
              key={btn.value}
              type="button"
              onClick={() => onStatusChange(btn.value)}
              className={`flex-shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition active:scale-[0.97] ${
                active ? 'bg-[#2E5A1A] text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:border-[#2E5A1A]/30 hover:text-slate-900'
              }`}
            >
              {btn.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${active ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>{countFor(btn.value)}</span>
            </button>
          );
        })}
      </div>
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Search projects by name, location or reference…"
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/10"
        />
      </div>
    </div>
  );
}