import React from 'react';
import { Switch } from '@/components/ui/switch';
import { ChevronRight, Sparkles } from 'lucide-react';

/**
 * IntegrationsOverviewList — the Integrations section of the Settings overview.
 *
 * Each integration row has a Switch that means:
 *   ON  = Active   — the integration is enabled, row is full-colour, clickable
 *                    to open its config page. Shows an "Active" badge, or a green
 *                    "Connected" badge when credentials are actually set up.
 *   OFF = Coming Soon — the row is greyed out and a small "Coming Soon" banner
 *                    is shown. Still clickable to configure, but visually
 *                    de-emphasised so admins know it isn't live yet.
 *
 * The toggle state is persisted by the parent (to a single AppSetting record
 * keyed `integration_coming_soon`) so it survives reloads and is shared across
 * admins. Storage convention: an id present in that map = Coming Soon (off).
 */
export default function IntegrationsOverviewList({ items, statusMap, onToggle, onNavigate }) {
  const connectedCount = items.filter(i => statusMap[i.id]?.connected).length;
  const activeCount = items.filter(i => !statusMap[i.id]?.comingSoon).length;

  return (
    <div>
      {/* Live count header */}
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-xs font-semibold text-slate-500">
          <span className="text-emerald-600 font-bold">{connectedCount}</span>
          <span className="text-slate-400"> / {items.length} connected</span>
        </span>
        <span className="text-xs font-semibold text-slate-500">
          <span className="text-[#2E5A1A] font-bold">{activeCount}</span>
          <span className="text-slate-400"> active</span>
        </span>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/60 overflow-hidden">
        {items.map((item, idx) => {
          const Icon = item.icon;
          const isLast = idx === items.length - 1;
          const status = statusMap[item.id] || {};
          const connected = !!status.connected;
          const comingSoon = !!status.comingSoon;
          const active = !comingSoon; // switch ON = active
          const greyed = !active;

          return (
            <div
              key={item.id}
              className={'relative w-full flex items-center gap-3 px-4 py-3.5 transition group ' +
                (isLast ? '' : 'border-b border-slate-100 ') +
                (greyed ? 'bg-slate-50/60' : 'hover:bg-slate-50')}
            >
              {/* Coming Soon little banner — top-right ribbon on greyed rows */}
              {greyed && (
                <span className="absolute top-0 right-0 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide bg-slate-200 text-slate-500 rounded-bl-lg">
                  Coming Soon
                </span>
              )}

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

              {/* Status badge + toggle */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {connected ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Connected
                  </span>
                ) : active ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#2E5A1A]/10 text-[#2E5A1A] text-[10px] font-bold">
                    <Sparkles className="w-3 h-3" />
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-1 rounded-full bg-slate-100 text-slate-400 text-[10px] font-bold">
                    Coming Soon
                  </span>
                )}
                <Switch
                  checked={active}
                  onCheckedChange={(checked) => onToggle(item.id, !checked)}
                  aria-label={`${active ? 'Deactivate' : 'Activate'} ${item.label}`}
                />
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