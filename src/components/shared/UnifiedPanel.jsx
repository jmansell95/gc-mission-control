import React from 'react';
import { X } from 'lucide-react';

/**
 * UnifiedPanelHeader — the shared header for every drawer, popup, and
 * side panel across the site. Provides a consistent white modern look:
 * gradient icon tile + title/subtitle on the left, action buttons + close
 * on the right, with a clean divider underneath.
 *
 * Usage:
 *   <UnifiedPanelHeader icon={Truck} title="Vehicle Detail" subtitle="DA23 FKL"
 *     onClose={() => setOpen(false)} actions={<Button>Save</Button>} />
 */
export function UnifiedPanelHeader({ icon: Icon, title, subtitle, onClose, actions, gradient = 'stat-gradient-brand' }) {
  return (
    <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100 mb-4 flex-shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <div className={`w-10 h-10 rounded-xl ${gradient} flex items-center justify-center flex-shrink-0 shadow-sm icon-tile-glow`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
        )}
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-slate-900 truncate leading-tight">{title}</h2>
          {subtitle && <p className="text-sm text-slate-500 truncate leading-tight mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {actions}
        {onClose && (
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-100/80 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition flex items-center justify-center flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * UnifiedPanelSection — a titled section within a drawer/panel.
 * Clean header + content with consistent spacing.
 */
export function UnifiedPanelSection({ title, icon: Icon, children, className = '', action }) {
  return (
    <div className={className}>
      {title && (
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            {Icon && <Icon className="w-3.5 h-3.5 text-slate-400" />}
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">{title}</h3>
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * UnifiedPanelBody — the scrollable content area of a drawer/panel.
 * Wraps children in a consistent padded scroll container.
 */
export function UnifiedPanelBody({ children, className = '' }) {
  return (
    <div className={`flex-1 overflow-y-auto overscroll-contain ${className}`}>
      {children}
    </div>
  );
}

/**
 * UnifiedStatGrid — a responsive grid of small stat tiles for use
 * inside drawers/panels. Consistent sizing and spacing.
 */
export function UnifiedStatGrid({ stats, className = '' }) {
  return (
    <div className={`grid grid-cols-2 sm:grid-cols-4 gap-2.5 ${className}`}>
      {stats.map((stat, i) => {
        const Icon = stat.icon;
        return (
          <div key={i} className="bg-white rounded-xl border border-slate-200/80 p-3 shadow-sm">
            {Icon && (
              <div className={`w-7 h-7 rounded-lg ${stat.gradient || 'bg-slate-100'} flex items-center justify-center mb-1.5`}>
                <Icon className="w-3.5 h-3.5 text-white" />
              </div>
            )}
            <p className="text-lg font-extrabold text-slate-900 tabular-nums leading-none">{stat.value}</p>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mt-0.5 truncate">{stat.label}</p>
          </div>
        );
      })}
    </div>
  );
}