import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import {
  PoundSterling, FileText, AlertTriangle, ChevronRight, Clock, TrendingDown, Calendar,
} from 'lucide-react';
import { differenceInDays } from 'date-fns';
import { motion } from 'framer-motion';
import WidgetLoadingState from '@/components/dashboard/WidgetLoadingState';
import WidgetEmptyState from '@/components/dashboard/WidgetEmptyState';
import AnimatedNumber from '@/components/hubs/AnimatedNumber';
import WidgetActionFooter from '@/components/dashboard/WidgetActionFooter';
import { useToast } from '@/components/ui/use-toast';

const fmtGBP = (v) => {
  if (v == null || isNaN(v)) return '£0';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(v);
};

/**
 * BillingPipelineWidget — middle-row tile showing the billing pipeline:
 * draft AFPs, overdue invoices, and outstanding total. Shows oldest overdue
 * days and deep-links to the Financial Hub. Quick-action chases overdue invoices.
 */
export default function BillingPipelineWidget({ onNavigate }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [chasing, setChasing] = useState(false);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['billing-bento-invoices'],
    queryFn: () => base44.entities.Invoice.list('-issue_date', 200),
  });

  const { data: afps = [] } = useQuery({
    queryKey: ['billing-bento-afps'],
    queryFn: () => base44.entities.AFP.list('-created_date', 200),
  });

  const stats = useMemo(() => {
    const draftInvoices = invoices.filter(i => i.status === 'draft').length;
    const overdueInvoices = invoices.filter(i => i.status === 'overdue');
    const sentInvoices = invoices.filter(i => i.status === 'sent');
    const outstanding = [...sentInvoices, ...overdueInvoices];
    const totalOutstanding = outstanding.reduce((s, i) => s + (Number(i.gross_total) || 0), 0);
    const overdueTotal = overdueInvoices.reduce((s, i) => s + (Number(i.gross_total) || 0), 0);

    // Oldest overdue days — how long the most overdue invoice has been unpaid
    const oldestOverdueDays = overdueInvoices.length > 0
      ? Math.max(...overdueInvoices.map(i => {
          if (!i.due_date) return 0;
          return differenceInDays(new Date(), new Date(i.due_date));
        }))
      : 0;

    const draftAfps = afps.filter(a => (a.status || 'draft') === 'draft').length;
    const submittedAfps = afps.filter(a => a.status === 'submitted' || a.status === 'pending_review').length;

    return {
      draftInvoices,
      overdueCount: overdueInvoices.length,
      totalOutstanding,
      overdueTotal,
      oldestOverdueDays,
      draftAfps,
      submittedAfps,
      hasUrgent: overdueInvoices.length > 0,
    };
  }, [invoices, afps]);

  const handleClick = () => {
    if (onNavigate) onNavigate('billing');
    else navigate('/billing?filter=overdue');
  };

  const handleChase = async () => {
    setChasing(true);
    try {
      await base44.functions.invoke('chaseOverdueInvoices');
      toast({ title: 'Overdue invoices chased' });
    } catch {
      toast({ title: 'Chase failed', variant: 'destructive' });
    } finally {
      setChasing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="hub-glass rounded-2xl p-5 min-h-[200px] flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-md">
            <PoundSterling className="w-5 h-5 text-white" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Billing Pipeline</h3>
        </div>
        <WidgetLoadingState rows={3} />
      </div>
    );
  }

  return (
    <div
      className="hub-glass rounded-2xl overflow-hidden h-full flex flex-col cursor-pointer hover:shadow-lg transition group"
      onClick={handleClick}
    >
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 px-4 py-3 text-white flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center ring-1 ring-white/20">
              <PoundSterling className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Billing Pipeline</h3>
              <p className="text-[11px] text-white/70">
                {stats.hasUrgent ? `${stats.overdueCount} overdue` : 'All on track'}
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-white/50 group-hover:text-white group-hover:translate-x-0.5 transition" />
        </div>
      </div>

      {/* Body */}
      <div className="p-4 flex-1 flex flex-col">
        {/* Big outstanding number */}
        <div className="mb-3">
          <div className="flex items-end gap-2">
            <p className={`text-3xl font-bold tabular-nums leading-none ${stats.hasUrgent ? 'text-rose-600' : 'text-slate-800'}`}>
              <AnimatedNumber value={stats.totalOutstanding} format={(v) => fmtGBP(v)} />
            </p>
            {stats.hasUrgent && <TrendingDown className="w-4 h-4 text-rose-500 mb-1" />}
          </div>
          <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide mt-1.5">Outstanding</p>
        </div>

        {/* New stats: oldest overdue days */}
        {stats.hasUrgent && (
          <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-50 border border-rose-100">
            <Calendar className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
            <span className="text-xs font-bold text-rose-700">Oldest overdue: {stats.oldestOverdueDays}d</span>
          </div>
        )}

        {/* Pipeline items */}
        <div className="space-y-2 flex-1">
          <motion.div
            initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0 }}
            className={`flex items-center gap-2.5 p-2.5 rounded-xl border ${stats.overdueCount > 0 ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-100'}`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${stats.overdueCount > 0 ? 'bg-rose-100' : 'bg-slate-100'}`}>
              <AlertTriangle className={`w-4 h-4 ${stats.overdueCount > 0 ? 'text-rose-600' : 'text-slate-400'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-800">Overdue Invoices</p>
              <p className="text-[10px] text-slate-400">{fmtGBP(stats.overdueTotal)} outstanding</p>
            </div>
            <span className={`text-sm font-bold tabular-nums ${stats.overdueCount > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
              {stats.overdueCount}
            </span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.04 }}
            className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-100"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Clock className="w-4 h-4 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-800">Draft Invoices</p>
              <p className="text-[10px] text-slate-400">Awaiting approval</p>
            </div>
            <span className="text-sm font-bold tabular-nums text-slate-700">{stats.draftInvoices}</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 }}
            className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-100"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
              <FileText className="w-4 h-4 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-800">Draft AFPs</p>
              <p className="text-[10px] text-slate-400">{stats.submittedAfps} submitted</p>
            </div>
            <span className="text-sm font-bold tabular-nums text-slate-700">{stats.draftAfps}</span>
          </motion.div>
        </div>

        {/* Urgent action */}
        {stats.hasUrgent && (
          <div className="mt-3 px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-center">
            <p className="text-[11px] font-semibold text-rose-700">
              {stats.overdueCount} invoice{stats.overdueCount !== 1 ? 's' : ''} need chasing
            </p>
          </div>
        )}

        {/* Footer — deep-link + quick-action */}
        <WidgetActionFooter
          deepLinkLabel="Financial Hub"
          onDeepLink={handleClick}
          quickActionLabel={chasing ? 'Chasing…' : 'Chase Overdue'}
          onQuickAction={handleChase}
        />
      </div>
    </div>
  );
}