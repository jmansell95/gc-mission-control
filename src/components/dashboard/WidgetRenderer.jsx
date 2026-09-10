import React from 'react';
import { useNavigate } from 'react-router-dom';
import ErrorBoundary from '@/components/ErrorBoundary';

// Operational widgets
import BentoStatTiles from '@/components/dashboard/BentoStatTiles';
import SiteSnapshotGrid from '@/components/dashboard/SiteSnapshotGrid';
import RigsOnSiteBentoWidget from '@/components/dashboard/RigsOnSiteBentoWidget';
import BoreholesInProgressWidget from '@/components/dashboard/BoreholesInProgressWidget';
import FieldPrioritiesWidget from '@/components/dashboard/FieldPrioritiesWidget';
import ExceptionMonitorWidget from '@/components/dashboard/ExceptionMonitorWidget';
import TrainingGapSchedulerWidget from '@/components/dashboard/TrainingGapSchedulerWidget';

// Financial widgets
import LiveDrillingRevenueWidget from '@/components/dashboard/LiveDrillingRevenueWidget';
import BillingPipelineWidget from '@/components/dashboard/BillingPipelineWidget';
import RevenueVelocityWidget from '@/components/dashboard/RevenueVelocityWidget';
import CashFlowForecastWidget from '@/components/dashboard/CashFlowForecastWidget';
import AgedDebtorsDashboard from '@/components/billing/AgedDebtorsDashboard';

// Safety widgets
import SafetyMittiStatusWidget from '@/components/dashboard/SafetyMittiStatusWidget';
import ComplianceExpiryWidget from '@/components/dashboard/ComplianceExpiryWidget';

// Intelligence widgets
import AiDailyBriefingWidget from '@/components/dashboard/AiDailyBriefingWidget';
import AiInsightsWidget from '@/components/dashboard/AiInsightsWidget';
import SiteWeatherOverviewWidget from '@/components/dashboard/SiteWeatherOverviewWidget';

/**
 * WidgetRenderer — maps a widget ID from the registry to its React component.
 * Each widget is wrapped in an ErrorBoundary so a single widget crash doesn't
 * blank the whole dashboard.
 *
 * Props:
 *   - widgetId: the registry key
 *   - onNavigate: hub navigation callback
 *   - onSelectJob: job selection callback
 *   - onOpenJobDrawer: quick drawer callback
 *   - onJobBreakdown: financial breakdown callback
 */
export default function WidgetRenderer({ widgetId, onNavigate, onSelectJob, onOpenJobDrawer, onJobBreakdown }) {
  const navigate = useNavigate();

  const renderContent = () => {
    switch (widgetId) {
      // ── Operational ──
      case 'key-metrics':
        return <BentoStatTiles onNavigate={onNavigate} />;
      case 'active-sites':
        return <SiteSnapshotGrid onSelectJob={onOpenJobDrawer || onSelectJob} onNavigate={onNavigate} />;
      case 'rigs-on-site':
        return <RigsOnSiteBentoWidget onJobBreakdown={onJobBreakdown} />;
      case 'boreholes-progress':
        return <BoreholesInProgressWidget onNavigate={onNavigate} />;
      case 'field-priorities':
        return <FieldPrioritiesWidget onNavigate={onNavigate} />;
      case 'exception-monitor':
        return <ExceptionMonitorWidget onNavigate={onNavigate} />;
      case 'training-gaps':
        return <TrainingGapSchedulerWidget />;

      // ── Financial ──
      case 'live-revenue':
        return <LiveDrillingRevenueWidget onNavigate={onNavigate} />;
      case 'billing-pipeline':
        return <BillingPipelineWidget onNavigate={onNavigate} />;
      case 'revenue-velocity':
        return <RevenueVelocityWidget />;
      case 'cash-flow':
        return <CashFlowForecastWidget onNavigate={onNavigate} />;
      case 'aged-debtors':
        return <AgedDebtorsDashboard onNavigate={onNavigate} />;

      // ── Safety & Compliance ──
      case 'safety-mitti':
        return <SafetyMittiStatusWidget onNavigate={onNavigate} />;
      case 'compliance-expiry':
        return <ComplianceExpiryWidget onNavigate={onNavigate} />;

      // ── Intelligence ──
      case 'ai-briefing':
        return <AiDailyBriefingWidget />;
      case 'ai-insights':
        return <AiInsightsWidget onNavigate={onNavigate} />;
      case 'weather':
        return <SiteWeatherOverviewWidget onNavigate={onNavigate} />;

      default:
        return (
          <div className="insight-card rounded-2xl p-6 text-center">
            <p className="text-sm text-slate-400">Unknown widget: {widgetId}</p>
          </div>
        );
    }
  };

  return (
    <ErrorBoundary>
      {renderContent()}
    </ErrorBoundary>
  );
}