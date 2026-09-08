import React from 'react';
import FinancialComparison from '@/components/settings/migration/FinancialComparison';
import BuildEffortTable from '@/components/settings/migration/BuildEffortTable';
import RoadmapTimeline from '@/components/settings/migration/RoadmapTimeline';
import ParityMatrixSummary from '@/components/settings/migration/ParityMatrixSummary';
import IntegrationRiskMap from '@/components/settings/migration/IntegrationRiskMap';
import RecommendationCard from '@/components/settings/migration/RecommendationCard';

export default function MigrationHubTab() {
  return (
    <div className="space-y-5">
      <FinancialComparison />
      <BuildEffortTable />
      <RoadmapTimeline />
      <ParityMatrixSummary />
      <IntegrationRiskMap />
      <RecommendationCard />
    </div>
  );
}