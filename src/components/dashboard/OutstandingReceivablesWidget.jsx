import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { PoundSterling, Clock, AlertTriangle, CheckCircle2, TrendingDown } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { getOutstanding, getOverdue, getCollected } from '@/utils/financialStats';

const STATUS_META = {
  draft: { label: 'Draft', icon: PoundSterling, tone: 'text-slate-600 bg-slate-100', bar: 'bg-slate-400' },
  sent: { label: 'Sent', icon: Clock, tone: 'text-blue-600 bg-blue-50', bar: 'bg-blue-500' },
  overdue: { label: 'Overdue', icon: AlertTriangle, tone: 'text-red-600 bg-red-50', bar: 'bg-red-500' },
  paid: { label: 'Paid', icon: CheckCircle2, tone: 'text-emerald-600 bg-emerald-50', bar: 'bg-emerald-500' },
  void: { label: 'Void', icon: TrendingDown, tone: 'text-slate-400 bg-slate-50', bar: 'bg-slate-300' },
};

const gbp = (n) => n != null && !isNaN(n) ? '£' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '£0';

export default function OutstandingReceivablesWidget() {
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices-receivables'],
    queryFn: () => base44.entities.Invoice.list('-issue_date', 500),
  });

  const today = new Date();
  const outstandingResult = getOutstanding(invoices);
  const overdueResult = getOverdue(invoices);
  const collectedResult = getCollected(invoices);

  const outstanding = outstandingResult.invoices;
  const overdueInvoices = overdueResult.invoices;
  const totalOutstanding = outstandingResult.amount;
  const totalOverdue = overdueResult.amount;
  const totalPaid = collectedResult.amount;

  // Group outstanding by client for a quick debtor view
  const byClient = {};
  outstanding.forEach(i => {
    const name = i.client_name || 'Unknown';
    if (!byClient[name]) byClient[name] = { total: 0, count: 0, oldestDays: 0 };
    byClient[name].total += i.gross_total || 0;
    byClient[name].count += 1;
    if (i.due_date) {
      const days = differenceInDays(today, new Date(i.due_date + 'T00:00:00'));
      if (days > byClient[name].oldestDays) byClient[name].oldestDays = days;
    }
  });
  const topDebtors = Object.entries(byClient)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 4);

  if (isLoading) {
    return (
      <div className="p-5 space-y-3">
        <div className="h-6 w-48 bg-slate-100 rounded animate-pulse" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-slate-50 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-slate-900 text-base">Outstanding Receivables</h3>
          <p className="text-xs text-slate-400 mt-0.5">Invoice pipeline & aged debtors</p>
        </div>
        <div className="w-10 h-10 rounded-xl stat-gradient-brand flex items-center justify-center shadow-sm">
          <PoundSterling className="w-5 h-5 text-white" />
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-3 gap-2.5 mb-4">
        <div className="rounded-xl p-3 bg-blue-50 border border-blue-100">
          <Clock className="w-4 h-4 text-blue-500 mb-1" />
          <p className="text-xs text-blue-600 font-medium">Awaiting Payment</p>
          <p className="text-lg font-bold text-blue-700 tabular-nums mt-0.5">{gbp(totalOutstanding)}</p>
          <p className="text-[10px] text-blue-500">{outstanding.length} invoices</p>
        </div>
        <div className="rounded-xl p-3 bg-red-50 border border-red-100">
          <AlertTriangle className="w-4 h-4 text-red-500 mb-1" />
          <p className="text-xs text-red-600 font-medium">Overdue</p>
          <p className="text-lg font-bold text-red-700 tabular-nums mt-0.5">{gbp(totalOverdue)}</p>
          <p className="text-[10px] text-red-500">{overdueInvoices.length} invoices</p>
        </div>
        <div className="rounded-xl p-3 bg-emerald-50 border border-emerald-100">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 mb-1" />
          <p className="text-xs text-emerald-600 font-medium">Collected</p>
          <p className="text-lg font-bold text-emerald-700 tabular-nums mt-0.5">{gbp(totalPaid)}</p>
          <p className="text-[10px] text-emerald-500">paid to date</p>
        </div>
      </div>

      {/* Status bar */}
      <div className="mb-4">
        <div className="flex items-center gap-1 h-2.5 rounded-full overflow-hidden bg-slate-100">
          {Object.entries(
            invoices.reduce((acc, inv) => {
              const s = inv.status || 'draft';
              acc[s] = (acc[s] || 0) + 1;
              return acc;
            }, {})
          ).map(([status, count]) => {
            const meta = STATUS_META[status] || STATUS_META.draft;
            const pct = invoices.length > 0 ? (count / invoices.length) * 100 : 0;
            return pct > 0 ? (
              <div key={status} className={`${meta.bar} h-full`} style={{ width: `${pct}%` }} title={`${meta.label}: ${count}`} />
            ) : null;
          })}
        </div>
        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          {Object.entries(STATUS_META).map(([key, meta]) => {
            const count = invoices.filter(i => (i.status || 'draft') === key).length;
            if (count === 0) return null;
            const MIcon = meta.icon;
            return (
              <span key={key} className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${meta.tone}`}>
                <MIcon className="w-2.5 h-2.5" /> {meta.label} ({count})
              </span>
            );
          })}
        </div>
      </div>

      {/* Top debtors */}
      {topDebtors.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Top Debtors</p>
          <div className="space-y-1.5">
            {topDebtors.map(([name, data]) => (
              <div key={name} className="flex items-center justify-between gap-2 text-sm py-1.5 px-2.5 rounded-lg hover:bg-slate-50 transition">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-700 truncate">{name}</p>
                  <p className="text-[10px] text-slate-400">
                    {data.count} invoice{data.count > 1 ? 's' : ''}
                    {data.oldestDays > 0 && ` · oldest ${data.oldestDays}d overdue`}
                  </p>
                </div>
                <span className={`font-bold tabular-nums text-sm flex-shrink-0 ${data.oldestDays > 0 ? 'text-red-600' : 'text-slate-700'}`}>
                  {gbp(data.total)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {outstanding.length === 0 && (
        <div className="text-center py-6">
          <CheckCircle2 className="w-8 h-8 text-emerald-300 mx-auto mb-2" />
          <p className="text-sm text-slate-400">All invoices settled — no outstanding receivables.</p>
        </div>
      )}
    </div>
  );
}