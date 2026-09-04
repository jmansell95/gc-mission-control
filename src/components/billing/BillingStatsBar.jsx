import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { FileBarChart, PoundSterling, Clock, AlertTriangle } from 'lucide-react';
import HubStatsBar from '@/components/dashboard/HubStatsBar';

const gbp = (n) => (n != null ? '£' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '£0');

/**
 * BillingStatsBar — hub-level KPI strip for the Financial Control Hub.
 *
 * Shows the four headline financial metrics (AFP claimed, agreed, outstanding,
 * overdue) above the tab bar so they're visible on every tab, not just Insights.
 * Uses the shared HubStatsBar for visual consistency with all other hubs.
 *
 * Data is fetched with the same react-query keys as BillingInsightsTab so
 * the requests are deduplicated by the query cache.
 */
export default function BillingStatsBar() {
  const { data: afps = [] } = useQuery({
    queryKey: ['billing-insights-afps'],
    queryFn: () => base44.entities.AFP.filter({ status: { $in: ['draft', 'pending_review', 'submitted'] } }, '-created_date', 200),
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['billing-insights-invoices'],
    queryFn: () => base44.entities.Invoice.filter({ status: { $in: ['sent', 'overdue'] } }, '-created_date', 200),
  });

  const tiles = useMemo(() => {
    const totalClaimed = afps.reduce((s, a) => s + (a.total_claimed || 0), 0);
    const totalAgreed = afps.reduce((s, a) => s + (a.agreed_total || 0), 0);
    const outstanding = invoices.reduce((s, i) => s + (i.gross_total || 0), 0);
    const overdue = invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + (i.gross_total || 0), 0);
    return [
      { icon: FileBarChart, label: 'AFP Claimed', value: gbp(totalClaimed), sublabel: `${afps.length} active AFPs`, color: 'brand' },
      { icon: PoundSterling, label: 'Agreed Total', value: gbp(totalAgreed), sublabel: 'Client-approved', color: 'emerald' },
      { icon: Clock, label: 'Outstanding', value: gbp(outstanding), sublabel: `${invoices.length} invoices`, color: 'amber' },
      { icon: AlertTriangle, label: 'Overdue', value: gbp(overdue), sublabel: overdue > 0 ? 'Needs chasing' : 'All current', color: overdue > 0 ? 'rose' : 'slate' },
    ];
  }, [afps, invoices]);

  return <HubStatsBar tiles={tiles} />;
}