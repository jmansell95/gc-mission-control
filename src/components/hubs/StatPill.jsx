import React from 'react';
import AnimatedNumber from '@/components/hubs/AnimatedNumber';

/**
 * StatPill — the single KPI primitive used across every hub header.
 * Compact on mobile, breathable on desktop. Colour is a literal class map so
 * Tailwind keeps the styles.
 *
 * Props: icon, label, value, sublabel, color, onClick, active, delta ({ value, positive })
 */
const TONES = {
  brand: 'bg-[#2E5A1A]/10 text-[#2E5A1A]',
  emerald: 'bg-emerald-50 text-emerald-600',
  blue: 'bg-blue-50 text-blue-600',
  amber: 'bg-amber-50 text-amber-600',
  rose: 'bg-rose-50 text-rose-600',
  violet: 'bg-violet-50 text-violet-600',
  teal: 'bg-teal-50 text-teal-600',
  slate: 'bg-slate-100 text-slate-500',
};

export default function StatPill({ icon: Icon, label, value, sublabel, color = 'slate', onClick, active, delta, index = 0 }) {
  const tone = TONES[color] || TONES.slate;
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      style={{ animationDelay: `${index * 50}ms` }}
      className={`hub-glass rounded-2xl px-3 py-2.5 sm:px-3.5 sm:py-3 text-left animate-slide-up transition-all duration-200 min-w-0 ${
        onClick ? 'hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] cursor-pointer' : ''
      } ${active ? 'ring-2 ring-[#2E5A1A]/40' : ''}`}
    >
      <div className="flex items-center gap-2 mb-1 min-w-0">
        {Icon && (
          <span className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${tone}`}>
            <Icon className="w-3.5 h-3.5" />
          </span>
        )}
        <span className="text-ui-micro uppercase tracking-wider text-slate-500 truncate">{label}</span>
      </div>
      <div className="flex items-baseline gap-1.5 min-w-0">
        <span className="text-ui-kpi font-extrabold text-slate-900 tabular-nums leading-none truncate">
          <AnimatedNumber value={value} />
        </span>
        {delta && (
          <span className={`text-ui-micro font-bold tabular-nums ${delta.positive ? 'text-emerald-600' : 'text-rose-600'}`}>
            {delta.positive ? '▲' : '▼'} {delta.value}
          </span>
        )}
      </div>
      {sublabel && <p className="text-ui-caption text-slate-400 mt-1 truncate">{sublabel}</p>}
    </Wrapper>
  );
}