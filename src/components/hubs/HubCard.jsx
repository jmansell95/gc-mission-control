import React from 'react';

/**
 * HubCard — the standard content surface for every hub body.
 * Layered glass card with optional icon/title/subtitle header, header action
 * slot, and footer. Use `padded={false}` for tables/maps that manage their own
 * inner spacing.
 */
export default function HubCard({ icon: Icon, title, subtitle, action, footer, children, padded = true, className = '', tone = 'brand' }) {
  const toneClass = {
    brand: 'from-[#2E5A1A] to-[#5A8C1E]',
    blue: 'from-blue-600 to-indigo-600',
    amber: 'from-amber-500 to-orange-500',
    rose: 'from-rose-500 to-pink-600',
    violet: 'from-violet-500 to-purple-600',
    slate: 'from-slate-500 to-slate-700',
  }[tone] || 'from-[#2E5A1A] to-[#5A8C1E]';

  const hasHeader = Icon || title || action;

  return (
    <section className={`hub-glass rounded-3xl overflow-hidden animate-slide-up ${className}`}>
      {hasHeader && (
        <header className="flex items-center gap-3 px-4 sm:px-5 pt-4 sm:pt-5 pb-3">
          {Icon && (
            <span className={`w-9 h-9 rounded-xl bg-gradient-to-br ${toneClass} text-white flex items-center justify-center flex-shrink-0 shadow-sm`}>
              <Icon className="w-[18px] h-[18px]" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            {title && <h3 className="text-hub-section text-slate-900 truncate">{title}</h3>}
            {subtitle && <p className="text-hub-caption text-slate-500 truncate">{subtitle}</p>}
          </div>
          {action && <div className="flex-shrink-0 flex items-center gap-2">{action}</div>}
        </header>
      )}
      <div className={padded ? `px-4 sm:px-5 ${hasHeader ? 'pb-4 sm:pb-5' : 'py-4 sm:py-5'}` : ''}>{children}</div>
      {footer && <footer className="px-4 sm:px-5 py-3 border-t border-slate-100 bg-slate-50/60 text-hub-caption text-slate-500">{footer}</footer>}
    </section>
  );
}