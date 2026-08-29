import React from 'react';

/**
 * SubPills — secondary segmented control rendered below a hub's main TabBar.
 *
 * Distinct from the main TabBar: a recessed brand-tinted track with bright
 * leaf-green active pills so sub-pages clearly read as a level below the
 * main hub tabs.
 *
 * Pills WRAP to multiple lines on narrow viewports so every sub-tab is always
 * visible without scrolling — important on mobile where 4 sub-pills
 * (e.g. Staff · Crews · Permission Groups · Insights) would otherwise overflow.
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
    <div className="relative bg-gradient-to-b from-slate-50/90 to-[#2E5A1A]/[0.04] backdrop-blur-md rounded-2xl border border-[#2E5A1A]/12 shadow-[inset_0_1px_3px_rgba(46,90,26,0.08)] p-1.5 flex flex-wrap gap-1">
      {pills.map(p => {
        const Icon = p.icon;
        const isActive = active === p.id;
        return (
          <button
            key={p.id}
            onClick={() => onChange(p.id)}
            type="button"
            className={`group relative inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all flex-1 sm:flex-none justify-center sm:justify-start whitespace-nowrap active:scale-[0.97] ${
              isActive
                ? 'bg-gradient-to-br from-[#8DC63F] to-[#6fa828] text-[#1c4a12] shadow-sm shadow-emerald-500/30 ring-1 ring-[#8DC63F]/40'
                : 'text-slate-500 hover:bg-white/70 hover:text-[#2E5A1A]'
            }`}
          >
            {Icon && <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-[#1c4a12]' : 'text-slate-400 group-hover:text-[#2E5A1A]'}`} />}
            {p.label}
            {p.badge != null && p.badge > 0 && (
              <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${isActive ? 'bg-[#1c4a12]/15 text-[#1c4a12]' : 'bg-rose-100 text-rose-600'}`}>{p.badge}</span>
            )}
            {p.count != null && (
              <span className={`ml-0.5 text-xs font-normal ${isActive ? 'text-[#1c4a12]/70' : 'text-slate-400'}`}>{p.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}