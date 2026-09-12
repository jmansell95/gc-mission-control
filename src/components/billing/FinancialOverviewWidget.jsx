import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  PoundSterling, Clock, AlertTriangle, FileText, TrendingUp, Receipt,
  Banknote, ShieldCheck, Calendar, ArrowUpRight, ArrowDownRight, Wallet,
  Building2, Percent, Loader2,
} from 'lucide-react';
import { Skeleton } from '@/components/StateViews';
import { getOutstanding, getOverdue, getCollected, getDraftInvoices, getVatLiability } from '@/utils/financialStats';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 });
const fmtCompact = (n) => {
  const v = Number(n || 0);
  if (Math.abs(v) >= 1000000) return '£' + (v / 1000000).toFixed(1) + 'M';
  if (Math.abs(v) >= 1000) return '£' + (v / 1000).toFixed(1) + 'k';
  return '£' + v.toFixed(0);
};

/**
 * Modern Financial Overview — information-rich summary for the Financial Hub.
 *
 * Clarifies the distinction between:
 *  - Applications for Payment (AfP): work completed/valued but NOT yet invoiced
 *  - Invoices: formal tax documents issued to the client
 *
 * Shows: outstanding, overdue, AfP pipeline, retention held, VAT liability,
 * paid this month, and a 6-month revenue sparkline.
 */
