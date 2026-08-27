import React from 'react';

/**
 * Compact sub-tab bar for sub-pages within a main tab.
 * Uses the same slick glass + dark-green gradient style as TabBar.
 * Only renders when there are 2+ tabs — a single-section tab shows nothing.
 */
export default function SubTabNav({ tabs, activeTab, onChange, className = '' }) {
  if (!tabs || tabs.length <= 1) return null;
  return (
    <div className={`bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/70 shadow-sm p-1.5 flex gap-1 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] ${className}`}>
      {tabs.map(t => {
        const Icon = t.icon;
        const active = activeTab === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            type="button"
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition flex-shrink-0 whitespace-nowrap active:scale-[0.97] ${
              active
                ? 'bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white shadow-sm shadow-emerald-200/60'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {Icon && <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-slate-400'}`} />}
            {t.label}
            {t.badge != null && t.badge > 0 && (
              <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${active ? 'bg-white/25 text-white' : 'bg-rose-100 text-rose-600'}`}>{t.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}