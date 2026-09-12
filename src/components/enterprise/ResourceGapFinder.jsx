import React, { useState, useMemo } from 'react';
import {
  Search, Calendar, Cog, CheckCircle2, AlertTriangle, X,
  ArrowRight, Layers, MapPin, Wrench,
} from 'lucide-react';
import { format, parseISO, addDays } from 'date-fns';
import { useResourceAvailability } from '@/hooks/useResourceAvailability';
import ResourceRequestModal from '@/components/enterprise/ResourceRequestModal';

const RIG_TYPES = [
  { value: 'all', label: 'All Types' },
  { value: 'cp', label: 'Cable Percussion' },
  { value: 'rotary', label: 'Rotary Core' },
  { value: 'window_sampling', label: 'Window Sampling' },
  { value: 'mixed', label: 'Mixed' },
];

const RIG_TYPE_BADGE = {
  cp: 'bg-blue-100 text-blue-700',
  rotary: 'bg-orange-100 text-orange-700',
  window_sampling: 'bg-purple-100 text-purple-700',
  mixed: 'bg-amber-100 text-amber-700',
};

export default function ResourceGapFinder({ divisionId = '', divMap = {}, onClose }) {
  const [fromDate, setFromDate] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
  const [toDate, setToDate] = useState(format(addDays(new Date(), 7), 'yyyy-MM-dd'));
  const [rigType, setRigType] = useState('all');
  const [searched, setSearched] = useState(false);
  const [requestModal, setRequestModal] = useState(null);

  // Fetch full month data for the gap scan
  const rangeStart = parseISO(fromDate);
  const rangeEnd = parseISO(toDate);
  const { rigs, findAvailableRigs, isLoading } = useResourceAvailability(rangeStart, rangeEnd, divisionId);

  const results = useMemo(() => {
    if (!searched) return [];
    return findAvailableRigs(fromDate, toDate, rigType);
  }, [searched, findAvailableRigs, fromDate, toDate, rigType]);

  const fullyAvailable = results.filter(r => r.fullyAvailable);
  const partialAvailable = results.filter(r => !r.fullyAvailable && r.conflictCount > 0);

  const handleSearch = () => setSearched(true);

  return (
    <div className="hub-glass rounded-2xl overflow-hidden animate-pop-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#2E5A1A] to-[#5A8C1E]">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-white" />
          <div>
            <h3 className="text-sm font-bold text-white">Resource Gap Finder</h3>
            <p className="text-[11px] text-white/80">Find available rigs for a date window</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/20 transition">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search controls */}
      <div className="px-4 py-3 border-b border-slate-100">
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Date range */}
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <input
              type="date"
              value={fromDate}
              onChange={e => { setFromDate(e.target.value); setSearched(false); }}
              className="h-9 px-2 text-xs font-medium border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#2E5A1A] transition"
            />
            <span className="text-slate-400 text-xs">→</span>
            <input
              type="date"
              value={toDate}
              onChange={e => { setToDate(e.target.value); setSearched(false); }}
              className="h-9 px-2 text-xs font-medium border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#2E5A1A] transition"
            />
          </div>

          {/* Rig type */}
          <select
            value={rigType}
            onChange={e => { setRigType(e.target.value); setSearched(false); }}
            className="h-9 px-2 text-xs font-medium border border-slate-200 rounded-lg bg-white text-slate-600 focus:outline-none focus:border-[#2E5A1A] transition"
          >
            {RIG_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>

          {/* Search button */}
          <button
            onClick={handleSearch}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 h-9 px-4 command-gradient text-white rounded-lg text-xs font-bold hover:shadow-lg transition flex-shrink-0 disabled:opacity-50"
          >
            <Search className="w-3.5 h-3.5" /> Find Rigs
          </button>
        </div>
      </div>

      {/* Results */}
      {searched && (
        <div className="max-h-[50vh] overflow-y-auto">
          {results.length === 0 ? (
            <div className="p-8 text-center">
              <Cog className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-500">No rigs match your criteria</p>
              <p className="text-xs text-slate-400 mt-1">Try a different rig type or date range.</p>
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {/* Fully available */}
              {fullyAvailable.length > 0 && (
                <>
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide px-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Fully Available ({fullyAvailable.length})
                  </p>
                  {fullyAvailable.map(({ rig, freeDays }) => (
                    <RigResultCard
                      key={rig.id}
                      rig={rig}
                      divMap={divMap}
                      freeDays={freeDays}
                      conflicts={[]}
                      fromDate={fromDate}
                      toDate={toDate}
                      onResource={() => setRequestModal({ rig, dateStr: fromDate, divisionId })}
                    />
                  ))}
                </>
              )}

              {/* Partially available */}
              {partialAvailable.length > 0 && (
                <>
                  <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wide px-1 pt-2 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Partially Available ({partialAvailable.length})
                  </p>
                  {partialAvailable.map(({ rig, freeDays, conflicts }) => (
                    <RigResultCard
                      key={rig.id}
                      rig={rig}
                      divMap={divMap}
                      freeDays={freeDays}
                      conflicts={conflicts}
                      fromDate={fromDate}
                      toDate={toDate}
                      onResource={() => setRequestModal({ rig, dateStr: fromDate, divisionId })}
                    />
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {!searched && (
        <div className="p-8 text-center">
          <Layers className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Set your date range and rig type, then click "Find Rigs"</p>
          <p className="text-xs text-slate-400 mt-1">We'll scan all rigs and show you exactly what's available.</p>
        </div>
      )}

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

function RigResultCard({ rig, divMap, freeDays, conflicts, fromDate, toDate, onResource }) {
  const div = divMap[rig.division_id];
  const divColor = div?.color || '#94a3b8';
  const typeBadge = RIG_TYPE_BADGE[rig.rig_type] || 'bg-slate-100 text-slate-500';
  const totalDays = Math.round((parseISO(toDate) - parseISO(fromDate)) / 86400000) + 1;

  return (
    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white border border-slate-200 hover:border-[#2E5A1A]/30 hover:shadow-sm transition group">
      <span className="w-1 h-10 rounded-full flex-shrink-0" style={{ background: divColor }} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-bold text-slate-900 truncate">{rig.name}</p>
          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${typeBadge} flex-shrink-0`}>
            {(rig.rig_type || '—').toUpperCase()}
          </span>
        </div>
        <p className="text-[11px] text-slate-500 truncate">
          {div?.name || 'Unassigned'}
          {rig.make && ` · ${rig.make}`}
        </p>
        {conflicts.length > 0 && (
          <div className="flex items-center gap-1 mt-1 text-[10px] text-amber-600">
            <AlertTriangle className="w-2.5 h-2.5" />
            {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''}: {conflicts.slice(0, 2).map(c => format(parseISO(c.date), 'dd MMM')).join(', ')}
            {conflicts.length > 2 && ` +${conflicts.length - 2}`}
          </div>
        )}
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-xs font-bold text-emerald-600">{freeDays}/{totalDays}</p>
        <p className="text-[9px] text-slate-400 uppercase">free days</p>
      </div>
      <button
        onClick={onResource}
        className="flex items-center gap-1 px-2.5 py-2 rounded-lg bg-slate-100 group-hover:command-gradient group-hover:text-white text-slate-700 text-xs font-bold transition flex-shrink-0"
      >
        Resource <ArrowRight className="w-3 h-3" />
      </button>
    </div>
  );
}