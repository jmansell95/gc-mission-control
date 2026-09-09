import React, { useState } from 'react';
import MittiSyncStatusCard from '@/components/compliance/MittiSyncStatusCard';
import AuditTrendChart from '@/components/compliance/AuditTrendChart';
import AuditTemplateGrid from '@/components/compliance/AuditTemplateGrid';
import AuditTemplateDetail from '@/components/compliance/AuditTemplateDetail';
import AuditDetailDrawer from '@/components/compliance/AuditDetailDrawer';
import FailedAuditBanner from '@/components/compliance/FailedAuditBanner';
import { FileText } from 'lucide-react';

export default function AuditDashboardTab() {
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedAudit, setSelectedAudit] = useState(null);

  return (
    <div className="space-y-3 sm:space-y-4">
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

      <AuditDetailDrawer audit={selectedAudit} onClose={() => setSelectedAudit(null)} />
    </div>
  );
}