import React, { useMemo } from 'react';
import {
  Sparkles, AlertTriangle, ArrowRight, Lightbulb, TrendingUp, FileText,
  Ruler, PoundSterling, ShieldAlert, CheckCircle2,
} from 'lucide-react';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

/**
 * BillingInsightPanel — predictive "what's missing" engine that scans every
 * job and surfaces actionable billing gaps before they cost money:
 *   • Legacy markup jobs that should move to a proper billing method
 *   • Active jobs with no billing contract
 *   • Drilling jobs with meterage but no per-metre rate
 *   • Jobs with cost but zero revenue (margin risk)
 *   • Completed/decommissioned jobs with no invoices raised
 */
export default function BillingInsightPanel({ rows = [], onSelectJob }) {
  const insights = useMemo(() => {
    const list = [];

    rows.forEach((r) => {
      const job = r.job;
      if (!job) return;

      // 1. Legacy markup model on an active/ready job
      if ((r.method === 'none' || !r.method) && (r.revenueNet > 0 || r.totalCostNet > 0) && job.status !== 'cancelled') {
        list.push({
          severity: 'warn',
          icon: TrendingUp,
          title: `${job.name}: using legacy markup-on-cost`,
          detail: `Revenue is calculated as cost + markup%. Switch to a day rate, meterage or unit-rate contract for tighter margin control.`,
          action: 'Set Billing Method',
          jobId: job.id,
        });
      }

      // 2. Drilling job with meterage logged but no meterage rate
      if ((job.meterage > 0 || job.meterage_target > 0) && !job.meterage_rate && job.drilling_method !== 'not_applicable') {
        list.push({
          severity: 'warn',
          icon: Ruler,
          title: `${job.name}: ${job.meterage || 0}m drilled with no per-metre rate`,
          detail: `Meterage is being tracked but no £/m rate is set — revenue may be undercalculated.`,
          action: 'Set Metre Rate',
          jobId: job.id,
        });
      }

      // 3. Cost with zero revenue (margin risk)
      if (r.totalCostNet > 0 && r.revenueNet === 0 && job.status !== 'cancelled' && job.status !== 'planning') {
        list.push({
          severity: 'critical',
          icon: AlertTriangle,
          title: `${job.name}: ${fmt(r.totalCostNet)} cost, £0 revenue`,
          detail: `This job has logged costs but no chargeable revenue — you may be working for free.`,
          action: 'Review Billing',
          jobId: job.id,
        });
      }

      // 4. Completed/decommissioned with no invoices
      if (['decommissioning', 'completed'].includes(job.status) && r.revenueNet > 0) {
        list.push({
          severity: 'info',
          icon: FileText,
          title: `${job.name}: ready to invoice, no invoice raised`,
          detail: `${fmt(r.revenueNet)} in billable revenue on a ${job.status} job — raise an invoice to collect.`,
          action: 'Raise Invoice',
          jobId: job.id,
        });
      }

      // 5. Negative margin
      if (r.revenueNet > 0 && r.totalCostNet > r.revenueNet && job.status !== 'cancelled') {
        const loss = r.totalCostNet - r.revenueNet;
        list.push({
          severity: 'critical',
          icon: ShieldAlert,
          title: `${job.name}: losing ${fmt(loss)} on this job`,
          detail: `Cost (${fmt(r.totalCostNet)}) exceeds revenue (${fmt(r.revenueNet)}) — margin is negative.`,
          action: 'Review Costs',
          jobId: job.id,
        });
      }
    });

    // Sort: critical first, then warn, then info
    const order = { critical: 0, warn: 1, info: 2 };
    return list.sort((a, b) => order[a.severity] - order[b.severity]).slice(0, 12);
  }, [rows]);

  if (insights.length === 0) {
    return (
      <div className="hub-glass rounded-2xl p-4 mb-5">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">Billing Health Check</h3>
        </div>
        <p className="text-sm text-slate-500 mt-2">No billing gaps detected — every job has a billing method, revenue is tracking against cost, and ready jobs have invoices. Nice work.</p>
      </div>
    );
  }

  const toneMap = {
    critical: { bg: 'bg-rose-50', border: 'border-rose-200', icon: 'text-rose-600 bg-rose-100', badge: 'bg-rose-100 text-rose-700', label: 'Critical' },
    warn: { bg: 'bg-amber-50', border: 'border-amber-200', icon: 'text-amber-600 bg-amber-100', badge: 'bg-amber-100 text-amber-700', label: 'Warning' },
    info: { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'text-blue-600 bg-blue-100', badge: 'bg-blue-100 text-blue-700', label: 'Opportunity' },
  };

  const counts = {
    critical: insights.filter((i) => i.severity === 'critical').length,
    warn: insights.filter((i) => i.severity === 'warn').length,
    info: insights.filter((i) => i.severity === 'info').length,
  };

  return (
    <div className="hub-glass rounded-2xl p-4 mb-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-slate-800">Predictive Billing Insights</h3>
          <p className="text-[11px] text-slate-400">Gaps found before they cost you — sorted by urgency</p>
        </div>
        <div className="flex items-center gap-1.5">
          {counts.critical > 0 && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">{counts.critical} critical</span>}
          {counts.warn > 0 && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">{counts.warn} warnings</span>}
          {counts.info > 0 && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">{counts.info} opportunities</span>}
        </div>
      </div>

      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {insights.map((ins, i) => {
          const tone = toneMap[ins.severity];
          const Icon = ins.icon;
          return (
            <div key={i} className={`flex items-start gap-3 rounded-lg border ${tone.border} ${tone.bg} px-3 py-2.5`}>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${tone.icon}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-800">{ins.title}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{ins.detail}</p>
              </div>
              {onSelectJob && (
                <button
                  onClick={() => onSelectJob({ id: ins.jobId, name: ins.title.split(':')[0] })}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-white text-slate-600 hover:text-[#2E5A1A] rounded-md text-[11px] font-semibold border border-slate-200 hover:border-[#2E5A1A]/30 transition flex-shrink-0"
                >
                  {ins.action} <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}