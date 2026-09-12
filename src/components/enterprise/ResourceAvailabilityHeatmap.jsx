import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import {
  Cog, ChevronLeft, ChevronRight, Search, MapPin, Wrench,
  Truck, Calendar, CheckCircle2, AlertTriangle, Clock, ArrowRight,
  Layers, X, Plus,
} from 'lucide-react';
import { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isSameDay } from 'date-fns';
import { useResourceAvailability } from '@/hooks/useResourceAvailability';
import ResourceRequestModal from '@/components/enterprise/ResourceRequestModal';

const RIG_TYPE_META = {
  cp: { label: 'CP', full: 'Cable Percussion', color: 'bg-blue-100 text-blue-700' },
  rotary: { label: 'Rotary', full: 'Rotary Core', color: 'bg-orange-100 text-orange-700' },
  window_sampling: { label: 'WS', full: 'Window Sampling', color: 'bg-purple-100 text-purple-700' },
  mixed: { label: 'Mixed', full: 'Mixed Methods', color: 'bg-amber-100 text-amber-700' },
};

const STATUS_COLORS = {
  job: { bg: 'bg-emerald-500', bgLight: 'bg-emerald-50', text: 'text-emerald-700', hex: '#10b981', label: 'On Site' },
  maintenance: { bg: 'bg-violet-500', bgLight: 'bg-violet-50', text: 'text-violet-700', hex: '#8b5cf6', label: 'Maintenance' },
  upcoming: { bg: 'bg-amber-500', bgLight: 'bg-amber-50', text: 'text-amber-700', hex: '#f59e0b', label: 'Booked' },
  transit: { bg: 'bg-blue-500', bgLight: 'bg-blue-50', text: 'text-blue-700', hex: '#3b82f6', label: 'In Transit' },
  available: { bg: 'bg-slate-100', bgLight: 'bg-slate-50', text: 'text-slate-400', hex: '#e2e8f0', label: 'Available' },
};

