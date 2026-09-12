import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  PoundSterling, TrendingDown, AlertCircle, Mail, Clock,
  ChevronDown, ChevronRight, Building2, FileText
} from 'lucide-react';
import { Skeleton, EmptyState } from '@/components/StateViews';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { useToast } from '@/components/ui/use-toast';

const BUCKETS = [
  { label: '0–30 days', min: 0, max: 30, color: '#10b981', bg: 'bg-emerald-500' },
  { label: '31–60 days', min: 31, max: 60, color: '#3b82f6', bg: 'bg-blue-500' },
  { label: '61–90 days', min: 61, max: 90, color: '#f59e0b', bg: 'bg-amber-500' },
  { label: '90+ days', min: 91, max: Infinity, color: '#f43f5e', bg: 'bg-rose-500' },
];

const gbp = (n) => n != null ? '£' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '£0';
const daysSince = (dateStr) => {
  if (!dateStr) return 0;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
};

export default function AgedDebtorsDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedClient, setExpandedClient] = useState(null);
  const [chasing, setChasing] = useState(null);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices-outstanding'],
    queryFn: () => base44.entities.Invoice.filter({ status: { $in: ['sent', 'overdue'] } }, '-issue_date', 500),
  });

  const { bucketTotals, byClient, totalOutstanding, overdueCount, chartData, allInvoices } = useMemo(() => {
    const buckets = BUCKETS.map(() => 0);
    const clientMap = {};
    let total = 0;
    let overdue = 0;

    invoices.forEach(inv => {
      const days = daysSince(inv.issue_date);
      const gross = inv.gross_total || 0;
      if (!gross) return;

      total += gross;
      if (inv.status === 'overdue' || days > 30) overdue++;

      const bucketIdx = BUCKETS.findIndex(b => days >= b.min && days <= b.max);
      if (bucketIdx >= 0) buckets[bucketIdx] += gross;

      const clientId = inv.client_id || 'unknown';
      if (!clientMap[clientId]) {
        clientMap[clientId] = { id: clientId, name: inv.client_name || 'Unknown', total: 0, count: 0, oldest: Infinity, invoices: [] };
      }
      clientMap[clientId].total += gross;
      clientMap[clientId].count++;
      clientMap[clientId].oldest = Math.min(clientMap[clientId].oldest, days);
      clientMap[clientId].invoices.push({ ...inv, days });
    });

    // Sort invoices within each client by age (oldest first)
    Object.values(clientMap).forEach(c => c.invoices.sort((a, b) => b.days - a.days));

    const clients = Object.values(clientMap)
      .sort((a, b) => b.total - a.total);

    const chartData = BUCKETS.map((b, i) => ({
      label: b.label,
      value: buckets[i] || 0,
      color: b.color,
    }));

    return { bucketTotals: buckets, byClient: clients, totalOutstanding: total, overdueCount: overdue, chartData, allInvoices: invoices };
  }, [invoices]);

  const handleChase = async (inv) => {
    setChasing(inv.id);
    try {
      await base44.functions.invoke('chaseOverdueInvoices', {});
      await queryClient.invalidateQueries({ queryKey: ['invoices-outstanding'] });
      toast({ title: `Chase reminder sent for ${inv.invoice_number}`, duration: 2000 });
    } catch (e) {
      toast({ title: 'Failed to send chase', variant: 'destructive' });
    } finally {
      setChasing(null);
    }
  };

  if (isLoading) return <Skeleton className="h-72 rounded-xl" />;

  if (invoices.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200">
        <EmptyState icon={FileText} title="No outstanding invoices" message="All invoices are paid or in draft — great cash flow position!" />
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="hub-glass rounded-xl sm:rounded-2xl p-3 sm:p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <PoundSterling className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[10px] sm:text-xs text-slate-500 font-medium truncate">Total Outstanding</span>
          </div>
          <p className="text-lg sm:text-xl font-bold text-slate-900 tabular-nums">{gbp(totalOutstanding)}</p>
        </div>
        <div className="hub-glass rounded-xl sm:rounded-2xl p-3 sm:p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
            <span className="text-[10px] sm:text-xs text-slate-500 font-medium truncate">Overdue</span>
          </div>
          <p className="text-lg sm:text-xl font-bold text-rose-600 tabular-nums">{overdueCount}</p>
        </div>
        <div className="hub-glass rounded-xl sm:rounded-2xl p-3 sm:p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[10px] sm:text-xs text-slate-500 font-medium truncate">Avg Days</span>
          </div>
          <p className="text-lg sm:text-xl font-bold text-slate-900 tabular-nums">
            {allInvoices.length > 0
              ? Math.round(allInvoices.reduce((s, i) => s + daysSince(i.issue_date), 0) / allInvoices.length)
              : 0}d
          </p>
        </div>
        <div className="hub-glass rounded-xl sm:rounded-2xl p-3 sm:p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
            <span className="text-[10px] sm:text-xs text-slate-500 font-medium truncate">90+ Days</span>
          </div>
          <p className="text-lg sm:text-xl font-bold text-rose-600 tabular-nums">{gbp(bucketTotals[3])}</p>
        </div>
      </div>

      {/* Aging waterfall chart */}
      <div className="hub-glass rounded-2xl p-4 sm:p-5">
        <h3 className="text-sm font-bold text-slate-900 mb-1">Aging Waterfall</h3>
        <p className="text-[11px] sm:text-xs text-slate-500 mb-3 sm:mb-4">Outstanding debt by age bucket</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} width={40} />
            <Tooltip
              formatter={(v) => [gbp(v), 'Outstanding']}
              contentStyle={{ borderRadius: '0.75rem', border: '1px solid #e2e8f0', fontSize: '12px' }}
            />
            <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={120}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {/* Bucket summary below chart */}
        <div className="grid grid-cols-4 gap-1.5 sm:gap-2 mt-3">
          {BUCKETS.map((b, i) => {
            const pct = totalOutstanding > 0 ? (bucketTotals[i] / totalOutstanding) * 100 : 0;
            return (
              <div key={b.label} className="text-center">
                <div className={`h-1.5 rounded-full ${b.bg} mb-1.5`} style={{ width: '100%', opacity: 0.15 }} />
                <p className="text-[11px] sm:text-xs font-bold text-slate-900 tabular-nums">{gbp(bucketTotals[i])}</p>
                <p className="text-[9px] sm:text-[10px] text-slate-400">{pct.toFixed(0)}%</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Clients with outstanding debt — expandable */}
      <div className="hub-glass rounded-2xl overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">Clients by Outstanding — {byClient.length} clients</h3>
        </div>
        <div className="divide-y divide-slate-50 max-h-[50vh] overflow-y-auto">
          {byClient.map(c => {
            const isExpanded = expandedClient === c.id;
            const riskColor = c.oldest > 90 ? 'text-rose-600' : c.oldest > 60 ? 'text-amber-600' : c.oldest > 30 ? 'text-blue-600' : 'text-emerald-600';
            return (
              <div key={c.id}>
                {/* Client row */}
                <button
                  onClick={() => setExpandedClient(isExpanded ? null : c.id)}
                  className="w-full px-4 sm:px-5 py-3 flex items-center gap-2.5 sm:gap-3 hover:bg-slate-50 transition text-left"
                >
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />}
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{c.name}</p>
                    <p className="text-[11px] text-slate-500 truncate">{c.count} invoice{c.count !== 1 ? 's' : ''} · oldest <span className={`font-medium ${riskColor}`}>{c.oldest}d</span></p>
                  </div>
                  <p className="text-sm font-bold text-slate-900 tabular-nums flex-shrink-0">{gbp(c.total)}</p>
                </button>
                {/* Expanded invoice list */}
                {isExpanded && (
                  <div className="bg-slate-50/50 px-3 sm:px-5 py-2 space-y-1.5">
                    {c.invoices.map(inv => {
                      const bucketIdx = BUCKETS.findIndex(b => inv.days >= b.min && inv.days <= b.max);
                      const bucket = BUCKETS[bucketIdx];
                      return (
                        <div key={inv.id} className="flex items-center gap-2.5 sm:gap-3 bg-white rounded-lg border border-slate-100 px-3 py-2.5">
                          <div className={`w-1.5 h-10 rounded-full ${bucket?.bg} flex-shrink-0`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[11px] sm:text-xs font-mono font-bold text-slate-700">{inv.invoice_number}</span>
                              <span className={`text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-full font-medium ${inv.status === 'overdue' ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'}`}>
                                {inv.status}
                              </span>
                            </div>
                            <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">
                              Issued {new Date(inv.issue_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} · {inv.days}d old
                              {inv.due_date && ` · due ${new Date(inv.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`}
                            </p>
                          </div>
                          <p className="text-xs sm:text-sm font-bold text-slate-900 tabular-nums flex-shrink-0">{gbp(inv.gross_total)}</p>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleChase(inv); }}
                            disabled={chasing === inv.id}
                            className="flex-shrink-0 inline-flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 transition disabled:opacity-50"
                          >
                            <Mail className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                            <span className="hidden sm:inline">{chasing === inv.id ? 'Sending...' : 'Chase'}</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}