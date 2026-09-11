import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useDivision } from '@/contexts/DivisionContext';
import AvailabilityHeatmap from './AvailabilityHeatmap';
import ResourceGapFinder from '@/components/enterprise/ResourceGapFinder';

/**
 * ResourcePlanner — the unified resource planning tab for the Scheduling Hub.
 *
 * Merges the old Availability Heatmap (all divisions: year/month/week crew +
 * rig availability) with the geotech Resources tab (rig allocation + gap
 * finder) into a single interactive tab.
 *
 * - All divisions: full year/month/week availability heatmap with staff + rigs,
 *   inline gap finder, search, export (powered by AvailabilityHeatmap).
 * - Geotech only: a "Find Rigs" button that opens the Resource Gap Finder modal
 *   (relocated from the old Scheduling Hub header).
 */
export default function ResourcePlanner() {
  const { activeDivision } = useDivision();
  const [showGapFinder, setShowGapFinder] = useState(false);
  const isGeotech = (activeDivision?.name || '').toLowerCase().includes('geotech');

  const { data: divisions = [] } = useQuery({ queryKey: ['divisions'], queryFn: () => base44.entities.Division.list() });
  const divMap = useMemo(() => Object.fromEntries(divisions.map(d => [d.id, d])), [divisions]);

  return (
    <div className="space-y-3">
      {/* Geotech-only Find Rigs button — relocated from the Scheduling Hub header */}
      {isGeotech && (
        <div className="flex justify-end">
          <button onClick={() => setShowGapFinder(true)} type="button"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-violet-600 text-white text-ui-caption font-semibold hover:bg-violet-700 active:scale-[0.97] transition shadow-sm">
            <Search className="w-4 h-4" />
            <span>Find Rigs</span>
          </button>
        </div>
      )}

      <AvailabilityHeatmap />

      {showGapFinder && isGeotech && (
        <div className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-3xl my-auto">
            <ResourceGapFinder
              divisionId={activeDivision?.id || ''}
              divMap={divMap}
              onClose={() => setShowGapFinder(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}