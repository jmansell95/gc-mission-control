import React, { useState, useRef, useEffect } from 'react';
import { Briefcase, ChevronDown, Search, MapPin, Calendar } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';

const statusStyles = {
  in_progress: { dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700', label: 'In Progress' },
  planning: { dot: 'bg-blue-500', badge: 'bg-blue-100 text-blue-700', label: 'Planning' },
  on_hold: { dot: 'bg-amber-500', badge: 'bg-amber-100 text-amber-700', label: 'On Hold' },
  completed: { dot: 'bg-slate-400', badge: 'bg-slate-100 text-slate-600', label: 'Completed' },
  decommissioning: { dot: 'bg-violet-500', badge: 'bg-violet-100 text-violet-700', label: 'Decommissioning' },
  cancelled: { dot: 'bg-rose-500', badge: 'bg-rose-100 text-rose-700', label: 'Cancelled' },
};

export default function JobSelectorBar({ onSelectJob }) {
  const { data: jobs = [] } = useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list() });
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50); }, [open]);

  const filtered = jobs.filter(j =>
    !search || j.name?.toLowerCase().includes(search.toLowerCase()) ||
    j.location?.toLowerCase().includes(search.toLowerCase()) ||
    j.job_reference?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (job) => {
    setOpen(false);
    setSearch('');
    onSelectJob?.(job);
  };

  return (
    <div className="mb-5">
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 transition text-left bg-white text-slate-600 border-slate-200 hover:border-[#2E5A1A]/40 hover:bg-[#2E5A1A]/5"
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#2E5A1A]/10">
            <Briefcase className="w-5 h-5 text-[#2E5A1A]" />
          </div>
          <div className="text-left flex-1 min-w-0">
            <p className="text-ui-body font-bold leading-tight">Find a Job</p>
            <p className="text-ui-micro leading-tight text-slate-400">Click to search and jump straight to a job</p>
          </div>
          <ChevronDown className={`w-4 h-4 flex-shrink-0 transition text-slate-400 ${open ? 'rotate-180' : ''}`} />
        </button>

        {/* Searchable dropdown */}
        {open && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden">
            <div className="p-2.5 border-b border-slate-100">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  ref={inputRef}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name, location or reference…"
                  className="w-full pl-9 pr-3 py-2 text-ui-body bg-slate-50 rounded-lg border border-slate-200 focus:outline-none focus:border-[#2E5A1A] focus:bg-white"
                />
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="text-center text-ui-body text-slate-400 py-6">No jobs match "{search}"</p>
              ) : filtered.map(j => {
                const st = statusStyles[j.status] || statusStyles.planning;
                return (
                  <button
                    key={j.id}
                    onClick={() => handleSelect(j)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#2E5A1A]/5 transition text-left border-b border-slate-50 last:border-0"
                  >
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${st.dot}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-ui-body font-semibold text-slate-800 truncate">{j.name}</p>
                      <div className="flex items-center gap-2 text-ui-micro text-slate-400">
                        {j.location && <span className="flex items-center gap-0.5 truncate"><MapPin className="w-3 h-3" />{j.location}</span>}
                        {j.start_date && <span className="flex items-center gap-0.5 flex-shrink-0"><Calendar className="w-3 h-3" />{format(new Date(j.start_date), 'dd MMM')}</span>}
                      </div>
                    </div>
                    <span className={`text-ui-micro px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${st.badge}`}>{st.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}