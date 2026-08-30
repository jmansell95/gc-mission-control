import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Bot, CheckCircle2, AlertTriangle, Clock, Zap } from 'lucide-react';
import { format } from 'date-fns';

/**
 * AutoTimesheetStatus — shows the staff member's auto-built timesheet status
 * on their profile. Read-only — they can flag an error but never edit fields.
 *
 * Shows:
 *   - Today's auto-built status (auto_submitted / submitted / draft / missing)
 *   - Confidence score with source badges
 *   - "Flag error" button if the auto-built timesheet is wrong
 */
export default function AutoTimesheetStatus({ staffId }) {
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: todaySummary, isLoading } = useQuery({
    queryKey: ['auto-timesheet-status', staffId, today],
    queryFn: () => base44.entities.Timesheet.filter({
      staff_id: staffId,
      date: today,
      is_summary: true,
    }, '-created_date', 1),
    enabled: !!staffId,
  });

  const summary = todaySummary?.[0];

  if (isLoading) return null;
  if (!summary) return null;

  const score = summary.confidence_score || 0;
  const sources = (summary.auto_built_sources || '').split(',').filter(Boolean);
  const isAuto = summary.auto_built;
  const status = summary.status;

  const statusConfig = {
    auto_submitted: { label: 'Auto-submitted', color: 'emerald', icon: Zap },
    submitted: { label: 'Awaiting review', color: 'amber', icon: Clock },
    approved: { label: 'Approved', color: 'emerald', icon: CheckCircle2 },
    draft: { label: 'Needs your input', color: 'rose', icon: AlertTriangle },
    rejected: { label: 'Rejected', color: 'rose', icon: AlertTriangle },
  };

  const cfg = statusConfig[status] || statusConfig.submitted;
  const StatusIcon = cfg.icon;

  const onSiteHours = Math.round((summary.on_site_minutes / 60) * 10) / 10 || 0;
  const travelHours = Math.round((summary.payable_travel_minutes / 60) * 10) / 10 || 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${cfg.color === 'emerald' ? 'bg-emerald-100' : cfg.color === 'amber' ? 'bg-amber-100' : 'bg-rose-100'}`}>
          {isAuto ? <Bot className={`w-4 h-4 ${cfg.color === 'emerald' ? 'text-emerald-600' : cfg.color === 'amber' ? 'text-amber-600' : 'text-rose-600'}`} /> : <StatusIcon className={`w-4 h-4 ${cfg.color === 'emerald' ? 'text-emerald-600' : cfg.color === 'amber' ? 'text-amber-600' : 'text-rose-600'}`} />}
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900">Today's Timesheet</p>
          <p className="text-[10px] text-slate-400">{isAuto ? 'Auto-built from your activity' : 'Manually submitted'}</p>
        </div>
        <span className={`ml-auto text-xs font-bold px-2 py-1 rounded-full ${cfg.color === 'emerald' ? 'bg-emerald-100 text-emerald-700' : cfg.color === 'amber' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
          {cfg.label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-slate-50 rounded-lg p-2">
          <p className="text-slate-400 text-[10px] uppercase">On-site</p>
          <p className="font-bold text-slate-700 tabular-nums">{onSiteHours}h</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-2">
          <p className="text-slate-400 text-[10px] uppercase">Travel (paid)</p>
          <p className="font-bold text-slate-700 tabular-nums">{travelHours}h</p>
        </div>
      </div>

      {isAuto && sources.length > 0 && (
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <span className="text-[10px] text-slate-400">Built from:</span>
          {sources.map(s => (
            <span key={s} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">{s}</span>
          ))}
          <span className="ml-auto text-[10px] text-slate-400 tabular-nums">{score}% confidence</span>
        </div>
      )}

      {status === 'draft' && (
        <p className="text-xs text-rose-600 mt-2">
          We couldn't auto-build your timesheet today. Make sure your GPS is on and you've logged your work.
        </p>
      )}

      {status !== 'approved' && status !== 'rejected' && (
        <button className="mt-2 text-xs text-slate-500 underline">
          Something wrong with this timesheet?
        </button>
      )}
    </div>
  );
}