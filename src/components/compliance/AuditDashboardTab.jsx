import React, { useState } from 'react';
import MittiSyncStatusCard from '@/components/compliance/MittiSyncStatusCard';
import AuditTrendChart from '@/components/compliance/AuditTrendChart';
import AuditTemplateGrid from '@/components/compliance/AuditTemplateGrid';
import AuditTemplateDetail from '@/components/compliance/AuditTemplateDetail';
import AuditDetailDrawer from '@/components/compliance/AuditDetailDrawer';
import FailedAuditBanner from '@/components/compliance/FailedAuditBanner';
import RecurringFailuresPanel from '@/components/compliance/RecurringFailuresPanel';
import ActionItemsTab from '@/components/compliance/ActionItemsTab';
import { FileText, AlertTriangle, CheckCircle2 } from 'lucide-react';
import SubPills from '@/components/SubPills';

const DASHBOARD_SUBS = [
  { id: 'overview', label: 'Overview', icon: FileText },
  { id: 'recurring', label: 'Recurring Failures', icon: AlertTriangle },
  { id: 'actions', label: 'Action Items', icon: CheckCircle2 },
];

export default function AuditDashboardTab() {
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedAudit, setSelectedAudit] = useState(null);
  const [subTab, setSubTab] = useState('overview');

  return (
    <div className="space-y-3 sm:space-y-4">
      <SubPills active={subTab} onChange={setSubTab} pills={DASHBOARD_SUBS} />

      {subTab === 'actions' ? (
        <ActionItemsTab />
      ) : subTab === 'recurring' ? (
        <>
          <FailedAuditBanner onView={() => { setSubTab('overview'); setSelectedTemplate(null); }} />
          <MittiSyncStatusCard />
          <RecurringFailuresPanel />
        </>
      ) : (
        <>
          <FailedAuditBanner onView={() => setSelectedTemplate(null)} />
          <MittiSyncStatusCard />

          {selectedTemplate ? (
            <AuditTemplateDetail
              template={selectedTemplate}
              onBack={() => setSelectedTemplate(null)}
              onSelectAudit={setSelectedAudit}
            />
          ) : (
            <>
              <div className="flex items-center gap-2 pt-1">
                <FileText className="w-4 h-4 text-[#2E5A1A]" />
                <h3 className="text-sm font-bold text-slate-900">Audit Templates</h3>
                <span className="text-xs text-slate-400">· Click a template to drill into its audits</span>
              </div>
              <AuditTemplateGrid onSelectTemplate={setSelectedTemplate} />
              <AuditTrendChart />
            </>
          )}
        </>
      )}

      <AuditDetailDrawer audit={selectedAudit} onClose={() => setSelectedAudit(null)} />
    </div>
  );
}