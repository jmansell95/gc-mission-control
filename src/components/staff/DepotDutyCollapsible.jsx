import React, { useState } from 'react';
import { Warehouse, ChevronDown } from 'lucide-react';
import DepotAssignmentCard from '@/components/staff/DepotAssignmentCard';

/**
 * Staff-facing "also on depot duty" collapsible for the Today view. Expands
 * to the full DepotAssignmentCard so the crew can still start the depot
 * shift once the delivery is done. Shown beneath the delivery hero when
 * the delivery-in-front state is active.
 */
export default function DepotDutyCollapsible({ assignment, staff, onOpenShiftWizard, canPerformActions = true }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-2xl text-sm font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition"
      >
        <Warehouse className="w-4 h-4 flex-shrink-0" />
        <span className="truncate flex-1 text-left">Also on depot duty today</span>
        <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded && (
        <div className="mt-2">
          <DepotAssignmentCard
            assignment={assignment}
            staff={staff}
            onOpenShiftWizard={onOpenShiftWizard}
            canPerformActions={canPerformActions}
            defaultExpanded
          />
        </div>
      )}
    </div>
  );
}