import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Settings as SettingsIcon, CheckCircle2, Clock, Webhook, AlertTriangle,
  Menu, ArrowRight, Sparkles,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';

/**
 * Settings overview — minimal landing surface for the Settings area.
 *
 * Shows a compact stats strip (what's live, what's coming, what needs
 * attention) and a single clear message directing users to the menu to open
 * each settings page. The actual navigation lives in the SettingsSidebar
 * (desktop) and the SettingsMobileNav drawer (mobile) — both rendered by
 * SettingsPage — so the overview itself stays clean.
 */
export default function SettingsHubOverview({ onNavigate }) {
  const { data: stats } = useQuery({
    queryKey: ['settings-hub-stats'],
    queryFn: () => base44.functions.invoke('getSettingsHubStats').then(r => r.data),
  });

  const integrations = stats?.integrations || [];
  const activeCount = integrations.filter(i => i.status === 'active').length;
  const needsAttention = integrations.filter(i => i.status === 'needs_attention').length;
  const comingSoonMap = stats?.integrationComingSoon || {};
  const comingSoonCount = integrations.filter(i => comingSoonMap[i.id] && i.status !== 'active').length;
  const notConfigured = integrations.filter(i => i.status === 'not_configured').length;

  const statsTiles = [
    { icon: CheckCircle2, label: 'Active', value: activeCount, tone: 'emerald' },
    { icon: AlertTriangle, label: 'Needs attention', value: needsAttention, tone: 'amber' },
    { icon: Clock, label: 'Coming soon', value: comingSoonCount, tone: 'slate' },
    { icon: Webhook, label: 'Integrations', value: integrations.length, tone: 'blue' },
  ];

  const toneClasses = {
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    slate: 'bg-slate-100 text-slate-500',
    blue: 'bg-blue-50 text-blue-600',
  };

  return (
    <div className="space-y-hub-gap-sm sm:space-y-hub-gap">
      <PageHeader
        icon={SettingsIcon}
        title="Settings"
        subtitle="Full control of your site — manage everything from one place."
        stats={[
          { icon: CheckCircle2, label: 'Active', value: activeCount },
          { icon: Clock, label: 'Coming soon', value: comingSoonCount },
          { icon: Webhook, label: 'Integrations', value: integrations.length },
        ]}
      />

      {/* Stats strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statsTiles.map((t) => {
          const Icon = t.icon;
          return (
            <div key={t.label} className="insight-card rounded-2xl p-4 flex items-center gap-3">
              <div className={'w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ' + toneClasses[t.tone]}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-extrabold text-slate-900 tabular-nums leading-none">{t.value}</p>
                <p className="text-[11px] text-slate-500 font-semibold mt-0.5 truncate">{t.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Coming Soon list */}
      {comingSoonCount > 0 && (
        <div className="insight-card rounded-2xl p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-bold text-slate-900">Coming Soon</h3>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs text-slate-500">{comingSoonCount} locked integration{comingSoonCount !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {integrations.filter(i => comingSoonMap[i.id] && i.status !== 'active').map(i => (
              <span key={i.id} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-500 text-xs font-semibold">
                <Clock className="w-3 h-3 text-slate-400" />
                {i.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Menu message */}
      <div className="insight-card rounded-2xl p-6 sm:p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center mx-auto mb-4 shadow-md icon-tile-glow">
          <Menu className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-lg sm:text-xl font-bold text-slate-900">Use the menu to explore settings</h2>
        <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto leading-relaxed">
          On mobile, tap the <span className="font-semibold text-[#2E5A1A]">Settings Menu</span> button.
          On desktop, use the sidebar on the left.
          Every settings page — integrations, branding, billing, staff and more — lives behind the menu.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <button
            onClick={() => onNavigate?.('coming-soon-manager')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition active:scale-95"
          >
            <Clock className="w-4 h-4" />
            Coming Soon Manager
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => onNavigate?.('integrations')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-[#2E5A1A] hover:bg-[#1c4a12] transition active:scale-95"
          >
            <Webhook className="w-4 h-4" />
            Integrations
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        {needsAttention > 0 && (
          <div className="mt-5 inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-amber-50 border border-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-semibold text-amber-700">
              {needsAttention} integration{needsAttention !== 1 ? 's' : ''} need attention — open the menu → Integrations to fix
            </span>
          </div>
        )}
        <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100">
          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
          <span className="text-xs font-bold text-emerald-700">
            {activeCount + notConfigured === 0 ? '0' : Math.round((activeCount / Math.max(activeCount + needsAttention + notConfigured, 1)) * 100)}% of integrations live
          </span>
        </div>
      </div>
    </div>
  );
}