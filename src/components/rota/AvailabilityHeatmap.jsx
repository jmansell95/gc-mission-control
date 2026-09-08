import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Calendar, Search, ChevronLeft, ChevronRight, Download, Loader2, Grid3x3, Users, Cog } from 'lucide-react';
import { useDivision } from '@/contexts/DivisionContext';
import { STATUS_CONFIG, STATUS_ORDER, buildStatusMaps, getYearDays } from './heatmapUtils';
import HeatmapGrid from './HeatmapGrid';

export default function AvailabilityHeatmap() {
  const navigate = useNavigate();
  const { activeDivision } = useDivision();
  const [year, setYear] = useState(new Date().getFullYear());
  const [search, setSearch] = useState('');
  const [resourceToggle, setResourceToggle] = useState('all');
  const [jumpDate, setJumpDate] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['availability-matrix', year, activeDivision?.id],
    queryFn: async () => {
      const res = await base44.functions.invoke('getAvailabilityMatrix', { year, division_id: activeDivision?.id || '' });
      return res.data;
    },
  });

  const days = useMemo(() => getYearDays(year), [year]);
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

  const handleJump = (e) => {
    e.preventDefault();
    if (!jumpDate) return;
    const idx = days.findIndex(d => d.dateStr === jumpDate);
    if (idx >= 0) {
      const grid = document.querySelector('.heatmap-grid-scroll');
      if (grid) grid.scrollLeft = idx * 7;
    }
  };

  const handleExport = () => {
    navigate(`/reports?hub=availability&dateFrom=${year}-01-01&dateTo=${year}-12-31`);
  };

  return (
    <div className="space-y-3">
      {/* Controls bar */}
      <div className="insight-card rounded-2xl p-3 flex flex-wrap items-center gap-2">
        {/* Year picker */}
        <div className="flex items-center gap-1 bg-white rounded-lg border border-slate-200 p-0.5">
          <button onClick={() => setYear(y => y - 1)} className="p-1.5 rounded-md hover:bg-slate-100 transition"><ChevronLeft className="w-4 h-4 text-slate-500" /></button>
          <span className="px-2 text-sm font-bold text-slate-800 tabular-nums min-w-[3rem] text-center">{year}</span>
          <button onClick={() => setYear(y => y + 1)} className="p-1.5 rounded-md hover:bg-slate-100 transition"><ChevronRight className="w-4 h-4 text-slate-500" /></button>
        </div>

        {/* Jump to date */}
        <form onSubmit={handleJump} className="flex items-center gap-1">
          <input
            type="date"
            value={jumpDate}
            onChange={e => setJumpDate(e.target.value)}
            className="h-9 px-2 text-xs font-medium border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#2E5A1A] transition"
          />
          <button type="submit" className="h-9 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold transition">Jump</button>
        </form>

        {/* Search */}
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search staff, rigs, teams…"
            className="w-full h-9 pl-9 pr-3 text-xs font-medium border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#2E5A1A] transition"
          />
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
              <button
                key={opt.id}
                onClick={() => setResourceToggle(opt.id)}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold transition ${resourceToggle === opt.id ? 'bg-[#2E5A1A] text-white' : 'text-slate-500 hover:bg-slate-100'}`}
              >
                <Icon className="w-3.5 h-3.5" /> {opt.label}
              </button>
            );
          })}
        </div>

        {/* Export Report */}
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-1.5 h-9 px-3 bg-[#2E5A1A] text-white rounded-lg text-xs font-bold hover:bg-[#1c4a12] transition shadow-sm flex-shrink-0"
        >
          <Download className="w-3.5 h-3.5" /> Export Report
        </button>
      </div>

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
      ) : (
        <div className="heatmap-grid-scroll">
          <HeatmapGrid
            days={days}
            staffRows={filteredStaff}
            rigRows={filteredRigs}
            staffStatus={staffStatus}
            rigStatus={rigStatus}
            showStaff={showStaff}
            showRigs={showRigs}
          />
        </div>
      )}
    </div>
  );
}