import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, CheckCircle2, FileBarChart, RefreshCw, Upload } from 'lucide-react';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 2 });

/**
 * AFPHealthCheck — surfaces AFP data quality issues at a glance.
 *
 * Shows a compact banner on the Billing Insights tab:
 *  • AFPs with 0 line items (empty — need re-upload or re-population)
 *  • AFPs where stored total ≠ calculated line-item total (mismatch)
 *  • AFPs missing period dates or job linkage
 *
 * When everything is healthy, shows a reassuring green check banner.
 */
export default function AFPHealthCheck() {
  const { data: afps = [], isLoading } = useQuery({
    queryKey: ['afp-health-check'],
    queryFn: () => base44.entities.AFP.list('-created_date', 100),
  });

  const { data: allItems = [] } = useQuery({
    queryKey: ['afp-health-items'],
    queryFn: () => base44.entities.AFPLineItem.list(null, 500),
  });

  if (isLoading) {
    return (
      <div className="hub-glass rounded-2xl p-4 flex items-center gap-3">
        <RefreshCw className="w-5 h-5 text-slate-400 animate-spin" />
        <span className="text-sm text-slate-500">Checking AFP data health…</span>
      </div>
    );
  }

  const issues = [];
  for (const afp of afps) {
    const items = allItems.filter((li) => li.afp_id === afp.id);
    const calcTotal = items.reduce((s, li) => s + (Number(li.amount) || Number(li.applied_in_period) || 0), 0);
    const isUpload = !!afp.source_file_name;

    if (items.length === 0) {
      issues.push({
        afp,
        type: isUpload ? 'empty_upload' : 'empty_auto',
        label: isUpload ? 'Uploaded AFP has no line items — re-upload the Excel file' : 'Auto-populated AFP has no field data in this period',
      });
    } else if (Math.abs((afp.total_claimed || 0) - calcTotal) > 0.01) {
      issues.push({
        afp,
        type: 'mismatch',
        label: `Total mismatch: stored ${fmt(afp.total_claimed)} vs calculated ${fmt(calcTotal)}`,
      });
    }
    if (!afp.period_start_date || !afp.period_end_date) {
      issues.push({
        afp,
        type: 'missing_dates',
        label: 'Missing period dates',
      });
    }
  }

  // Healthy state
  if (issues.length === 0) {
    return (
      <div className="hub-glass rounded-2xl p-4 flex items-center gap-3 border-l-4 border-l-emerald-500">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900">All AFPs healthy</p>
          <p className="text-xs text-slate-500">
            {afps.length} AFPs · {allItems.length} line items · no data quality issues detected
          </p>
        </div>
      </div>
    );
  }

  // Issues found
  return (
    <div className="hub-glass rounded-2xl p-4 border-l-4 border-l-amber-500">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900">{issues.length} AFP data {issues.length === 1 ? 'issue' : 'issues'} found</p>
          <p className="text-xs text-slate-500">Review and resolve the items below</p>
        </div>
      </div>
      <div className="space-y-2">
        {issues.map((issue, i) => (
          <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-amber-50/60 border border-amber-100">
            <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center flex-shrink-0 mt-0.5">
              {issue.type === 'empty_upload' ? (
                <Upload className="w-3.5 h-3.5 text-amber-600" />
              ) : issue.type === 'mismatch' ? (
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              ) : (
                <FileBarChart className="w-3.5 h-3.5 text-slate-500" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-800 truncate">
                {issue.afp.job_name || 'Unnamed AFP'}
              </p>
              <p className="text-xs text-slate-500">{issue.label}</p>
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex-shrink-0 mt-1">
              AFP #{issue.afp.afp_number}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}