import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Settings as SettingsIcon, CheckCircle2, Clock, Webhook, AlertTriangle,
  ArrowRight, Sparkles, ChevronRight,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { settingsGroups, HUB_MIGRATED_ITEMS } from '@/components/SettingsNav';

/**
 * Settings overview — minimal landing surface for the Settings area.
 *
 * Shows a compact stats strip (what's live, what's coming, what needs
 * attention) and a flat grid of every settings page grouped by category.
 * On mobile this grid IS the menu — no nested drawer needed. On desktop
 * the sidebar provides the same navigation.
 */
export default function SettingsHubOverview({ onNavigate, items }) {
  const { data: stats } = useQuery({
    queryKey: ['settings-hub-stats'],
    queryFn: () => base44.functions.invoke('getSettingsHubStats').then(r => r.data),
  });

  const integrations = stats?.integrations || [];
  const activeCount = integrations.filter(i => i.status === 'active').length;
  const needsAttention = integrations.filter(i => i.status === 'needs_attention').length;
  const comingSoonMap = stats?.integrationComingSoon || {};
  const comingSoonCount = Object.keys(comingSoonMap).length;

  const itemMap = Object.fromEntries((items || []).map(i => [i.id, i]));
  const groups = settingsGroups
    .filter(g => g.label !== '_hidden_migrated')
    .map(g => ({ ...g, items: g.items.filter(i => itemMap[i.id] && !HUB_MIGRATED_ITEMS.has(i.id)) }))
    .filter(g => g.items.length > 0);

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
            {Object.keys(comingSoonMap).map(id => {
              const int = integrations.find(i => i.id === id);
              const label = int?.label || id.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
              return (
                <span key={id} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-500 text-xs font-semibold">
                  <Clock className="w-3 h-3 text-slate-400" />
                  {label}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Settings pages grid — grouped by category. This IS the menu on mobile. */}
      <div className="space-y-4">
        {groups.map(group => (
          <div key={group.label}>
            <p className="px-1 mb-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">{group.label}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {group.items.map(item => {
                const Icon = item.icon;
                const isCs = !!comingSoonMap[item.id] && integrations.find(i => i.id === item.id)?.status !== 'active';
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate?.(item.id)}
                    className={`insight-card rounded-xl p-3.5 flex items-center gap-3 text-left transition hover:shadow-md ${
                      isCs ? 'opacity-60' : ''
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isCs ? 'bg-slate-100' : 'bg-[#2E5A1A]/10'
                    }`}>
                      <Icon className={`w-4 h-4 ${isCs ? 'text-slate-400' : 'text-[#2E5A1A]'}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-semibold truncate ${isCs ? 'text-slate-400' : 'text-slate-800'}`}>
                        {item.label}
                      </p>
                      {isCs && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-slate-400">
                          <Clock className="w-2.5 h-2.5" /> Coming Soon
                        </span>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="insight-card rounded-2xl p-5 sm:p-6 text-center">
        <div className="flex flex-wrap items-center justify-center gap-2">
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
          <div className="mt-4 inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-amber-50 border border-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-semibold text-amber-700">
              {needsAttention} integration{needsAttention !== 1 ? 's' : ''} need attention
            </span>
          </div>
        )}
        <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100">
          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
          <span className="text-xs font-bold text-emerald-700">
            {activeCount} integration{activeCount !== 1 ? 's' : ''} live
          </span>
        </div>
      </div>
    </div>
  );
}