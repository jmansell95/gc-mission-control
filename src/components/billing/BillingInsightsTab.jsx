import React from 'react';
import { useNavigate } from 'react-router-dom';
import FinancialReconciliationWidget from '@/components/dashboard/FinancialReconciliationWidget';
import ProjectHealthDashboardWidget from '@/components/dashboard/ProjectHealthDashboardWidget';
import BenchmarkComparisonsWidget from '@/components/dashboard/BenchmarkComparisonsWidget';
import ClientFeedbackWidget from '@/components/dashboard/ClientFeedbackWidget';
import ReportsHubWidget from '@/components/dashboard/ReportsHubWidget';
import AFPHealthCheck from '@/components/billing/AFPHealthCheck';

/**
 * BillingInsightsTab — the "Insights" view of the Financial Control Hub.
 *
 * KPI strip now lives at the hub level (BillingStatsBar in HubShell) so the
 * four headline metrics are visible on every tab. This tab keeps the
 * 2-column dashboard widget grid for deeper financial intelligence.
 */
export default function BillingInsightsTab() {
  const navigate = useNavigate();
  const go = (section) => navigate('/admin', { state: { section } });

  return (
    <div className="space-y-3 sm:space-y-4">
      <AFPHealthCheck />
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