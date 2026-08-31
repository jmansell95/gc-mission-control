import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Settings as SettingsIcon, CheckCircle2, Clock, Webhook, AlertTriangle,
  Search, X, ChevronRight, ExternalLink,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { settingsGroups, HUB_MIGRATED_ITEMS } from '@/components/SettingsNav';

// Item IDs that belong to the Integrations section
const INTEGRATION_IDS = new Set([
  'geotab-sync', 'holman-sync', 'asset-panda', 'bob-hr', 'concur-sync',
  'safety-culture', 'cis-verification', 'payroll-export',
  'met-office', 'google-maps', 'whatsapp', 'accounting-sync', 'payment-gateway',
  'microsoft-365', 'zapier-webhooks', 'ags-import', 'openground-sync',
]);

// Item IDs that belong to the Planning & Briefing section (external routes)
const PLANNING_IDS = new Set(['azure-migration', 'presentation-pack']);

export default function SettingsHubOverview({ onNavigate, items }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

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
  const allItems = settingsGroups
    .flatMap(g => g.items)
    .filter(i => itemMap[i.id] && !HUB_MIGRATED_ITEMS.has(i.id));

  const filtered = useMemo(() => {
    if (!query.trim()) return allItems;
    const q = query.toLowerCase();
    return allItems.filter(i =>
      i.label?.toLowerCase().includes(q) ||
      i.desc?.toLowerCase().includes(q)
    );
  }, [query, allItems]);

  const integrationItems = filtered.filter(i => INTEGRATION_IDS.has(i.id));
  const planningItems = filtered.filter(i => PLANNING_IDS.has(i.id));
  const systemItems = filtered.filter(i => !INTEGRATION_IDS.has(i.id) && !PLANNING_IDS.has(i.id));

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

  const renderItem = (item) => {
    const Icon = item.icon;
    const isCs = !!comingSoonMap[item.id] && integrations.find(i => i.id === item.id)?.status !== 'active';
    const isExternal = !!item.external;
    const handleClick = () => {
      if (isExternal) {
        navigate(item.external);
      } else {
        onNavigate?.(item.id);
      }
    };
    return (
      <button
        key={item.id}
        onClick={handleClick}
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
        {isExternal
          ? <ExternalLink className="w-4 h-4 text-slate-300 flex-shrink-0" />
          : <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />}
      </button>
    );
  };

  const renderSection = (title, sectionItems) => {
    if (sectionItems.length === 0) return null;
    return (
      <div>
        <p className="px-1 mb-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">{title}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {sectionItems.map(renderItem)}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-hub-gap-sm sm:space-y-hub-gap">
      <PageHeader
        icon={SettingsIcon}
        title="Settings"
        subtitle="Full control of your site — manage everything from one place."
      />

      {/* Single stat strip */}
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

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search settings..."
          className="w-full pl-10 pr-10 py-3 rounded-xl bg-white border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/10 transition"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-200 transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Two sections */}
      {query.trim() && filtered.length === 0 ? (
        <div className="insight-card rounded-2xl p-8 text-center">
          <p className="text-sm text-slate-500">No settings found for "{query}"</p>
        </div>
      ) : (
        <div className="space-y-4">
          {renderSection('Integrations', integrationItems)}
          {renderSection('Planning & Briefing', planningItems)}
          {renderSection('System Configuration', systemItems)}
        </div>
      )}
    </div>
  );
}