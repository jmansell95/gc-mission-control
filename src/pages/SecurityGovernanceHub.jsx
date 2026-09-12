import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ShieldCheck, Lock, Users, Database, FileSearch, Shield,
} from 'lucide-react';
import EnterpriseHeader from '@/components/EnterpriseHeader';
import RiskMitigationTab from '@/components/security/RiskMitigationTab';
import SecurityPostureTab from '@/components/security/SecurityPostureTab';
import AccessReviewTab from '@/components/security/AccessReviewTab';
import DataExportTab from '@/components/security/DataExportTab';
import GDPRSearchTab from '@/components/security/GDPRSearchTab';

const TABS = [
  { id: 'risk-matrix', label: 'Risk Mitigation', icon: ShieldCheck, gradient: 'from-emerald-600 to-teal-700', description: 'All 25 cyber security risks mapped to their mitigations and controls.' },
  { id: 'posture', label: 'Security Posture', icon: Lock, gradient: 'from-blue-600 to-indigo-700', description: 'Authentication, access control, audit logging, backup, and monitoring overview.' },
  { id: 'access-review', label: 'Access Review', icon: Users, gradient: 'from-amber-600 to-orange-700', description: 'Review who has access, mark as confirmed or revoked, track quarterly reviews.' },
  { id: 'data-export', label: 'Data Export (Exit Plan)', icon: Database, gradient: 'from-violet-600 to-purple-700', description: 'Export all entity data as CSV or JSON. Full portability — no proprietary lock-in.' },
  { id: 'gdpr', label: 'GDPR / SAR', icon: FileSearch, gradient: 'from-rose-600 to-pink-700', description: 'Search for a person\'s data across all entities. Export (SAR) or delete (erasure).' },
];

export default function SecurityGovernanceHub() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('risk-matrix');

  const renderTab = () => {
    switch (activeTab) {
      case 'risk-matrix': return <RiskMitigationTab />;
      case 'posture': return <SecurityPostureTab />;
      case 'access-review': return <AccessReviewTab />;
      case 'data-export': return <DataExportTab />;
      case 'gdpr': return <GDPRSearchTab />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen page-bg-vibrant">
      <EnterpriseHeader />

      {/* Desktop top bar */}
      <div className="hidden lg:block sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200/70">
        <div className="px-4 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/admin')} type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-600 text-sm font-semibold hover:bg-slate-100 transition">
              <ArrowLeft className="w-4 h-4" /> Admin
            </button>
            <span className="text-slate-300">/</span>
            <span className="text-sm font-bold text-slate-900">Security & Governance</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Shield className="w-4 h-4 text-emerald-500" />
            <span className="font-semibold">Cyber Security Risk Mitigation Hub</span>
          </div>
        </div>
      </div>

      <div className="px-4 pt-5 pb-8 lg:pt-8 lg:px-8 lg:pb-10 space-y-5 max-w-7xl mx-auto">
        {/* Page title */}
        <div className="flex items-start gap-3">
          <button onClick={() => navigate(-1)} type="button"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition shadow-sm active:scale-95 touch-manipulation flex-shrink-0 mt-0.5">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center flex-shrink-0 shadow-lg">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
                Security & Governance Hub
              </h1>
              <p className="text-sm text-slate-500 font-medium mt-1">
                Mitigating all 25 cyber security risks identified for business-led development
              </p>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {TABS.map(t => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                type="button"
                className={`text-left p-4 rounded-2xl transition active:scale-[0.98] touch-manipulation ${
                  active
                    ? 'bg-gradient-to-br ' + t.gradient + ' text-white shadow-lg'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2.5 mb-1.5">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    active ? 'bg-white/20' : 'bg-slate-100'
                  }`}>
                    <Icon className={`w-5 h-5 ${active ? 'text-white' : 'text-slate-600'}`} />
                  </div>
                  <span className="font-bold text-sm">{t.label}</span>
                </div>
                <p className={`text-xs leading-relaxed ${active ? 'text-white/80' : 'text-slate-500'}`}>
                  {t.description}
                </p>
              </button>
            );
          })}
        </div>

        {/* Active tab content */}
        <div className="animate-slide-up">
          {renderTab()}
        </div>
      </div>
    </div>
  );
}