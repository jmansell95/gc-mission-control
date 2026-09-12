import React, { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, PoundSterling } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { groupUnmatchedByType } from '@/utils/logBillingStatus';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 });

const LOG_TYPE_LABELS = {
  spt: 'SPT Tests',
  sample_collection: 'Samples',
  borehole_progress: 'Borehole Progress (depthless)',
  core_inspection: 'Core Inspection',
  pit_excavation: 'Trial Pits',
  installation: 'Installations',
  grouting_works: 'Grouting',
  standpipe_reading: 'Standpipe Readings',
  geophysical_probing: 'Geophysical Probing',
  window_sampling: 'Window Sampling',
  other: 'Driller Remarks / Dayworks',
  site_setup: 'Site Setup',
  reinstatement: 'Reinstatement',
  borehole_decommissioning: 'Decommissioning',
};

/**
 * UnmatchedRevenueWarning — banner shown on the Job Financials tab when
 * calculateJobFinancials reports unmatched logs that should be billable
 * but couldn't be matched to a rate card item. Shows the count, an
 * estimated missed-revenue figure, and an expandable breakdown by log_type.
 */
export default function UnmatchedRevenueWarning({ job }) {
  const [expanded, setExpanded] = useState(false);

  const { data: financials } = useQuery({
    queryKey: ['job-financials-unmatched', job?.id],
    queryFn: async () => {
      const res = await base44.functions.invoke('calculateJobFinancials', { job_id: job.id });
      return res.data;
    },
    enabled: !!job?.id,
    staleTime: 60000,
  });

  if (!financials) return null;

  const unmatchedCount = financials.summary?.unmatched_count || 0;
  const matchedCount = financials.summary?.matched_count || 0;
  if (unmatchedCount === 0) return null;

  // Estimate missed revenue: average matched rate × unmatched count
  const sorRevenue = financials.summary?.sor_revenue || 0;
  const avgRate = matchedCount > 0 ? sorRevenue / matchedCount : 0;
  const estimatedMissed = Math.round(avgRate * unmatchedCount);

  const grouped = groupUnmatchedByType(financials.unmatched_entries);

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-amber-100/50 transition"
      >
        <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-amber-900">
            {unmatchedCount.toLocaleString()} logs unmatched — est. {fmt(estimatedMissed)} missed revenue
          </p>
          <p className="text-xs text-amber-700 mt-0.5">
            These activities couldn't be matched to a rate card item and are generating £0.
            Click to review by category.
          </p>
        </div>
        {expanded ? <ChevronDown className="w-5 h-5 text-amber-600 flex-shrink-0" /> : <ChevronRight className="w-5 h-5 text-amber-600 flex-shrink-0" />}
      </button>

      {expanded && (
        <div className="border-t border-amber-200 p-3 space-y-2 bg-amber-50/50">
          {Object.entries(grouped).map(([type, info]) => (
            <div key={type} className="bg-white/70 rounded-xl p-3 border border-amber-100">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold text-amber-900">
                  {LOG_TYPE_LABELS[type] || type}
                </p>
                <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                  {info.count} {info.count === 1 ? 'log' : 'logs'}
                </span>
              </div>
              <div className="space-y-0.5">
                {info.samples.map((desc, i) => (
                  <p key={i} className="text-xs text-slate-500 truncate">• {desc}</p>
                ))}
                {info.count > info.samples.length && (
                  <p className="text-xs text-slate-400 italic">+ {info.count - info.samples.length} more…</p>
                )}
              </div>
            </div>
          ))}
          <div className="flex items-center gap-2 pt-1 px-1">
            <PoundSterling className="w-3.5 h-3.5 text-amber-600" />
            <p className="text-xs text-amber-700">
              Fix: add matching items to the Master Price List (Settings → Rate Cards) or
              run the AGS backfill to reclassify SPTs and rewrite sample descriptions.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}