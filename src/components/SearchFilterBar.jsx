import React from 'react';
import { Search, X } from 'lucide-react';

/**
 * Shared search + filter bar for list/manager pages.
 *
 * Props:
 *  - searchValue / onSearchChange / searchPlaceholder: text search (omit to hide)
 *  - filters: [{ value, onChange, options: [{value,label}] }]
 *  - right: optional node rendered at the end (e.g. result count)
 */
export default function SearchFilterBar({ searchValue, onSearchChange, searchPlaceholder = 'Search...', filters = [], right = null, showCount = false, totalCount = 0 }) {
  const hasSearch = onSearchChange !== undefined;
  const activeFilters = (searchValue ? 1 : 0) + filters.filter(f => f.value && f.value !== 'all').length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 mb-6">
      <div className="flex flex-col sm:flex-row gap-2.5">
        {hasSearch && (
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-9 pr-9 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 text-ui-body bg-white"
            />
            {searchValue && (
              <button onClick={() => onSearchChange('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
        {filters.map((f, i) => (
          <select
            key={i}
            value={f.value}
            onChange={(e) => f.onChange(e.target.value)}
            className="px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 text-ui-body bg-white min-w-0 sm:min-w-[150px] flex-shrink-0"
          >
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        ))}
        {right && <div className="flex items-center gap-2 flex-shrink-0">{right}</div>}
      </div>
      {showCount && (
        <div className="mt-2.5 flex items-center justify-between text-ui-caption text-slate-500">
          <span>
            Showing <span className="font-semibold text-slate-700">{totalCount}</span> result{totalCount === 1 ? '' : 's'}
            {activeFilters > 0 && (
              <button onClick={() => { if (onSearchChange) onSearchChange(''); filters.forEach(f => f.onChange('all')); }} className="ml-2 text-emerald-700 hover:text-emerald-900 font-medium underline-offset-2 hover:underline">
                Clear filters
              </button>
            )}
          </span>
        </div>
      )}
    </div>
  );
}