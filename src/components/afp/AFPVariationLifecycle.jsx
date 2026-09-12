import React, { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { GitBranch, Calendar, CheckCircle2, Clock, AlertTriangle, Loader2, X } from 'lucide-react';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—';

/**
 * AFPVariationLifecycle — renders the four-stage cost-agreement lifecycle for
 * a single variation line item: Budget Cost Issue → Firm Cost Issue → Client
 * Assessment Issue → Cost Agreed. Shows the working-day period between each
 * consecutive pair and a coloured status dot per stage.
 *
 * The four dates are editable (billing team updates them as the VO progresses).
 * Working-day periods are computed client-side (excluding weekends; bank
 * holidays are approximated as the backend does the precise calc).
 */
export default function AFPVariationLifecycle({ item, canEdit, onAutoSave }) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const stages = useMemo(() => [
    { key: 'vo_date', label: 'VO Date', date: item.vo_date, icon: GitBranch, color: 'slate' },
    { key: 'budget_cost_issue_date', label: 'Budget Cost', date: item.budget_cost_issue_date, icon: Calendar, color: 'blue' },
    { key: 'firm_cost_issue_date', label: 'Firm Cost', date: item.firm_cost_issue_date, icon: Calendar, color: 'amber' },
    { key: 'client_assessment_issue_date', label: 'Client Assessment', date: item.client_assessment_issue_date, icon: Clock, color: 'violet' },
    { key: 'cost_agreed_date', label: 'Cost Agreed', date: item.cost_agreed_date, icon: CheckCircle2, color: 'emerald' },
  ], [item]);

  const workingDays = (start, end) => {
    if (!start || !end) return null;
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
  };

  const handleDateChange = async (field, value) => {
    setSaving(true);
    try {
      const updates = { [field]: value || '' };
      if (field === 'cost_agreed_date' && value) updates.dispute_status = 'agreed';
      if (onAutoSave) {
        onAutoSave(item.id, updates);
      } else {
        await base44.entities.AFPLineItem.update(item.id, updates);
        queryClient.invalidateQueries({ queryKey: ['afp-line-items'] });
      }
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const stageStatus = (idx) => {
    const stage = stages[idx];
    const hasDate = !!stage.date;
    const prevDate = idx > 0 ? stages[idx - 1].date : null;
    const isLast = idx === stages.length - 1;
    if (isLast && hasDate) return { color: 'emerald', label: 'Agreed', overdue: false };
    if (!hasDate) {
      // Check if previous stage is done but this one isn't → pending/overdue
      if (prevDate) {
        const days = workingDays(prevDate, new Date().toISOString().slice(0, 10));
        return { color: days > 10 ? 'rose' : 'amber', label: days > 10 ? 'Overdue' : 'Pending', overdue: days > 10 };
      }
      return { color: 'slate', label: 'Not started', overdue: false };
    }
    return { color: stage.color, label: 'Done', overdue: false };
  };

  const colorClasses = {
    slate: 'bg-slate-100 text-slate-600 border-slate-200',
    blue: 'bg-blue-100 text-blue-700 border-blue-200',
    amber: 'bg-amber-100 text-amber-700 border-amber-200',
    violet: 'bg-violet-100 text-violet-700 border-violet-200',
    emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    rose: 'bg-rose-100 text-rose-700 border-rose-200',
  };

  return (
    <div className="px-3 py-2.5 bg-slate-50/40 border-t border-slate-100">
      <div className="flex items-center gap-1 mb-2">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Cost-Agreement Lifecycle</span>
        {item.time_impact && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[9px] font-bold">
            <AlertTriangle className="w-2.5 h-2.5" /> Time Impact {item.time_impact_days > 0 ? `${item.time_impact_days}d` : ''}
          </span>
        )}
        {saving && <Loader2 className="w-3 h-3 text-slate-400 animate-spin ml-auto" />}
      </div>
      {/* Horizontal stepper */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
        {stages.map((stage, idx) => {
          const status = stageStatus(idx);
          const Icon = stage.icon;
          const prevDate = idx > 0 ? stages[idx - 1].date : null;
          const period = prevDate && stage.date ? workingDays(prevDate, stage.date) : null;
          return (
            <React.Fragment key={stage.key}>
              <div className="flex-shrink-0 flex flex-col items-center gap-1 min-w-[80px]">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 ${colorClasses[status.color]}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span className="text-[9px] font-semibold text-slate-600 text-center leading-tight">{stage.label}</span>
                {canEdit ? (
                  <input
                    type="date"
                    defaultValue={stage.date || ''}
                    onBlur={(e) => handleDateChange(stage.key, e.target.value)}
                    className="text-[9px] px-1 py-0.5 border border-slate-200 rounded bg-white focus:outline-none focus:border-primary w-[90px]"
                  />
                ) : (
                  <span className="text-[9px] text-slate-500 tabular-nums">{fmtDate(stage.date)}</span>
                )}
                <span className={`text-[8px] font-bold ${status.overdue ? 'text-rose-600' : 'text-slate-400'}`}>{status.label}</span>
              </div>
              {idx < stages.length - 1 && (
                <div className="flex-shrink-0 flex flex-col items-center px-0.5">
                  <div className={`h-0.5 w-6 ${stages[idx].date ? 'bg-slate-300' : 'bg-slate-200'}`} />
                  {period != null && (
                    <span className="text-[8px] text-slate-400 tabular-nums mt-0.5">{period}d</span>
                  )}
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}