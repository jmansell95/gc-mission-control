import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  PoundSterling, FileBarChart, TrendingUp, Clock, AlertTriangle,
} from 'lucide-react';
import FinancialReconciliationWidget from '@/components/dashboard/FinancialReconciliationWidget';
import ProjectHealthDashboardWidget from '@/components/dashboard/ProjectHealthDashboardWidget';
import BenchmarkComparisonsWidget from '@/components/dashboard/BenchmarkComparisonsWidget';
import ClientFeedbackWidget from '@/components/dashboard/ClientFeedbackWidget';
import ReportsHubWidget from '@/components/dashboard/ReportsHubWidget';

const gbp = (n) => (n != null ? '£' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '£0');

/**
 * BillingInsightsTab — the "Insights" view of the Financial Control Hub.
 *
 * Redesigned with a refined-brand KPI strip (total claimed, agreed, outstanding,
 * overdue) above the existing 2-column dashboard widget grid.
 */
export default function BillingInsightsTab() {
  const navigate = useNavigate();
  const go = (section) => navigate('/admin', { state: { section } });

  const { data: afps = [] } = useQuery({
    queryKey: ['billing-insights-afps'],
    queryFn: () => base44.entities.AFP.filter({ status: { $in: ['draft', 'pending_review', 'submitted'] } }, '-created_date', 200),
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['billing-insights-invoices'],
    queryFn: () => base44.entities.Invoice.filter({ status: { $in: ['sent', 'overdue', 'partially_paid'] } }, '-created_date', 200),
  });

  const kpis = useMemo(() => {
    const totalClaimed = afps.reduce((s, a) => s + (a.total_claimed || 0), 0);
    const totalAgreed = afps.reduce((s, a) => s + (a.agreed_total || 0), 0);
    const outstanding = invoices.reduce((s, i) => s + (i.gross_total || 0), 0);
    const overdue = invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + (i.gross_total || 0), 0);
    return { totalClaimed, totalAgreed, outstanding, overdue, afpCount: afps.length, invoiceCount: invoices.length };
  }, [afps, invoices]);

  const tiles = [
    { icon: FileBarChart, label: 'AFP Claimed', value: gbp(kpis.totalClaimed), sub: `${kpis.afpCount} active AFPs`, color: 'stat-gradient-brand' },
    { icon: PoundSterling, label: 'Agreed Total', value: gbp(kpis.totalAgreed), sub: 'Client-approved', color: 'stat-gradient-emerald' },
    { icon: Clock, label: 'Outstanding', value: gbp(kpis.outstanding), sub: `${kpis.invoiceCount} invoices`, color: 'stat-gradient-amber' },
    { icon: AlertTriangle, label: 'Overdue', value: gbp(kpis.overdue), sub: 'Needs chasing', color: kpis.overdue > 0 ? 'stat-gradient-rose' : 'stat-gradient-slate' },
  ];

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Refined-brand KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <div key={tile.label} className="insight-card rounded-2xl p-4 relative overflow-hidden">
              <div className={`absolute -top-6 -right-6 w-20 h-20 rounded-full ${tile.color} opacity-10`} />
              <div className="relative">
                <div className={`w-9 h-9 rounded-xl ${tile.color} flex items-center justify-center mb-2.5`}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <p className="text-xl sm:text-2xl font-extrabold text-slate-900 tabular-nums leading-none">{tile.value}</p>
                <p className="text-xs font-semibold text-slate-500 mt-1">{tile.label}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{tile.sub}</p>
              </div>
            </div>
          );
        })}
      </div>

      <FinancialReconciliationWidget onNavigate={go} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <ProjectHealthDashboardWidget onNavigate={go} />
        <BenchmarkComparisonsWidget onNavigate={go} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <ClientFeedbackWidget onNavigate={go} />
        <ReportsHubWidget onNavigate={go} />
      </div>
    </div>
  );
}