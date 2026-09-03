import React, { useState, useMemo } from 'react';
import { FlaskConical, Loader2, Layers } from 'lucide-react';
import BoreholeSampleDrawer from '@/components/geotech/BoreholeSampleDrawer';

/**
 * BoreholeCardGrid — groups samples by borehole_ref into compact dark cards.
 * Each card shows the borehole ref, sample count, a live progress bar
 * (results back vs pending), and a status summary. Clicking a card opens
 * the BoreholeSampleDrawer with the full sample list for that borehole.
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
        <Loader2 className="w-6 h-6 text-[#2EFF7D] animate-spin" />
      </div>
    );
  }

  if (boreholeGroups.length === 0) {
    return (
      <div className="bg-[#1C201C] border border-[#2a3a2a] rounded-xl p-10 text-center">
        <FlaskConical className="w-10 h-10 text-[#2a3a2a] mx-auto mb-3" />
        <p className="text-sm font-semibold text-[#A0A0A0]">No samples registered yet</p>
        <p className="text-xs text-[#5a6a5a] mt-1">Register samples collected on site to track them through the lab.</p>
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
          const pending = total - resultsBack;
          const progressPct = total > 0 ? Math.round((resultsBack / total) * 100) : 0;

          // Accent stripe colour by most urgent state
          const accentColor = needsCollection > 0 ? '#00D4FF' : inTransit > 0 ? '#FFC300' : resultsBack === total ? '#2EFF7D' : '#6366F1';

          return (
            <button
              key={ref}
              onClick={() => setSelectedBorehole(ref)}
              className="relative bg-[#1C201C] border border-[#2a3a2a] rounded-xl p-4 text-left hover:border-[#3a4a3a] hover:bg-[#1e241e] transition group overflow-hidden"
            >
              {/* Left accent stripe */}
              <div
                className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
                style={{ background: accentColor }}
              />

              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  {ref === 'Unassigned' ? (
                    <Layers className="w-4 h-4 text-[#5a6a5a] flex-shrink-0" />
                  ) : (
                    <FlaskConical className="w-4 h-4 text-[#2EFF7D] flex-shrink-0" />
                  )}
                  <span className="font-mono text-sm font-bold text-[#E0E0E0] truncate">{ref}</span>
                </div>
                <span className="text-xs font-semibold text-[#A0A0A0] flex-shrink-0">{total}</span>
              </div>

              {/* Status summary chips */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {needsCollection > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                    style={{ backgroundColor: '#00D4FF1a', color: '#00D4FF', border: '1px solid #00D4FF40' }}>
                    {needsCollection} need collection
                  </span>
                )}
                {inTransit > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                    style={{ backgroundColor: '#FFC3001a', color: '#FFC300', border: '1px solid #FFC30040' }}>
                    {inTransit} in transit
                  </span>
                )}
                {resultsBack > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                    style={{ backgroundColor: '#2EFF7D1a', color: '#2EFF7D', border: '1px solid #2EFF7D40' }}>
                    {resultsBack} results back
                  </span>
                )}
                {total - needsCollection - inTransit - resultsBack > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                    style={{ backgroundColor: '#6366F11a', color: '#6366F1', border: '1px solid #6366F140' }}>
                    {total - needsCollection - inTransit - resultsBack} other
                  </span>
                )}
              </div>

              {/* Live progress bar */}
              <div>
                <div className="flex items-center justify-between text-[10px] text-[#5a6a5a] mb-1">
                  <span>{resultsBack} back · {pending} pending</span>
                  <span className="font-mono font-semibold" style={{ color: accentColor }}>{progressPct}%</span>
                </div>
                <div className="h-1.5 bg-[#0B1A0B] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${progressPct}%`, background: accentColor }}
                  />
                </div>
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