export default function ResourceAvailabilityHeatmap({ divisionId = '', onFindGap }) {
  const [viewMode, setViewMode] = useState('week'); // 'week' | 'month'
  const [currentDate, setCurrentDate] = useState(new Date());
  const [search, setSearch] = useState('');
  const [selectedCell, setSelectedCell] = useState(null);
  const [requestModal, setRequestModal] = useState(null);

  const rangeStart = useMemo(() => {
    if (viewMode === 'week') return startOfWeek(currentDate, { weekStartsOn: 1 });
    return startOfMonth(currentDate);
  }, [currentDate, viewMode]);

  const rangeEnd = useMemo(() => {
    if (viewMode === 'week') return endOfWeek(currentDate, { weekStartsOn: 1 });
    return endOfMonth(currentDate);
  }, [currentDate, viewMode]);

  const { rigs, days, dayStrs, getRigStatus, stats, isLoading } = useResourceAvailability(rangeStart, rangeEnd, divisionId);

  // Fetch divisions for color coding
  const { data: divisions = [] } = useQuery({ queryKey: ['divisions'], queryFn: () => base44.entities.Division.list() });
  const divMap = useMemo(() => Object.fromEntries(divisions.map(d => [d.id, d])), [divisions]);

  // Filter rigs by search
  const filteredRigs = useMemo(() => {
    if (!search) return rigs;
    const q = search.toLowerCase();
    return rigs.filter(r =>
      (r.name || '').toLowerCase().includes(q) ||
      (r.make || '').toLowerCase().includes(q) ||
      (r.model || '').toLowerCase().includes(q) ||
      (r.rig_type || '').toLowerCase().includes(q)
    );
  }, [rigs, search]);

  const navLabel = viewMode === 'week'
    ? `${format(rangeStart, 'dd MMM')} — ${format(rangeEnd, 'dd MMM')}`
    : format(currentDate, 'MMMM yyyy');

  const handleCellClick = (rig, dateStr) => {
    const status = getRigStatus(rig.id, dateStr);
    setSelectedCell({ rig, dateStr, status });
  };

  const handleResourceSlot = (rig, dateStr) => {
    setSelectedCell(null);
    setRequestModal({ rig, dateStr, divisionId });
  };

  return (
    <div className="space-y-3">
      {/* ── Controls Bar ── */}
      <div className="hub-glass rounded-2xl p-3 sm:p-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-2.5">
          {/* View toggle */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 flex-shrink-0">
            {['week', 'month'].map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition capitalize ${viewMode === mode ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Date navigation */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button onClick={() => setCurrentDate(d => addDays(d, viewMode === 'week' ? -7 : -30))} className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition">
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </button>
            <span className="text-xs font-bold text-slate-700 px-2 whitespace-nowrap tabular-nums min-w-[140px] text-center">{navLabel}</span>
            <button onClick={() => setCurrentDate(d => addDays(d, viewMode === 'week' ? 7 : 30))} className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition">
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>
            <button onClick={() => setCurrentDate(new Date())} className="px-2.5 py-2 rounded-lg bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition">
              Today
            </button>
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search rigs, make, model…"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Find Gap button */}
          <button
            onClick={onFindGap}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg command-gradient text-white text-xs font-bold hover:shadow-lg transition flex-shrink-0"
          >
            <Layers className="w-3.5 h-3.5" /> Find Gap
          </button>
        </div>

        {/* Stats bar */}
        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-100">
          <StatPill icon={Cog} label="Total Rigs" value={stats.total} color="text-slate-700 bg-slate-100" />
          <StatPill icon={MapPin} label="On Site" value={stats.onSite} color="text-emerald-700 bg-emerald-50" />
          <StatPill icon={CheckCircle2} label="Available" value={stats.available} color="text-blue-700 bg-blue-50" />
          <StatPill icon={Wrench} label="Maintenance" value={stats.maintenance} color="text-violet-700 bg-violet-50" />
        </div>
      </div>

      {/* ── Heatmap Grid ── */}
      {isLoading ? (
        <div className="hub-glass rounded-2xl p-12 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-[#2E5A1A] rounded-full animate-spin" />
          <span className="ml-3 text-sm text-slate-500">Loading rig availability…</span>
        </div>
      ) : filteredRigs.length === 0 ? (
        <div className="hub-glass rounded-2xl p-12 text-center">
          <Cog className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-500">No rigs found</p>
          <p className="text-xs text-slate-400 mt-1">Try a different search or division filter.</p>
        </div>
      ) : (
        <div className="hub-glass rounded-2xl overflow-hidden">
          {/* Day headers */}
          <div className="flex bg-slate-50 border-b border-slate-200">
            <div className="flex-shrink-0 sticky left-0 bg-slate-50 border-r border-slate-200 z-10 px-3 py-2 min-w-[180px] sm:min-w-[220px]">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Rig</span>
            </div>
            <div className="flex overflow-x-auto no-scrollbar">
              {days.map(d => (
                <div
                  key={d.dateStr}
                  className={`flex flex-col items-center justify-center min-w-[44px] sm:min-w-[52px] py-1.5 border-r border-slate-100 ${d.isToday ? 'bg-primary/10' : ''} ${d.isWeekend ? 'bg-slate-100/50' : ''}`}
                >
                  <span className={`text-[9px] font-bold uppercase ${d.isToday ? 'text-primary' : 'text-slate-400'}`}>{d.dayName}</span>
                  <span className={`text-[11px] font-bold tabular-nums ${d.isToday ? 'text-primary' : 'text-slate-600'}`}>{d.dayNum}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Rig rows */}
          <div className="max-h-[60vh] overflow-y-auto">
            {filteredRigs.map((rig, rigIdx) => {
              const div = divMap[rig.division_id];
              const divColor = div?.color || '#94a3b8';
              const rigTypeMeta = RIG_TYPE_META[rig.rig_type] || { label: '—', full: 'Unknown', color: 'bg-slate-100 text-slate-500' };
              return (
                <div key={rig.id} className={`flex border-b border-slate-50 hover:bg-slate-50/40 transition ${rigIdx % 2 === 1 ? 'bg-slate-50/20' : ''}`}>
                  {/* Rig name cell */}
                  <div className="flex-shrink-0 sticky left-0 bg-white border-r border-slate-200 z-10 px-3 py-2 min-w-[180px] sm:min-w-[220px] flex items-center gap-2">
                    <span className="w-1 h-8 rounded-full flex-shrink-0" style={{ background: divColor }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-800 truncate">{rig.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${rigTypeMeta.color}`}>{rigTypeMeta.label}</span>
                        {rig.make && <span className="text-[9px] text-slate-400 truncate">{rig.make}</span>}
                      </div>
                    </div>
                  </div>
                  {/* Day cells */}
                  <div className="flex overflow-x-auto no-scrollbar">
                    {days.map(d => {
                      const status = getRigStatus(rig.id, d.dateStr);
                      const cfg = status ? STATUS_COLORS[status.type] || STATUS_COLORS.available : STATUS_COLORS.available;
                      const isAvailable = !status;
                      const isToday = d.isToday;
                      return (
                        <button
                          key={d.dateStr}
                          onClick={() => handleCellClick(rig, d.dateStr)}
                          className={`relative min-w-[44px] sm:min-w-[52px] h-14 flex flex-col items-center justify-center border-r border-slate-100 transition group ${cfg.bg} ${isToday ? 'ring-1 ring-primary ring-inset' : ''} ${d.isWeekend ? 'opacity-70' : ''} hover:brightness-110`}
                          title={`${rig.name} · ${d.dateStr} · ${cfg.label}${status?.job_name ? ` · ${status.job_name}` : ''}`}
                        >
                          {isAvailable ? (
                            <>
                              {/* Pulsing gap indicator */}
                              <span className="absolute inset-1 rounded-lg border-2 border-dashed border-slate-300 group-hover:border-primary transition" />
                              <Plus className="w-3 h-3 text-slate-300 group-hover:text-primary transition" />
                            </>
                          ) : (
                            <>
                              <span className="text-[8px] font-bold text-white truncate px-1 max-w-full">
                                {status.type === 'job' ? 'JOB' : cfg.label.slice(0, 4).toUpperCase()}
                              </span>
                              {status.job_name && (
                                <span className="text-[7px] text-white/80 truncate px-1 max-w-full hidden sm:block">{status.job_name}</span>
                              )}
                            </>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Legend ── */}
      <div className="hub-glass rounded-2xl p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-3">
          {Object.entries(STATUS_COLORS).map(([key, cfg]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span className={`w-3.5 h-3.5 rounded ${cfg.bg}`} />
              <span className="text-xs font-medium text-slate-600">{cfg.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="w-3.5 h-3.5 rounded border-2 border-dashed border-slate-300" />
            <span className="text-xs font-medium text-slate-600">Gap (tap to resource)</span>
          </div>
        </div>
      </div>

      {/* ── Cell Popover ── */}
      <AnimatePresence>
        {selectedCell && (
          <CellPopover
            cell={selectedCell}
            divMap={divMap}
            onClose={() => setSelectedCell(null)}
            onResource={() => handleResourceSlot(selectedCell.rig, selectedCell.dateStr)}
          />
        )}
      </AnimatePresence>

      {/* ── Resource Request Modal ── */}
      {requestModal && (
        <ResourceRequestModal
          rig={requestModal.rig}
          dateStr={requestModal.dateStr}
          divisionId={requestModal.divisionId}
          divMap={divMap}
          onClose={() => setRequestModal(null)}
        />
      )}
    </div>
  );
}

function StatPill({ icon: Icon, label, value, color }) {
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${color}`}>
      <Icon className="w-3 h-3" />
      {label} · {value}
    </div>
  );
}

function CellPopover({ cell, divMap, onClose, onResource }) {
  const { rig, dateStr, status } = cell;
  const cfg = status ? STATUS_COLORS[status.type] || STATUS_COLORS.available : STATUS_COLORS.available;
  const div = divMap[rig.division_id];
  const rigTypeMeta = RIG_TYPE_META[rig.rig_type] || { full: 'Unknown' };

  return (
    <>
      <div className="fixed inset-0 z-50" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -10 }}
        transition={{ duration: 0.15 }}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90vw] max-w-md hub-glass rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className={`relative ${cfg.bg} px-4 py-3`}>
          <button onClick={onClose} className="absolute top-2 right-2 p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/20 transition">
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <Cog className="w-5 h-5 text-white" />
            <div>
              <p className="text-sm font-bold text-white">{rig.name}</p>
              <p className="text-xs text-white/80">{format(new Date(dateStr + 'T00:00:00'), 'EEEE, dd MMM yyyy')}</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          {/* Status */}
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${cfg.bgLight} ${cfg.text}`}>{cfg.label}</span>
            {status?.job_name && (
              <span className="text-xs text-slate-600 font-medium truncate">{status.job_name}</span>
            )}
          </div>

          {/* Rig details */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-bold">Type</p>
              <p className="text-slate-700 font-medium">{rigTypeMeta.full}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-bold">Division</p>
              <p className="text-slate-700 font-medium">{div?.name || 'Unassigned'}</p>
            </div>
            {rig.make && (
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-bold">Make / Model</p>
                <p className="text-slate-700 font-medium">{rig.make} {rig.model}</p>
              </div>
            )}
          </div>

          {/* Action */}
          {!status && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
              <p className="text-xs text-emerald-700 font-bold mb-1 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> This rig is available
              </p>
              <p className="text-[11px] text-emerald-600">Resource this slot for a new opportunity or job.</p>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            {!status && (
              <button
                onClick={onResource}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl command-gradient text-white text-xs font-bold hover:shadow-lg transition"
              >
                <Plus className="w-3.5 h-3.5" /> Resource This Slot
              </button>
            )}
            <button
              onClick={onClose}
              className="px-3 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200 transition"
            >
              Close
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}