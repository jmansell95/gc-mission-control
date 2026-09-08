import React from 'react';
import { ArrowRight } from 'lucide-react';

/**
 * Unified stat card — modernized with refined shadow, gradient icon tile with glow,
 * and tabular-nums for aligned numerical values.
 * Renders as a <button> when onClick is provided (with hover + active states),
 * otherwise a plain <div>.
 */
export default function StatCard({
  icon: Icon,
  value,
  label,
  sub,
  gradient = 'stat-gradient-emerald',
  onClick,
  active = false,
  arrow = false,
  className = '',
  valueClassName = '',
}) {
  const Tag = onClick ? 'button' : 'div';
  const interactive = !!onClick;
  return (
    <Tag
      type={interactive ? 'button' : undefined}
      onClick={onClick}
      className={`relative min-h-[140px] rounded-2xl border p-3 sm:p-4 bg-gradient-to-br from-white to-slate-50/50 flex items-center gap-2.5 sm:gap-3.5 text-left transition-all duration-200 ${active ? 'border-emerald-400 ring-2 ring-emerald-100 shadow-md' : interactive ? 'border-slate-200 hover:border-emerald-300 hover:shadow-md hover:-translate-y-0.5 group' : 'border-slate-200 shadow-sm'} ${interactive ? 'group' : ''} ${className}`}
    >
      <div className={`relative w-10 h-10 sm:w-12 sm:h-12 rounded-xl ${gradient} flex items-center justify-center flex-shrink-0 shadow-md icon-tile-glow`}>
        <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-ui-kpi font-extrabold text-slate-900 truncate tabular-nums ${valueClassName}`}>{value}</p>
        <p className="text-ui-micro text-slate-500 font-semibold truncate uppercase tracking-wide leading-tight">{label}</p>
        {sub && <p className="text-ui-caption text-slate-400 truncate hidden sm:block mt-0.5">{sub}</p>}
      </div>
      {arrow && <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition flex-shrink-0 hidden sm:block" />}
    </Tag>
  );
}