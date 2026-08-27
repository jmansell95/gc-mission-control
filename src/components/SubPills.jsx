import React from 'react';

/**
 * SubPills — secondary segmented control rendered below a hub's main TabBar.
 *
 * Uses the same slick glass + dark-green gradient style as TabBar so every
 * tab nav across the app looks consistent.
 *
 * Props:
 *  - pills: [{ id, label, icon?, badge?, count? }]
 *  - active: active pill id
 *  - onChange: (id) => void
 *
 * Returns null when there's only one (or zero) pill — no need to choose.
 */
export default function SubPills({ pills = [], active, onChange }) {
  if (!pills || pills.length <= 1) return null;
  return (
    <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/70 shadow-sm p-1.5 flex gap-1 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      {pills.map(p => {
        const Icon = p.icon;
        const isActive = active === p.id;
        return (
          <button
            key={p.id}
            onClick={() => onChange(p.id)}
            type="button"
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition flex-shrink-0 whitespace-nowrap active:scale-[0.97] ${
              isActive
                ? 'bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white shadow-sm shadow-emerald-200/60'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {Icon && <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />}
            {p.label}
            {p.badge != null && p.badge > 0 && (
              <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${isActive ? 'bg-white/25 text-white' : 'bg-rose-100 text-rose-600'}`}>{p.badge}</span>
            )}
            {p.count != null && (
              <span className={`ml-0.5 text-xs font-normal ${isActive ? 'text-white/70' : 'text-slate-400'}`}>{p.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}