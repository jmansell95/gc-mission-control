import React from 'react';
import { Switch } from '@/components/ui/switch';
import { ChevronRight } from 'lucide-react';

/**
 * IntegrationsOverviewList — the Integrations section of the Settings overview.
 * Renders each integration as a flat row with live connection status and a
 * per-row "Active / Coming Soon" toggle for unconnected integrations.
 *
 * Connected integrations show a green "Connected" badge and navigate to their
 * config sub-page on click. Unconnected integrations show a switch that marks
 * them "Coming Soon" (greyed, still clickable to configure). The toggle state
 * is persisted by the parent (to a single AppSetting record) so it survives
 * reloads and is shared across admins.
 */
export default function IntegrationsOverviewList({ items, statusMap, onToggle, onNavigate }) {
  const connectedCount = items.filter(i => statusMap[i.id]?.connected).length;

  return (
    <div>
      {/* Live count header */}
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-xs font-semibold text-slate-500">
          <span className="text-emerald-600 font-bold">{connectedCount}</span>
          <span className="text-slate-400"> / {items.length} connected</span>
        </span>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/60 overflow-hidden">
        {items.map((item, idx) => {
          const Icon = item.icon;
          const isLast = idx === items.length - 1;
          const status = statusMap[item.id] || {};
          const connected = !!status.connected;
          const comingSoon = !!status.comingSoon;
          const greyed = !connected && comingSoon;

          return (
            <div
              key={item.id}
              className={'w-full flex items-center gap-3 px-4 py-3.5 transition group ' +
                (isLast ? '' : 'border-b border-slate-100 ') +
                (greyed ? 'bg-slate-50/60 opacity-60' : 'hover:bg-slate-50')}
            >
              <button
                onClick={() => onNavigate(item.id)}
                className="flex items-center gap-3 flex-1 min-w-0 text-left"
              >
                <Icon className={'w-5 h-5 flex-shrink-0 ' + (connected ? 'text-emerald-500' : greyed ? 'text-slate-300' : 'text-slate-400 group-hover:text-[#2E5A1A] transition')} />
                <div className="min-w-0 flex-1">
                  <p className={'text-sm font-semibold truncate ' + (greyed ? 'text-slate-400' : 'text-slate-800')}>{item.label}</p>
                  <p className="text-xs text-slate-400 truncate">{item.sub}</p>
                </div>
              </button>

              {/* Status / toggle */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {connected ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Connected
                  </span>
                ) : (
                  <>
                    <span className={'inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold ' +
                      (comingSoon ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-600')}>
                      {comingSoon ? 'Coming Soon' : 'Active'}
                    </span>
                    <Switch
                      checked={comingSoon}
                      onCheckedChange={(checked) => onToggle(item.id, checked)}
                      aria-label={`Toggle ${item.label} coming soon`}
                    />
                  </>
                )}
              </div>

              <ChevronRight
                onClick={() => onNavigate(item.id)}
                className="w-4 h-4 text-slate-300 group-hover:text-[#2E5A1A] group-hover:translate-x-0.5 transition flex-shrink-0 cursor-pointer"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}