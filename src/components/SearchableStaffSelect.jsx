import React, { useState } from 'react';
import { Search, X, Check } from 'lucide-react';

/**
 * SearchableStaffSelect — a search-input + filtered list picker for selecting
 * a staff member. Replaces the plain <select> dropdown in forms where the
 * staff list is long and hard to scroll.
 *
 * Props:
 *   staff       — array of staff objects (each with at least {id, name})
 *   value       — currently selected staff id
 *   onChange     — callback(id) when a staff member is selected/cleared
 *   placeholder  — input placeholder text
 */
export default function SearchableStaffSelect({ staff = [], value, onChange, placeholder = 'Search staff…' }) {
  const [search, setSearch] = useState('');

  const filtered = staff.filter(s =>
    !search || (s.name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {/* Search input */}
      <div className="flex items-center gap-2 w-full px-3 py-2 border border-slate-300 rounded-lg focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-600/10 transition bg-white">
        <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={placeholder}
          className="flex-1 text-sm focus:outline-none bg-transparent text-slate-700 placeholder:text-slate-400"
        />
        {search && (
          <button type="button" onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filtered list */}
      <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-50 bg-white">
        {filtered.length === 0 ? (
          <p className="px-3 py-3 text-xs text-slate-400 text-center">No staff found</p>
        ) : (
          filtered.map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => onChange(s.id)}
              className={`w-full text-left px-3 py-2.5 transition flex items-center gap-2.5 text-sm ${
                value === s.id ? 'bg-emerald-50' : 'hover:bg-slate-50'
              }`}
            >
              <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <span className="text-emerald-700 font-bold text-[11px]">{(s.name || '?').charAt(0)}</span>
              </div>
              <span className="text-slate-700 truncate flex-1 font-medium">{s.name}</span>
              {value === s.id && <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
            </button>
          ))
        )}
      </div>
    </div>
  );
}