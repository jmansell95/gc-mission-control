import React, { useState } from 'react';
import { ShieldCheck, BarChart3, GraduationCap, AlertTriangle, Grid3x3, FileCheck2 } from 'lucide-react';
import TabBar from '@/components/TabBar';
import ComplianceTracking from '@/components/compliance/ComplianceTracking';
import ComplianceReports from '@/components/compliance/ComplianceReports';
import TrainingManager from '@/components/TrainingManager';
import TrainingGapAnalysis from '@/components/compliance/TrainingGapAnalysis';
import SkillsMatrix from '@/components/compliance/SkillsMatrix';
import RAMSManager from '@/components/compliance/RAMSManager';
import AssetComplianceReport from '@/components/compliance/AssetComplianceReport';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';

const tabs = [
  { id: 'tracking', label: 'Tracking', icon: ShieldCheck },
  { id: 'matrix', label: 'Skills Matrix', icon: Grid3x3 },
  { id: 'rams', label: 'RAMS', icon: FileCheck2 },
  { id: 'asset_report', label: 'LOLER/PUWER/PAT', icon: FileCheck2 },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'training', label: 'Training', icon: GraduationCap },
  { id: 'gaps', label: 'Training Gaps', icon: AlertTriangle },
];

export default function ComplianceManager() {
  const [activeTab, setActiveTab] = useState('tracking');

  return (
    <div className="space-y-4">
      <SettingsSectionHeader icon={ShieldCheck} title="Compliance" description="Compliance management" />
      <TabBar tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-5">
        {activeTab === 'tracking' && <ComplianceTracking />}
        {activeTab === 'matrix' && <SkillsMatrix />}
        {activeTab === 'rams' && <RAMSManager />}
        {activeTab === 'asset_report' && <AssetComplianceReport />}
        {activeTab === 'reports' && <ComplianceReports />}
        {activeTab === 'training' && <TrainingManager />}
        {activeTab === 'gaps' && <TrainingGapAnalysis />}
      </div>
    </div>
  );
}