import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDivision } from '@/contexts/DivisionContext';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  ArrowLeft, Settings, Database, Layers, Building2,
  ShieldCheck, Server, HardDrive, LayoutGrid, Palette,
} from 'lucide-react';
import EnterpriseHeader from '@/components/EnterpriseHeader';
import DivisionManager from '@/components/settings/DivisionManager';
import BusinessUnitManager from '@/components/settings/BusinessUnitManager';
import BackupRestoreHub from '@/components/settings/BackupRestoreHub';
import DivisionDashboardSettings from '@/components/settings/DivisionDashboardSettings';
import LoginBrandingSettings from '@/components/settings/LoginBrandingSettings';

const TABS = [
  {
    id: 'business-units',
    label: 'Business Units',
    icon: Layers,
    gradient: 'from-emerald-600 to-teal-700',
    description: 'Manage operating entities, their branding, and division structure',
  },
  {
    id: 'divisions',
    label: 'Business Streams',
    icon: Building2,
    gradient: 'from-blue-600 to-cyan-700',
    description: 'Configure individual business streams and their access manifests',
  },
  {
    id: 'division-dashboard',
    label: 'Division Dashboard',
    icon: LayoutGrid,
    gradient: 'from-violet-600 to-purple-700',
    description: 'Configure widget library, role-based layouts, and custom KPI tiles per division',
  },
  {
    id: 'login-branding',
    label: 'Login & Branding',
    icon: Palette,
    gradient: 'from-rose-600 to-orange-700',
    description: 'Configure login animation, brand colours, logo, and email domain auto-detection per division',
  },
  {
    id: 'backup',
    label: 'Backup & Restore',
    icon: Database,
    gradient: 'from-indigo-600 to-blue-700',
    description: 'Snapshot, export, and restore division data safely',
  },
];

export default function EnterpriseSettings() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setActiveDivision } = useDivision();
  const [activeTab, setActiveTab] = useState(location.state?.tab || 'business-units');

  useEffect(() => { setActiveDivision(null); }, [setActiveDivision]);

  // Enterprise-level stats + full division list for the new tabs
  const { data: stats, data: fullData } = useQuery({
    queryKey: ['enterprise-settings-stats-v2'],
    queryFn: async () => {
      const [divisions, snapshots] = await Promise.all([
        base44.entities.Division.list('-sort_order', 500),
        base44.entities.DivisionSnapshot.list('-created_date', 500),
      ]);
      const parentIds = new Set(divisions.filter(d => d.parent_division_id).map(d => d.parent_division_id));
      return {
        _divisions: divisions,
        businessUnits: divisions.filter(d => !d.parent_division_id && parentIds.has(d.id)).length,
        divisions: divisions.length,
        activeDivisions: divisions.filter(d => d.status === 'active').length,
        snapshots: snapshots.length,
      };
    },
    staleTime: 30000,
  });

  const allDivisions = fullData?._divisions || [];

  const renderTab = () => {
    switch (activeTab) {
      case 'business-units': return <BusinessUnitManager />;
      case 'divisions': return <DivisionManager />;
      case 'division-dashboard': return <DivisionDashboardSettings divisions={allDivisions} canEditAll={true} />;
      case 'login-branding': return <LoginBrandingSettings divisions={allDivisions} canEditAll={true} />;
      case 'backup': return <BackupRestoreHub />;
      default: return null;
    }
  };

  const activeTabConfig = TABS.find(t => t.id === activeTab);

  return (
    <div className="min-h-screen page-bg-vibrant">
      <EnterpriseHeader />

      {/* Desktop top bar — visible only on lg+ since EnterpriseHeader is mobile-only */}
      <div className="hidden lg:block sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200/70">
        <div className="px-4 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/enterprise')} type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-600 text-sm font-semibold hover:bg-slate-100 transition">
              <ArrowLeft className="w-4 h-4" /> Enterprise
            </button>
            <span className="text-slate-300">/</span>
            <span className="text-sm font-bold text-slate-900">Settings</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span className="font-semibold">Enterprise-level · No division context</span>
          </div>
        </div>
      </div>

      <div className="px-4 pt-5 pb-8 lg:pt-8 lg:px-8 lg:pb-10 space-y-5 max-w-7xl mx-auto">
        {/* Page title — generous breathing room after the header */}
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <button onClick={() => navigate(-1)} type="button"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition shadow-sm active:scale-95 touch-manipulation flex-shrink-0 mt-0.5">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center flex-shrink-0 shadow-lg glow-brand">
                <Settings className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
                  Enterprise Settings
                </h1>
                <p className="text-sm text-slate-500 font-medium mt-1">
                  Configure your organisation's structure, business streams, and data protection
                </p>
              </div>
            </div>
          </div>

          {/* Informative stat strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              { icon: Building2, label: 'Business Units', value: stats?.businessUnits ?? 0, tint: 'text-emerald-600 bg-emerald-50' },
              { icon: Layers, label: 'Business Streams', value: stats?.divisions ?? 0, tint: 'text-blue-600 bg-blue-50' },
              { icon: Server, label: 'Active Divisions', value: stats?.activeDivisions ?? 0, tint: 'text-violet-600 bg-violet-50' },
              { icon: HardDrive, label: 'Snapshots', value: stats?.snapshots ?? 0, tint: 'text-amber-600 bg-amber-50' },
            ].map((s, i) => {
              const SIcon = s.icon;
              return (
                <div key={i} className="hub-glass rounded-xl p-3 flex items-center gap-2.5">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${s.tint}`}>
                    <SIcon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-bold text-slate-900 tabular-nums leading-none">{s.value}</p>
                    <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">{s.label}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tab bar — card-style with descriptions */}
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