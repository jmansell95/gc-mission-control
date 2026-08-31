import React from 'react';
import { ChevronRight, Sparkles, CheckCircle2, Clock, Settings2 } from 'lucide-react';

/**
 * IntegrationsOverviewList — the Integrations section of the Settings overview.
 *
 * Read-only status badges (no toggles — the Coming Soon Manager page handles
 * that). Each row shows one of three statuses:
 *   • Connected  — credentials are set up and the integration is live (green)
 *   • Active     — available to configure, not yet connected (brand green)
 *   • Coming Soon — admin has marked it as not-yet-available (greyed out)
 *
 * Connected integrations are NEVER shown as "Coming Soon" regardless of the
 * stored flag — the backend auto-cleans this, and the frontend enforces it
 * too as a safety net.
 */
export default function IntegrationsOverviewList({ items, statusMap, onNavigate }) {
  const connectedCount = items.filter(i => statusMap[i.id]?.connected).length;
  const comingSoonCount = items.filter(i => statusMap[i.id]?.comingSoon && !statusMap[i.id]?.connected).length;

  return (
    <div>
      {/* Live count header */}
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-xs font-semibold text-slate-500">
          <span className="text-emerald-600 font-bold">{connectedCount}</span>
          <span className="text-slate-400"> / {items.length} connected</span>
        </span>
        {comingSoonCount > 0 && (
          <span className="text-xs font-semibold text-slate-500">
            <span className="text-amber-600 font-bold">{comingSoonCount}</span>
            <span className="text-slate-400"> coming soon</span>
          </span>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/60 overflow-hidden">
        {items.map((item, idx) => {
          const Icon = item.icon;
          const isLast = idx === items.length - 1;
          const status = statusMap[item.id] || {};
          const connected = !!status.connected;
          // Connected integrations are never coming-soon
          const comingSoon = !connected && !!status.comingSoon;
          const greyed = comingSoon;

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={'relative w-full flex items-center gap-3 px-4 py-3.5 text-left transition group ' +
                (isLast ? '' : 'border-b border-slate-100 ') +
                (greyed ? 'bg-slate-50/60' : 'hover:bg-slate-50')}
            >
              {/* Coming Soon ribbon on greyed rows */}
              {greyed && (
                <span className="absolute top-0 right-0 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide bg-slate-200 text-slate-500 rounded-bl-lg">
                  Coming Soon
                </span>
              )}

              <Icon className={'w-5 h-5 flex-shrink-0 ' + (connected ? 'text-emerald-500' : greyed ? 'text-slate-300' : 'text-slate-400 group-hover:text-[#2E5A1A] transition')} />
              <div className="min-w-0 flex-1">
                <p className={'text-sm font-semibold truncate ' + (greyed ? 'text-slate-400' : 'text-slate-800')}>{item.label}</p>
                <p className="text-xs text-slate-400 truncate">{item.sub}</p>
              </div>

              {/* Status badge — read only, no toggle */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {connected ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Connected
                  </span>
                ) : comingSoon ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 text-slate-400 text-[10px] font-bold">
                    <Clock className="w-3 h-3" />
                    Coming Soon
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#2E5A1A]/10 text-[#2E5A1A] text-[10px] font-bold">
                    <Sparkles className="w-3 h-3" />
                    Active
                  </span>
                )}
              </div>

              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#2E5A1A] group-hover:translate-x-0.5 transition flex-shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}