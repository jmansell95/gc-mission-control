import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Clock, ExternalLink } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { settingsGroups, HUB_MIGRATED_ITEMS } from '@/components/SettingsNav';

/**
 * Settings Sidebar — persistent left navigation for the settings area.
 * Only shows items that have NOT migrated to operational hubs.
 *
 * Coming-soon integrations (flagged in the Coming Soon Manager) are rendered
 * with a muted/greyed style and a small Clock badge so the locked state is
 * visible right in the menu.
 *
 * `hideHeader` suppresses the internal "Settings Menu" card header — used
 * when the sidebar is embedded inside the mobile drawer (which provides its
 * own header), preventing a duplicated title.
 */
export default function SettingsSidebar({ activeTab, onNavigate, items, hideHeader }) {
  const navigate = useNavigate();
  const { data: stats } = useQuery({
    queryKey: ['settings-hub-stats'],
    queryFn: () => base44.functions.invoke('getSettingsHubStats').then(r => r.data),
  });
  const comingSoonMap = stats?.integrationComingSoon || {};
  const integrationStatusById = React.useMemo(() => {
    const m = {};
    for (const i of (stats?.integrations || [])) m[i.id] = i;
    return m;
  }, [stats]);

  const isComingSoon = (id) => {
    if (!comingSoonMap[id]) return false;
    // An active integration is never coming-soon (backend auto-cleans).
    return integrationStatusById[id]?.status !== 'active';
  };

  const itemMap = Object.fromEntries(items.map(i => [i.id, i]));
  const groups = settingsGroups
    .filter(g => g.label !== '_hidden_migrated')
    .map(g => ({ ...g, items: g.items.filter(i => itemMap[i.id] && !HUB_MIGRATED_ITEMS.has(i.id)) }))
    .filter(g => g.items.length > 0);

  return (
    <div className={hideHeader ? '' : 'sticky top-4'}>
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {!hideHeader && (
          <div className="px-3 py-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Settings Menu</h3>
          </div>
        )}
        <div className="p-2 max-h-[calc(100vh-180px)] overflow-y-auto">
          {groups.map(group => (
            <div key={group.label} className="mb-1.5">
              <p className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{group.label}</p>
              {group.items.map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                const cs = isComingSoon(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => item.external ? navigate(item.external) : onNavigate(item.id)}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm font-medium transition text-left ${
                      isActive
                        ? 'bg-[#2E5A1A]/10 text-[#2E5A1A]'
                        : cs
                          ? 'text-slate-400 hover:bg-slate-50'
                          : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className={`w-4 h-4 flex-shrink-0 ${cs ? 'text-slate-300' : ''}`} />
                    <span className={`truncate flex-1 ${cs ? 'line-through decoration-slate-300' : ''}`}>{item.label}</span>
                    {item.external && (
                      <ExternalLink className="w-3 h-3 text-slate-300 flex-shrink-0" />
                    )}
                    {cs && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-400 text-[9px] font-bold flex-shrink-0">
                        <Clock className="w-2.5 h-2.5" />
                        Soon
                      </span>
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