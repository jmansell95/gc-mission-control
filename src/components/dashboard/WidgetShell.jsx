import React from 'react';

/**
 * WidgetShell — modernized wrapper for dashboard widgets.
 * Uses the new insight-card style system with layered shadows and gradient header.
 */
export default function WidgetShell({ icon: Icon, iconBg = 'bg-[#2E5A1A]/10', iconColor = 'text-[#2E5A1A]', title, subtitle, action, children, bodyClassName = 'p-5' }) {
  return (
    <div className="insight-card relative rounded-2xl overflow-hidden h-full flex flex-col min-h-[200px]">
      <div className="px-4 sm:px-5 py-4 bg-gradient-to-r from-slate-50/90 via-white to-white border-b border-slate-100/80 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {Icon && (
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center flex-shrink-0 shadow-md">
              <Icon className="w-5 h-5 text-white" />
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900 truncate tracking-tight">{title}</h2>
            {subtitle && <p className="text-xs text-slate-400 truncate mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {action && <div className="flex-shrink-0 w-full sm:w-auto flex justify-end">{action}</div>}
      </div>
      <div className={`${bodyClassName} flex-1`}>
        {children}
      </div>
    </div>
  );
}