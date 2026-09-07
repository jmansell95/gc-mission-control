import React, { useState } from 'react';
import MittiSyncStatusCard from '@/components/compliance/MittiSyncStatusCard';
import AuditTrendChart from '@/components/compliance/AuditTrendChart';
import AuditList from '@/components/compliance/AuditList';
import AuditDetailDrawer from '@/components/compliance/AuditDetailDrawer';
import FailedAuditBanner from '@/components/compliance/FailedAuditBanner';

export default function AuditDashboardTab() {
  const [selectedAudit, setSelectedAudit] = useState(null);
  return (
    <div className="space-y-3 sm:space-y-4">
      <FailedAuditBanner onView={() => {}} />
      <MittiSyncStatusCard />
      <AuditTrendChart />
      <AuditList onSelect={setSelectedAudit} />
      <AuditDetailDrawer audit={selectedAudit} onClose={() => setSelectedAudit(null)} />
    </div>
  );
}