import React from 'react';
import AnimatedNumber from '@/components/hubs/AnimatedNumber';

/**
 * Unified page header — clean, modern, consistent across all admin pages.
 * White card with a subtle brand-green left accent line. No heavy gradients.
 * Replaces the old hero-gradient green banner for a lighter, more modern feel.
 * Stats animate (count up) on mount for a premium feel.
 */
export default function PageHeader({ icon: Icon, title, subtitle, actions, stats }) {
  return (
    <div className="bg-gradient-to-br from-white to-slate-50/40 rounded-2xl border border-slate-200/80 shadow-sm mb-4 overflow-hidden animate-slide-up">
      <div className="relative px-4 md:px-5 py-3.5">
        {/* Brand-green left accent line — the signature Ground Control thread */}
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-[#2E5A1A] to-[#8DC63F]" />
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 pl-2">
          <div className="flex items-center gap-3 min-w-0">
            {Icon && (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center flex-shrink-0 shadow-sm icon-tile-glow">
                <Icon className="w-5 h-5 text-white" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-ui-heading text-slate-900 tracking-tight truncate">{title}</h1>
              {subtitle && <p className="text-ui-caption text-slate-500 truncate mt-0.5">{subtitle}</p>}
            </div>
          </div>
          {actions && (
            <div className="flex flex-wrap items-center gap-2 flex-shrink-0 [&>button]:whitespace-nowrap sm:justify-end">
              {actions}
            </div>
          )}
        </div>
        {stats && stats.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2 mt-3 pl-2">
            {stats.map((s, i) => {
              const SIcon = s.icon;
              const Wrapper = s.onClick ? 'button' : 'div';
              return (
                <Wrapper
                  key={i}
                  onClick={s.onClick}
                  style={{ animationDelay: `${i * 60}ms` }}
                  className={`bg-slate-50 rounded-xl p-2.5 border border-slate-100 text-left transition animate-slide-up ${s.onClick ? 'hover:bg-slate-100 hover:border-slate-200 active:scale-[0.98] cursor-pointer' : ''} ${s.active ? 'ring-2 ring-primary/30 bg-primary/5' : ''}`}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    {SIcon && <SIcon className="w-3.5 h-3.5 text-slate-400" />}
                    <span className="text-ui-micro uppercase text-slate-400 font-semibold truncate">{s.label}</span>
                  </div>
                  <p className="text-ui-heading font-bold text-slate-900 tabular-nums leading-none">
                    <AnimatedNumber value={s.value} />
                  </p>
                </Wrapper>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}