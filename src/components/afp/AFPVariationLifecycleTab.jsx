import React, { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  GitBranch, AlertTriangle, CheckCircle2, Clock, Loader2,
  TrendingUp, FileText,
} from 'lucide-react';
import useAutoSave from '@/hooks/useAutoSave';
import AFPVariationLifecycle from './AFPVariationLifecycle';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

/**
 * AFPVariationLifecycleTab — job-level view of all AFP variation line items
 * with their 4-stage cost-agreement lifecycle. Replaces the old BOQ overrun
 * review queue. Each variation shows the AFPVariationLifecycle stepper with
 * inline editable dates (wired to auto-save).
 */
export default function AFPVariationLifecycleTab({ job }) {
  const queryClient = useQueryClient();

  const { saveStatus, scheduleSave } = useAutoSave(
    base44.entities.AFPLineItem,
    queryClient,
    ['afp-variations', job.id]
  );

  const { data: afps = [] } = useQuery({
    queryKey: ['afp', job.id],
    queryFn: () => base44.entities.AFP.filter({ job_id: job.id }, 'afp_number', 50),
  });

  const { data: variations = [], isLoading } = useQuery({
    queryKey: ['afp-variations', job.id],
    queryFn: () => base44.entities.AFPLineItem.filter({ job_id: job.id, sheet_name: 'variations' }, 'vo_date', 500),
  });

  const afpStatusById = useMemo(() => {
    const map = {};
    for (const a of afps) map[a.id] = a.status;
    return map;
  }, [afps]);

  // Summary metrics
  const summary = useMemo(() => {
    let totalValue = 0, agreed = 0, pending = 0, overdue = 0, timeImpact = 0;
    const today = new Date().toISOString().slice(0, 10);
    for (const v of variations) {
      totalValue += Number(v.amount) || 0;
      if (v.time_impact) timeImpact++;
      if (v.cost_agreed_date) { agreed++; continue; }
      // Determine the last completed stage date
      const stages = [
        v.vo_date, v.budget_cost_issue_date, v.firm_cost_issue_date,
        v.client_assessment_issue_date, v.cost_agreed_date,
      ];
      let lastDate = null;
      for (const s of stages) { if (s) lastDate = s; }
      if (lastDate) {
        const days = workingDays(lastDate, today);
        if (days > 10) overdue++;
        else pending++;
      } else {
        pending++;
      }
    }
    return { totalValue, agreed, pending, overdue, timeImpact, total: variations.length };
  }, [variations]);

  if (isLoading) {
    return <div className="hub-glass rounded-2xl p-8 flex items-center justify-center"><Loader2 className="w-6 h-6 text-slate-400 animate-spin" /></div>;
  }

  if (variations.length === 0) {
    return (
      <div className="hub-glass rounded-2xl p-6 sm:p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
          <GitBranch className="w-8 h-8 text-slate-300" />
        </div>
        <p className="text-base font-bold text-slate-700">No Variations yet</p>
        <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
          Variation line items appear here once they're added to an AFP. Each variation
          tracks its 4-stage cost-agreement lifecycle: Budget Cost → Firm Cost → Client
          Assessment → Cost Agreed.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary header */}
      <div className="hub-glass rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 rounded-lg stat-gradient-violet flex items-center justify-center">
            <GitBranch className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">Variation Lifecycle</p>
            <p className="text-[11px] text-slate-400">{summary.total} variation{summary.total !== 1 ? 's' : ''} across {afps.length} AFP{afps.length !== 1 ? 's' : ''}</p>
          </div>
          {saveStatus !== 'idle' && (
            <span className={`ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
              saveStatus === 'saving' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
            }`}>
              {saveStatus === 'saving' ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
              {saveStatus === 'saving' ? 'Saving…' : 'Saved'}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <SummaryTile label="Total Value" value={fmt(summary.totalValue)} icon={TrendingUp} gradient="stat-gradient-brand" />
          <SummaryTile label="Agreed" value={summary.agreed} icon={CheckCircle2} gradient="stat-gradient-emerald" />
          <SummaryTile label="Pending" value={summary.pending} icon={Clock} gradient="stat-gradient-amber" />
          <SummaryTile label="Overdue" value={summary.overdue} icon={AlertTriangle} gradient="stat-gradient-rose" />
        </div>
        {summary.timeImpact > 0 && (
          <div className="mt-2.5 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-xs font-semibold text-amber-700">
              {summary.timeImpact} variation{summary.timeImpact !== 1 ? 's' : ''} with programme time impact
            </span>
          </div>
        )}
      </div>

      {/* Variation cards */}
      <div className="space-y-2.5">
        {variations.map((v) => {
          const afpStatus = afpStatusById[v.afp_id];
          const canEdit = afpStatus === 'draft' || afpStatus === 'pending_review' || afpStatus === 'submitted';
          const afpNum = afps.find(a => a.id === v.afp_id)?.afp_number;
          return (
            <div key={v.id} className="hub-glass rounded-2xl overflow-hidden">
              {/* Header row */}
              <div className="px-4 py-2.5 flex items-center justify-between gap-2 border-b border-slate-100">
                <div className="flex items-center gap-2 min-w-0">
                  {v.vo_ref && (
                    <span className="px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded text-[10px] font-mono font-bold flex-shrink-0">
                      {v.vo_ref}
                    </span>
                  )}
                  {afpNum && (
                    <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold flex-shrink-0">
                      AFP {afpNum}
                    </span>
                  )}
                  <span className="text-xs font-medium text-slate-700 truncate">{v.item}</span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {v.vo_date && <span className="text-[10px] text-slate-400">{fmtDate(v.vo_date)}</span>}
                  <span className="text-sm font-bold text-slate-800 tabular-nums">{fmt(v.amount)}</span>
                </div>
              </div>
              {/* Lifecycle stepper */}
              <AFPVariationLifecycle item={v} canEdit={canEdit} onAutoSave={scheduleSave} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SummaryTile({ label, value, icon: Icon, gradient }) {
  return (
    <div className="bg-slate-50 rounded-xl p-2.5 flex items-center gap-2.5">
      <div className={`w-8 h-8 rounded-lg ${gradient} flex items-center justify-center flex-shrink-0`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <p className="text-base font-bold text-slate-800 tabular-nums leading-tight">{value}</p>
      </div>
    </div>
  );
}

/** Working-day count between two ISO dates (excluding weekends). */
function workingDays(start, end) {
  if (!start || !end) return 0;
  const s = new Date(start + 'T00:00:00'), e = new Date(end + 'T00:00:00');
  if (e < s) return 0;
  let count = 0;
  const cur = new Date(s);
  cur.setDate(cur.getDate() + 1);
  while (cur <= e) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}