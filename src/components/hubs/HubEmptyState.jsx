import React from 'react';

/**
 * HubEmptyState — consistent, polished empty state for all hub pages.
 * Shows an icon, title, description, and optional action button.
 *
 * Props:
 *   icon     — lucide icon component
 *   title    — short heading
 *   description — helper text
 *   action   — optional { label, onClick } for a CTA button
 */
export default function HubEmptyState({ icon: Icon, title, description, action, secondaryAction, compact = false }) {
  return (
    <div className={`hub-glass rounded-3xl text-center animate-slide-up ${compact ? 'p-6' : 'p-10 sm:p-12'}`}>
      <div className={`${compact ? 'w-12 h-12 mb-3' : 'w-16 h-16 mb-4'} rounded-2xl bg-gradient-to-br from-[#2E5A1A]/10 to-[#8DC63F]/15 flex items-center justify-center mx-auto`}>
        {Icon && <Icon className={`${compact ? 'w-5 h-5' : 'w-7 h-7'} text-[#2E5A1A]`} />}
      </div>
      <h3 className={`${compact ? 'text-sm' : 'text-base'} font-bold text-slate-900 mb-1`}>{title}</h3>
      {description && <p className="text-sm text-slate-500 max-w-sm mx-auto">{description}</p>}
      {(action || secondaryAction) && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {action && (
            <button
              type="button"
              onClick={action.onClick}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#2E5A1A] text-white rounded-xl text-sm font-semibold hover:bg-[#244715] active:scale-[0.98] transition shadow-sm"
            >
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 active:scale-[0.98] transition"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}