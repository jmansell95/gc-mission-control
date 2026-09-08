import React from 'react';

/**
 * PillTabs — secondary pill-style tab navigation for sub-pages.
 *
 * Distinct from the main TabBar: a recessed brand-tinted track with bright
 * leaf-green active pills so sub-pages clearly read as a level below the
 * main hub tabs.
 *
 * tabs: [{ id, label, icon }]
 * activeId, onChange
 * contextLabel: optional label shown as a prefix chip before the tabs
 */
export default function PillTabs({ tabs, activeId, onChange, className = '', contextLabel }) {
  return (
    <div className={`sticky top-0 z-20 -mx-4 px-4 sm:mx-0 sm:px-0 mb-5 pt-1 ${className}`}>
      <div className="relative bg-gradient-to-b from-slate-50/90 to-[#2E5A1A]/[0.04] backdrop-blur-md rounded-2xl border border-[#2E5A1A]/12 shadow-[inset_0_1px_3px_rgba(46,90,26,0.08)] p-1.5 flex items-center gap-1.5">
        {contextLabel && (
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#2E5A1A]/8 text-[#2E5A1A] text-ui-body font-semibold flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-[#8DC63F]" />
            {contextLabel}
          </div>
        )}
        <div className="flex gap-1 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeId === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onChange(tab.id)}
                type="button"
                className={`group relative inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-ui-body font-semibold transition-all flex-shrink-0 whitespace-nowrap active:scale-[0.97] ${
                  isActive
                    ? 'bg-gradient-to-br from-[#8DC63F] to-[#6fa828] text-[#1c4a12] shadow-sm shadow-emerald-500/30 ring-1 ring-[#8DC63F]/40'
                    : 'text-slate-500 hover:bg-white/70 hover:text-[#2E5A1A]'
                }`}
              >
                {Icon && <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-[#1c4a12]' : 'text-slate-400 group-hover:text-[#2E5A1A]'}`} />}
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}