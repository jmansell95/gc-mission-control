import React from 'react';

/**
 * Shared tab bar — the canonical slick style used across every hub and page.
 * Glass card container with a dark-green gradient active state, icons, and
 * optional badges/counts. Horizontally scrollable on small screens.
 */
export default function TabBar({ tabs, activeTab, onChange, className = '' }) {
  return (
    <div className={`bg-white/80 backdrop-blur-md rounded-hub border border-slate-200/70 shadow-sm p-1.5 flex gap-1 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] ${className}`}>
      {tabs.map(t => {
        const Icon = t.icon;
        const active = activeTab === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            type="button"
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-hub-body font-semibold transition flex-shrink-0 whitespace-nowrap active:scale-[0.97] ${
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
            {t.count != null && (
              <span className={`ml-0.5 text-xs font-normal ${active ? 'text-white/70' : 'text-slate-400'}`}>{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}