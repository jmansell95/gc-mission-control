import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDivision } from '@/contexts/DivisionContext';
import {
  ArrowLeft, Building2, Link2, Settings, Database, Layers,
} from 'lucide-react';
import EnterpriseHeader from '@/components/EnterpriseHeader';
import DivisionManager from '@/components/settings/DivisionManager';
import BusinessUnitManager from '@/components/settings/BusinessUnitManager';
import IntegrationsHub from '@/components/settings/IntegrationsHub';
import BackupRestoreHub from '@/components/settings/BackupRestoreHub';
import IntegrationConfigDrawer from '@/components/settings/IntegrationConfigDrawer';

const TABS = [
  { id: 'business-units', label: 'Business Units', icon: Layers, gradient: 'from-emerald-600 to-teal-700' },
  { id: 'divisions', label: 'Business Streams', icon: Building2, gradient: 'from-blue-600 to-cyan-700' },
  { id: 'backup', label: 'Backup & Restore', icon: Database, gradient: 'from-indigo-600 to-blue-700' },
  { id: 'integrations', label: 'Integrations', icon: Link2, gradient: 'from-blue-600 to-indigo-700' },
];

export default function EnterpriseSettings() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setActiveDivision } = useDivision();
  const [activeTab, setActiveTab] = useState(location.state?.tab || 'business-units');
  const [selectedIntegration, setSelectedIntegration] = useState(null);

  // Clear division context — this is an enterprise-level page.
  useEffect(() => { setActiveDivision(null); }, [setActiveDivision]);

  const renderTab = () => {
    switch (activeTab) {
      case 'business-units': return <BusinessUnitManager />;
      case 'divisions': return <DivisionManager />;
      case 'backup': return <BackupRestoreHub />;
      case 'integrations': return <IntegrationsHub onNavigate={setSelectedIntegration} />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen page-bg-vibrant">
      <EnterpriseHeader />
      <div className="px-4 pt-4 pb-8 lg:pt-6 lg:px-6 lg:pb-6 space-y-4">
        {/* Back link + title */}
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => navigate(-1)} type="button"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition shadow-sm active:scale-95 touch-manipulation">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center flex-shrink-0 shadow-lg glow-brand">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-none truncate">
                Enterprise Settings
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-semibold mt-0.5">Self-contained — no business stream context</p>
            </div>
          </div>
        </div>

        {/* Tab bar — horizontal scroll on mobile */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
          {TABS.map(t => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                type="button"
                className={'flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition active:scale-95 touch-manipulation flex-shrink-0 '
                  + (active
                    ? 'bg-gradient-to-br ' + t.gradient + ' text-white shadow-md'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50')}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Active tab content */}
        <div className="animate-slide-up">
          {renderTab()}
        </div>
      </div>

      {/* Integration config drawer — enterprise-level, admin-only */}
      {selectedIntegration && (
        <IntegrationConfigDrawer
          integrationId={selectedIntegration}
          onClose={() => setSelectedIntegration(null)}
        />
      )}
    </div>
  );
}