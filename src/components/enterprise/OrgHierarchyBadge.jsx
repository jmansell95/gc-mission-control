import React, { useMemo } from 'react';
import { Building2, ChevronRight, Layers } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * OrgHierarchyBadge — a reusable two-line breadcrumb pill showing the
 * Business Unit → Business Stream hierarchy.
 *
 * Variants:
 *  - 'card' (default): two-line badge for card headers (BU small/grey above Stream bold/coloured)
 *  - 'inline': single-line breadcrumb for page headers and table rows
 *  - 'compact': just the stream name with a coloured dot (for tight spaces)
 *
 * Props:
 *  - divisionId: the stream division ID to look up
 *  - variant: 'card' | 'inline' | 'compact'
 *  - size: 'sm' | 'md' | 'lg'
 */
export default function OrgHierarchyBadge({ divisionId, variant = 'card', size = 'sm' }) {
  const { data: divisions = [] } = useQuery({
    queryKey: ['divisions-for-hierarchy-badge'],
    queryFn: () => base44.entities.Division.list('-sort_order', 500),
    staleTime: 5 * 60 * 1000,
  });

  const { bu, stream } = useMemo(() => {
    const stream = divisions.find(d => d.id === divisionId);
    const bu = stream?.parent_division_id
      ? divisions.find(d => d.id === stream.parent_division_id)
      : null;
    return { bu, stream };
  }, [divisions, divisionId]);

  if (!stream) {
    return variant === 'compact' ? (
      <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
        <span className="w-2 h-2 rounded-full bg-slate-300" />
        <span>No stream</span>
      </span>
    ) : null;
  }

  const streamColor = stream.color || '#2E5A1A';

  // Compact: just stream name + dot
  if (variant === 'compact') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: streamColor }}>
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: streamColor }} />
        <span className="truncate">{stream.name}</span>
      </span>
    );
  }

  // Inline: single-line breadcrumb
  if (variant === 'inline') {
    return (
      <span className="inline-flex items-center gap-1 text-xs">
        {bu && (
          <>
            <span className="text-slate-400 font-medium truncate">{bu.name}</span>
            <ChevronRight className="w-3 h-3 text-slate-300 flex-shrink-0" />
          </>
        )}
        <span className="font-bold truncate" style={{ color: streamColor }}>{stream.name}</span>
      </span>
    );
  }

  // Card (default): two-line badge — BU small/grey above Stream bold/coloured
  const sizeCls = size === 'lg' ? 'p-3' : size === 'md' ? 'p-2.5' : 'p-2';

  return (
    <div className={`inline-flex flex-col gap-0.5 rounded-lg bg-slate-50 border border-slate-100 ${sizeCls}`}>
      {bu && (
        <div className="flex items-center gap-1">
          <Building2 className="w-3 h-3 text-slate-400 flex-shrink-0" />
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide truncate">{bu.name}</span>
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: streamColor }} />
        <span className="text-xs font-bold truncate" style={{ color: streamColor }}>{stream.name}</span>
      </div>
    </div>
  );
}