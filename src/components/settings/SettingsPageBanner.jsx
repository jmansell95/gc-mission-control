import React from 'react';

/**
 * SettingsPageBanner — the consistent header shown at the top of every
 * settings sub-page. Provides uniform spacing, a branded gradient icon tile,
 * the page title and description. This is the single shared banner for the
 * entire settings area — every page gets the same look.
 */
export default function SettingsPageBanner({ icon: Icon, title, description }) {
  return (
    <div className="insight-card relative rounded-2xl p-4 md:p-5 overflow-hidden">
      {/* Subtle brand gradient wash on the right */}
      <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-[0.04] pointer-events-none"
        style={{ background: 'linear-gradient(135deg, #2E5A1A 0%, #8DC63F 100%)' }} />
      <div className="flex items-center gap-3.5 min-w-0 relative z-10">
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
    </div>
  );
}