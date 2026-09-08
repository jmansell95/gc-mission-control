import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Search, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { settingsGroups, HUB_MIGRATED_ITEMS } from '@/components/SettingsNav';

// Must match SettingsHubOverview exactly — only integration items can be hidden
const INTEGRATION_IDS = new Set([
  'geotab-sync', 'holman-sync', 'asset-panda', 'bob-hr', 'concur-sync',
  'safety-culture', 'cis-verification', 'payroll-export',
  'met-office', 'google-maps', 'whatsapp', 'accounting-sync', 'payment-gateway',
  'microsoft-365', 'zapier-webhooks', 'ags-import', 'openground-sync',
]);

/**
 * Settings Sidebar — persistent left navigation for the settings area.
 * Uses the same item filtering as the SettingsHubOverview so the sidebar
 * and the Command Hub overview always show the same items.
 *
 * `hideHeader` suppresses the internal "Settings Menu" card header — used
 * when the sidebar is embedded inside the mobile drawer (which provides its
 * own header), preventing a duplicated title.
 */
export default function SettingsSidebar({ activeTab, onNavigate, items, hideHeader }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const { data: stats } = useQuery({
    queryKey: ['settings-hub-stats'],
    queryFn: () => base44.functions.invoke('getSettingsHubStats').then(r => r.data),
  });
  const hiddenMap = stats?.integrationHidden || {};

  const itemMap = Object.fromEntries(items.map(i => [i.id, i]));
  // Same filtering logic as SettingsHubOverview: exclude migrated items,
  // and only hide integrations flagged in the hidden map (non-integration
  // items are never hidden).
  const allGroups = settingsGroups
    .filter(g => g.label !== '_hidden_migrated')
    .map(g => ({ ...g, items: g.items.filter(i => itemMap[i.id] && !HUB_MIGRATED_ITEMS.has(i.id) && !(INTEGRATION_IDS.has(i.id) && hiddenMap[i.id])) }))
    .filter(g => g.items.length > 0);

  // Filter groups by search query — matches item label or group label
  const groups = useMemo(() => {
    if (!search.trim()) return allGroups;
    const q = search.toLowerCase();
    return allGroups
      .map(g => ({
        ...g,
        items: g.items.filter(i => (i.label || '').toLowerCase().includes(q)),
      }))
      .filter(g => g.items.length > 0 || g.label.toLowerCase().includes(q));
  }, [allGroups, search]);

  return (
    <div className={hideHeader ? '' : 'sticky top-4'}>
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {!hideHeader && (
          <div className="px-3 py-3 border-b border-slate-100">
            <h3 className="text-ui-body font-bold text-slate-900">Settings Menu</h3>
          </div>
        )}
        <div className="p-2 max-h-[calc(100vh-180px)] overflow-y-auto">
          {/* Search filter — lets users find any of the 40+ settings sections */}
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search settings..."
              className="w-full pl-8 pr-7 py-2 text-ui-caption bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#2E5A1A]/30 focus:bg-white transition"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {groups.length === 0 && (
            <p className="px-2 py-4 text-ui-caption text-slate-400 text-center">No settings match "{search}"</p>
          )}
          {groups.map(group => (
            <div key={group.label} className="mb-1.5">
              <p className="px-2 py-1 text-ui-micro font-bold text-slate-400 uppercase tracking-wider">{group.label}</p>
              {group.items.map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => item.external ? navigate(item.external) : onNavigate(item.id)}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-ui-body font-medium transition text-left ${
                      isActive
                        ? 'bg-[#2E5A1A]/10 text-[#2E5A1A]'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate flex-1">{item.label}</span>
                    {item.external && (
                      <ExternalLink className="w-3 h-3 text-slate-300 flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}