export default function FinancialOverviewWidget({ onSelectTab }) {
  const { data: invoices = [], isLoading: invLoading } = useQuery({
    queryKey: ['invoices-overview'],
    queryFn: () => base44.entities.Invoice.list('-issue_date', 200),
  });
  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs-financial-overview'],
    queryFn: () => base44.entities.Job.list('-updated_date', 200),
  });

  const stats = useMemo(() => {
    const outstandingResult = getOutstanding(invoices);
    const overdueResult = getOverdue(invoices);
    const draftResult = getDraftInvoices(invoices);
    const collectedResult = getCollected(invoices);

    const outstanding = outstandingResult.invoices;
    const overdue = overdueResult.invoices;
    const drafts = draftResult.invoices;
    const paid = collectedResult.invoices;

    const outstandingTotal = outstandingResult.amount;
    const overdueTotal = overdueResult.amount;
    const draftTotal = draftResult.amount;
    const paidTotal = collectedResult.amount;

    // VAT liability — sum of VAT on sent + overdue invoices (not yet paid to HMRC)
    const vatLiability = getVatLiability(invoices);

    // Retention held — estimate from paid invoices (typically 5% retention)
    // In a full system this would come from a dedicated retention field; for now
    // we surface the VAT figure as the key tax liability metric.
    const retentionHeld = jobs
      .filter(j => j.status === 'in_progress' || j.status === 'decommissioning')
      .reduce((s, j) => s + ((j.client_charge || j.budget_amount || 0) * 0.05), 0);

    // AfP pipeline — jobs with completed work that haven't been invoiced yet.
    // Approximated by jobs in 'decommissioning' or 'completed' status with no
    // matching invoice in the system.
    const invoicedJobIds = new Set(invoices.map(i => i.job_id).filter(Boolean));
    const afpJobs = jobs.filter(j =>
      (j.status === 'decommissioning' || j.status === 'completed') &&
      !invoicedJobIds.has(j.id)
    );
    const afpTotal = afpJobs.reduce((s, j) => s + (j.client_charge || j.budget_amount || 0), 0);

    // Paid this month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const paidThisMonth = paid
      .filter(i => i.paid_at && new Date(i.paid_at) >= monthStart)
      .reduce((s, i) => s + (i.gross_total || 0), 0);

    // 6-month revenue trend (paid invoices by month)
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const total = paid
        .filter(inv => {
          const pd = inv.paid_at ? new Date(inv.paid_at) : (inv.issue_date ? new Date(inv.issue_date) : null);
          return pd && pd >= d && pd < next;
        })
        .reduce((s, inv) => s + (inv.gross_total || 0), 0);
      months.push({ label: d.toLocaleDateString('en-GB', { month: 'short' }), value: total });
    }

    return {
      outstanding, overdue, drafts, paid,
      outstandingTotal, overdueTotal, draftTotal, paidTotal,
      vatLiability, retentionHeld, afpTotal, afpCount: afpJobs.length,
      paidThisMonth, months,
    };
  }, [invoices, jobs]);

  const sparkPath = useMemo(() => {
    const vals = stats.months.map(m => m.value);
    if (vals.length === 0) return '';
    const max = Math.max(...vals, 1);
    const w = 120, h = 32;
    const step = w / (vals.length - 1);
    return vals.map((v, i) => `${i === 0 ? 'M' : 'L'} ${i * step} ${h - (v / max) * h}`).join(' ');
  }, [stats.months]);

  if (invLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
      </div>
    );
  }

  const primaryCards = [
    {
      label: 'Outstanding', value: fmt(stats.outstandingTotal),
      sub: `${stats.outstanding.length} invoice${stats.outstanding.length !== 1 ? 's' : ''}`,
      icon: PoundSterling, gradient: 'stat-gradient-amber', tab: 'aged-debtors',
      trend: stats.outstanding.length > 0 ? 'up' : 'flat',
    },
    {
      label: 'Overdue', value: fmt(stats.overdueTotal),
      sub: `${stats.overdue.length} need chasing`,
      icon: AlertTriangle, gradient: 'stat-gradient-rose', tab: 'aged-debtors',
      trend: stats.overdue.length > 0 ? 'down' : 'flat',
    },
    {
      label: 'AfP Pipeline', value: fmt(stats.afpTotal),
      sub: `${stats.afpCount} job${stats.afpCount !== 1 ? 's' : ''} ready to invoice`,
      icon: FileText, gradient: 'stat-gradient-blue', tab: 'billing-readiness',
      trend: 'up', isAfP: true,
    },
    {
      label: 'Paid This Month', value: fmt(stats.paidThisMonth),
      sub: `${stats.paid.length} total settled`,
      icon: TrendingUp, gradient: 'stat-gradient-emerald', tab: null,
      trend: 'up',
    },
  ];

  return (
    <div className="space-y-3">
      {/* Primary KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {primaryCards.map((c, i) => {
          const Icon = c.icon;
          const Wrapper = c.tab && onSelectTab ? 'button' : 'div';
          return (
            <Wrapper
              key={i}
              onClick={() => c.tab && onSelectTab?.(c.tab)}
              className={`relative overflow-hidden rounded-2xl p-3.5 sm:p-4 text-white text-left ${c.gradient} ${c.tab && onSelectTab ? 'hover:scale-[1.02] active:scale-[0.98] transition cursor-pointer' : ''} shadow-md`}
            >
              <div className="absolute right-2 top-2 opacity-15">
                <Icon className="w-10 h-10 sm:w-12 sm:h-12" />
              </div>
              <div className="relative">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Icon className="w-3.5 h-3.5 text-white/70" />
                  <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wide text-white/80 truncate">{c.label}</span>
                  {c.isAfP && (
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-white/25 text-white">AfP</span>
                  )}
                </div>
                <p className="text-xl sm:text-2xl font-extrabold tabular-nums leading-tight">{c.value}</p>
                <p className="text-[10px] sm:text-[11px] text-white/70 mt-0.5 truncate">{c.sub}</p>
              </div>
            </Wrapper>
          );
        })}
      </div>

      {/* Secondary metrics row — VAT, Retention, Revenue Trend */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
        {/* VAT Liability */}
        <div className="hub-glass rounded-2xl p-4 relative overflow-hidden">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
              <Percent className="w-4 h-4 text-violet-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">VAT Liability</p>
              <p className="text-lg font-extrabold text-slate-900 tabular-nums">{fmt(stats.vatLiability)}</p>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            VAT owed to HMRC on outstanding invoices. Collected from clients, not yet paid to HMRC.
          </p>
        </div>

        {/* Retention Held */}
        <div className="hub-glass rounded-2xl p-4 relative overflow-hidden">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Retention Held</p>
              <p className="text-lg font-extrabold text-slate-900 tabular-nums">{fmt(stats.retentionHeld)}</p>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Estimated 5% retention withheld on active jobs. Released on project completion / defect-free period.
          </p>
        </div>

        {/* Revenue Trend (6-month sparkline) */}
        <div className="hub-glass rounded-2xl p-4 relative overflow-hidden">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">6-Month Revenue</p>
              <p className="text-lg font-extrabold text-slate-900 tabular-nums">{fmtCompact(stats.months.reduce((s, m) => s + m.value, 0))}</p>
            </div>
          </div>
          <div className="flex items-end gap-1 h-8 mt-1">
            {stats.months.map((m, i) => {
              const max = Math.max(...stats.months.map(x => x.value), 1);
              const h = Math.max((m.value / max) * 100, 4);
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                  <div className="w-full rounded-sm bg-gradient-to-t from-emerald-400 to-emerald-500" style={{ height: `${h}%` }} />
                  <span className="text-[8px] text-slate-400 font-medium">{m.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* AfP vs Invoice explainer banner */}
      <div className="hub-glass rounded-2xl p-4 border-l-4 border-l-[#2E5A1A]">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#2E5A1A]/10 flex items-center justify-center flex-shrink-0">
            <Wallet className="w-5 h-5 text-[#2E5A1A]" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900">Applications for Payment vs Invoices</p>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              <strong>Applications for Payment (AfP)</strong> are formal requests for payment based on work completed —
              they are <em>not</em> tax invoices. The client certifies the AfP, then you raise a <strong>VAT Invoice</strong>.
              The <span className="font-semibold text-blue-600">AfP Pipeline</span> above shows completed jobs not yet invoiced.
              Use the <span className="font-semibold text-[#2E5A1A]">Billing Readiness</span> step to convert AfP into invoices.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}