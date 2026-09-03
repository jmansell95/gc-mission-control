import React, { useState, useMemo } from 'react';
import { FlaskConical, Loader2, Layers, ChevronRight, User } from 'lucide-react';
import BoreholeSampleDrawer from '@/components/geotech/BoreholeSampleDrawer';

/**
 * BoreholeCardGrid — groups samples by borehole_ref into compact light cards
 * matching the Borehole Data Explorer cards. Each card shows the borehole ref,
 * sample count, and a status summary. Clicking a card opens the
 * BoreholeSampleDrawer with the full sample list for that borehole.
 */
export default function BoreholeCardGrid({
  samples,
  allStaff,
  suppliers,
  job,
  scheduledSampleIds,
  sampleDeliveryStatus,
  onAdvanceStatus,
  onRegister,
  onDelete,
  onScheduleCollection,
  isLoading,
}) {
  const [selectedBorehole, setSelectedBorehole] = useState(null);

  // Group samples by borehole_ref (blank → 'Unassigned')
  const boreholeGroups = useMemo(() => {
    const map = new Map();
    samples.forEach(s => {
      const ref = s.borehole_ref || 'Unassigned';
      if (!map.has(ref)) map.set(ref, []);
      map.get(ref).push(s);
    });
    // Sort: real borehole refs first (alpha), Unassigned last
    const entries = [...map.entries()];
    entries.sort((a, b) => {
      if (a[0] === 'Unassigned') return 1;
      if (b[0] === 'Unassigned') return -1;
      return a[0].localeCompare(b[0], undefined, { numeric: true });
    });
    return entries;
  }, [samples]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
      </div>
    );
  }

  if (boreholeGroups.length === 0) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-10 text-center">
        <FlaskConical className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-sm font-semibold text-slate-700">No samples registered yet</p>
        <p className="text-xs text-slate-400 mt-1">Register samples collected on site to track them through the lab.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {boreholeGroups.map(([ref, bhSamples]) => {
          const total = bhSamples.length;
          const resultsBack = bhSamples.filter(s => s.status === 'results_returned').length;
          const inTransit = bhSamples.filter(s => ['dispatched', 'received_at_lab', 'testing'].includes(s.status)).length;
          const needsCollection = bhSamples.filter(s => s.status === 'collected' && !scheduledSampleIds.has(s.sample_id)).length;
          const other = total - needsCollection - inTransit - resultsBack;

          // Distinct drillers for this borehole — from collected_by_crew_names
          // (full crew array) or collected_by_name (single fallback).
          const drillerSet = new Set();
          bhSamples.forEach(s => {
            if (Array.isArray(s.collected_by_crew_names)) {
              s.collected_by_crew_names.forEach(n => { if (n) drillerSet.add(n); });
            } else if (s.collected_by_name) {
              drillerSet.add(s.collected_by_name);
            }
          });
          const drillers = [...drillerSet];

          return (
            <button
              key={ref}
              onClick={() => setSelectedBorehole(ref)}
              className="group relative bg-white rounded-xl border border-slate-200 p-4 text-left hover:border-emerald-400 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
            >
              <div className="flex items-center gap-2 mb-3">
                {ref === 'Unassigned' ? (
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <Layers className="w-4 h-4 text-slate-500" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-100 transition">
                    <FlaskConical className="w-4 h-4 text-emerald-700" />
                  </div>
                )}
                <span className="font-mono text-sm font-bold text-slate-900 truncate">{ref}</span>
                <span className="ml-auto text-xs font-semibold text-slate-500 flex-shrink-0">{total}</span>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition flex-shrink-0" />
              </div>

              {/* Driller attribution — distinct crew who collected samples */}
              {drillers.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {drillers.slice(0, 3).map((name, i) => (
                    <span key={i} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-medium border border-emerald-100">
                      <User className="w-2 h-2" />{name}
                    </span>
                  ))}
                  {drillers.length > 3 && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-slate-50 text-slate-500 text-[10px] font-medium border border-slate-200">
                      +{drillers.length - 3}
                    </span>
                  )}
                </div>
              )}

              {/* Status summary chips — light brand palette */}
              <div className="flex flex-wrap gap-1.5">
                {needsCollection > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-cyan-50 text-cyan-700 border border-cyan-200">
                    {needsCollection} need collection
                  </span>
                )}
                {inTransit > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                    {inTransit} in transit
                  </span>
                )}
                {resultsBack > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {resultsBack} results back
                  </span>
                )}
                {other > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                    {other} other
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {selectedBorehole && (
        <BoreholeSampleDrawer
          boreholeRef={selectedBorehole}
          samples={samples.filter(s => (s.borehole_ref || 'Unassigned') === selectedBorehole)}
          allStaff={allStaff}
          suppliers={suppliers}
          job={job}
          scheduledSampleIds={scheduledSampleIds}
          sampleDeliveryStatus={sampleDeliveryStatus}
          onAdvanceStatus={onAdvanceStatus}
          onRegister={onRegister}
          onDelete={onDelete}
          onScheduleCollection={onScheduleCollection}
          onClose={() => setSelectedBorehole(null)}
        />
      )}
    </>
  );
}