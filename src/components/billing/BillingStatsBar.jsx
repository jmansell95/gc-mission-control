import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { FileBarChart, PoundSterling, Clock, AlertTriangle } from 'lucide-react';
import HubStatsBar from '@/components/dashboard/HubStatsBar';
import { getOutstanding, getOverdue } from '@/utils/financialStats';

const gbp = (n) => (n != null ? '£' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '£0');

/**
 * BillingStatsBar — hub-level KPI strip for the Financial Control Hub.
 *
 * Shows the four headline financial metrics (AFP claimed, agreed, outstanding,
 * overdue) above the tab bar so they're visible on every tab, not just Insights.
 * Uses the shared HubStatsBar for visual consistency with all other hubs.
 *
 * Invoice KPIs use the shared financialStats helpers so the numbers match
 * every other financial surface (Admin Dashboard, Enterprise Hub, etc.).
 * Fetches ALL non-void invoices (not just sent/overdue) so the figures are
 * complete and consistent.
 */
export default function BillingStatsBar() {
  const { data: afps = [] } = useQuery({
    queryKey: ['billing-insights-afps'],
    queryFn: () => base44.entities.AFP.filter({ status: { $in: ['draft', 'pending_review', 'submitted'] } }, '-created_date', 500),
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['billing-insights-invoices'],
    queryFn: () => base44.entities.Invoice.list('-issue_date', 500),
  });

  const tiles = useMemo(() => {
    const totalClaimed = afps.reduce((s, a) => s + (a.total_claimed || 0), 0);
    const totalAgreed = afps.reduce((s, a) => s + (a.agreed_total || 0), 0);
    const outstanding = getOutstanding(invoices);
    const overdue = getOverdue(invoices);
    return [
      { icon: FileBarChart, label: 'AFP Claimed', value: gbp(totalClaimed), sublabel: `${afps.length} active AFPs`, color: 'brand' },
      { icon: PoundSterling, label: 'Agreed Total', value: gbp(totalAgreed), sublabel: 'Client-approved', color: 'emerald' },
      { icon: Clock, label: 'Outstanding', value: gbp(outstanding.amount), sublabel: `${outstanding.count} invoices`, color: 'amber' },
      { icon: AlertTriangle, label: 'Overdue', value: gbp(overdue.amount), sublabel: overdue.amount > 0 ? 'Needs chasing' : 'All current', color: overdue.amount > 0 ? 'rose' : 'slate' },
    ];
  }, [afps, invoices]);

  return <HubStatsBar tiles={tiles} />;
}