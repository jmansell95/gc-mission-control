import React from 'react';

/**
 * Consistent premium section header for every settings sub-page.
 * Sits below the parent "Settings" hero header and provides a uniform,
 * professional layout: gradient icon tile + title + description on the left,
 * optional action buttons on the right.
 */
export default function SettingsSectionHeader({ icon: Icon, title, description, actions }) {
  return (
    <div className="hub-glass relative rounded-2xl p-4 md:p-5 mb-5 overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 relative z-10">
        <div className="flex items-center gap-3.5 min-w-0">
          {Icon && (
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center flex-shrink-0 shadow-md icon-tile-glow">
              <Icon className="w-5 h-5 text-white" />
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-ui-heading md:text-ui-display font-bold text-slate-900 tracking-tight truncate">{title}</h2>
            {description && <p className="text-ui-body text-slate-500 mt-0.5">{description}</p>}
          </div>
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 flex-shrink-0 [&>button]:whitespace-nowrap">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}