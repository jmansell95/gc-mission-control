import React from 'react';

/**
 * TabStatRibbon — a compact horizontal strip of quick-stats shown at the top
 * of each Job Detail tab. Gives managers an at-a-glance summary before they
 * dive into the detailed content below.
 */
export default function TabStatRibbon({ stats = [], icon: Icon, title, action }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
        {Icon && (
          <div className="w-7 h-7 rounded-lg bg-[#2E5A1A]/10 flex items-center justify-center flex-shrink-0">
            <Icon className="w-3.5 h-3.5 text-[#2E5A1A]" />
          </div>
        )}
        {title && <h3 className="text-ui-body font-semibold text-slate-900">{title}</h3>}
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {stats.length > 0 && (
        <div className="flex flex-wrap divide-x divide-slate-100">
          {stats.map((s, i) => {
            const StatIcon = s.icon;
            return (
              <div key={i} className={`flex items-center gap-2 px-4 py-2.5 flex-1 min-w-[120px] ${s.tone || ''}`}>
                {StatIcon && <StatIcon className={`w-4 h-4 flex-shrink-0 ${s.iconColor || 'text-slate-400'}`} />}
                <div className="min-w-0">
                  <p className="text-ui-heading font-bold text-slate-900 tabular-nums leading-tight">{s.value}</p>
                  <p className="text-ui-micro text-slate-400 uppercase font-medium tracking-wide truncate">{s.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}