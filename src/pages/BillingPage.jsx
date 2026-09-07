import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  PoundSterling, FileBarChart, Download, Tag, TrendingUp,
  LayoutDashboard, Shield, ScrollText, FileText,
} from 'lucide-react';
import HubShell from '@/components/HubShell';
import { BILLING_HELP_TOPICS, BILLING_ONBOARDING, BILLING_QUICK_LINKS } from '@/components/billing/billingHubContent';
import CVRExportTab from '@/components/billing/CVRExportTab';
import AFPPortfolioOverview from '@/components/afp/AFPPortfolioOverview';
import AFPTemplateUploader from '@/components/afp/AFPTemplateUploader';
import RateCardManager from '@/components/RateCardManager';
import KeywordMappingManager from '@/components/billing/KeywordMappingManager';
import PricingReviewBanner from '@/components/billing/PricingReviewBanner';
import BillingInsightsTab from '@/components/billing/BillingInsightsTab';
import MarginGuardTab from '@/components/billing/MarginGuardTab';
import AgedDebtorsDashboard from '@/components/billing/AgedDebtorsDashboard';
import ContractsAndOrdersTab from '@/components/billing/ContractsAndOrdersTab';
import RunReportButton from '@/components/reports/RunReportButton';
import PerformanceTab from '@/components/billing/PerformanceTab';
import BillingStatsBar from '@/components/billing/BillingStatsBar';
import DraftApprovalQueue from '@/components/billing/DraftApprovalQueue';
import { base44 } from '@/api/base44Client';
import { useDivision } from '@/contexts/DivisionContext';

/**
 * BillingPage — AFP-centric billing hub.
 * Tabs: Insights (overview), AFP Portfolio (primary), Margin Guard,
 * Aged Debtors, Contracts & Orders, Rate Card, CVR Export.
 * Geotechnical business streams also get a Performance tab (rig & crew
 * financial intelligence), relocated from the former standalone Performance Hub.
 */
export default function BillingPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('insights');
  const [showTemplateUploader, setShowTemplateUploader] = useState(false);
  const { activeDivision } = useDivision();
  const isGeotechnical = activeDivision?.division_type === 'geotechnical';

  const { data: draftInvoices = [] } = useQuery({
    queryKey: ['draft-invoice-count'],
    queryFn: () => base44.entities.Invoice.filter({ status: 'draft' }, '-created_date', 200),
  });
  const draftCount = draftInvoices.length;

  const tabs = [
    { id: 'insights', label: 'Insights', icon: LayoutDashboard },
    { id: 'drafts', label: 'Drafts', icon: FileText, badge: draftCount },
    { id: 'afp-portfolio', label: 'AFP Portfolio', icon: FileBarChart },
    { id: 'margin-guard', label: 'Margin Guard', icon: Shield },
    { id: 'aged-debtors', label: 'Aged Debtors', icon: TrendingUp },
    { id: 'contracts', label: 'Contracts', icon: ScrollText },
    { id: 'rate-card', label: 'Rate Card', icon: Tag },
    { id: 'cvr-export', label: 'CVR Export', icon: Download },
    ...(isGeotechnical ? [{ id: 'performance', label: 'Performance', icon: TrendingUp }] : []),
  ];

  const goToJobById = async (jobId) => {
    try {
      const jobs = await base44.entities.Job.filter({ id: jobId });
      if (jobs[0]) navigate('/admin', { state: { section: 'job-detail', job: jobs[0] } });
    } catch (e) { /* ignore */ }
  };

  return (
    <HubShell
      hubKey="billing"
      icon={PoundSterling}
      eyebrow="Financial Hub"
      title="Financial Control"
      subtitle="AFP portfolio, rate card & CVR export"
      breadcrumbs={[{ label: 'Financial Hub' }]}
      actions={
        <div className="flex items-center gap-2">
          <RunReportButton hub="billing" />
        </div>
      }
      kpiStrip={<BillingStatsBar />}
      tabs={tabs}
      activeTab={tab}
      onTabChange={setTab}
      help={{ title: 'Financial Hub — how it works', topics: BILLING_HELP_TOPICS }}
      onboarding={BILLING_ONBOARDING}
      quickLinks={BILLING_QUICK_LINKS}
    >
      {/* ── Insights: portfolio-wide financial health dashboard ── */}
      {tab === 'insights' && <BillingInsightsTab />}

      {/* ── Drafts: approval queue for auto-generated draft invoices ── */}
      {tab === 'drafts' && <DraftApprovalQueue />}

      {/* ── AFP Portfolio: all jobs' AFPs in one place ── */}
      {tab === 'afp-portfolio' && (
        <>
          <PricingReviewBanner />
          <AFPPortfolioOverview
            onSelectJob={goToJobById}
            onUploadTemplate={() => setShowTemplateUploader(true)}
          />
        </>
      )}

      {/* ── Margin Guard: sub-con markup rules + budget alerts ── */}
      {tab === 'margin-guard' && <MarginGuardTab />}

      {/* ── Aged Debtors: outstanding invoices by age bucket ── */}
      {tab === 'aged-debtors' && <AgedDebtorsDashboard />}

      {/* ── Contracts & Orders: billing contracts + purchase orders ── */}
      {tab === 'contracts' && <ContractsAndOrdersTab />}

      {/* ── Rate Card: per-division Master Price List + Keyword Mapping ── */}
      {tab === 'rate-card' && (
        <div className="space-y-4">
          <RateCardManager />
          <KeywordMappingManager />
        </div>
      )}

      {/* ── CVR Export: download CVR packs for higher management ── */}
      {tab === 'cvr-export' && <CVRExportTab />}

      {/* ── Performance: rig & crew financial intelligence (geotechnical only) ── */}
      {tab === 'performance' && isGeotechnical && <PerformanceTab />}

      {showTemplateUploader && (
        <AFPTemplateUploader onClose={() => setShowTemplateUploader(false)} />
      )}
    </HubShell>
  );
}